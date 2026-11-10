// @vitest-environment node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { attestationId, parseAttestation } from "../../packages/core/src/scan/index.ts";
import { main, render } from "./cli.ts";
import { CLOSING_HEADER } from "./finish.ts";
import { COMMIT, exists, goodAttestation, json, makeDeps } from "./harness.ts";
import { nextMessage, runNext, type NextResponse } from "./next.ts";
import type { Deps } from "./shared.ts";

const FINISHED = goodAttestation({ release: "1.4.0", commit: COMMIT });

const NEXT: NextResponse = {
  release: "1.4.0",
  area: "keys",
  round: 1,
  points: "12400000000000",
  nextRound: 2,
  nextRewardAtomic: "13640000000000",
  nextPaid: true,
  areasLeft: [
    { id: "boundary", label: "Trust boundary", functions: 137, examined: 40 },
    { id: "signing", label: "Signing", functions: 50, examined: 30 },
  ],
  suggested: "boundary",
};

async function finishedId(): Promise<string> {
  const parsed = parseAttestation(FINISHED);
  if (!parsed.ok) throw new Error("fixture attestation doesn't parse");
  return attestationId(parsed.attestation);
}

function setup(body: unknown, status = 200, attestation: unknown = FINISHED): { deps: Deps; urls: string[] } {
  const urls: string[] = [];
  const deps = makeDeps({ fetchImpl: (async (url: string) => (urls.push(url), json(body, status))) as typeof fetch });
  mkdirSync(join(deps.root, ".gleam-scan"));
  writeFileSync(join(deps.root, ".gleam-scan/attestation.json"), JSON.stringify(attestation));
  return { deps, urls };
}

describe("pnpm scan next", () => {
  it("asks the server about the signed attestation and ends with the closing message", async () => {
    const { deps, urls } = setup(NEXT);
    const id = await finishedId();
    const outcome = await runNext(deps);
    expect(urls).toEqual([`https://api.test/scan/next?attestation=${id}`]);
    expect(render(outcome, false).split("\n")).toEqual([
      `✓ Round 1 of Gleam v1.4.0 is signed (attestation ${id}).`,
      'If the user replies "next", run `pnpm scan start --area boundary` in this checkout and scan that area (security/scan/SKILL.md § Next round).',
      "",
      CLOSING_HEADER,
      "",
      'Round 1 (Key material) earned 12.40 points, and round 2 earns 13.64 points even with no findings. Nobody has examined 97 of the 137 functions in Trust boundary yet. Reply "next" to scan it.',
    ]);
    expect(outcome.json).toMatchObject({ attestationId: id, suggested: "boundary", nextCommand: "pnpm scan start --area boundary", closingHeader: CLOSING_HEADER });
  });

  it("moves this round's drafts and notes aside so the next round starts empty", async () => {
    const { deps } = setup(NEXT);
    for (const name of ["pr-1.md", "advisory-1.md", "leads.md", "started-at"]) writeFileSync(join(deps.root, ".gleam-scan", name), "x");
    mkdirSync(join(deps.root, ".gleam-scan/candidates"));
    writeFileSync(join(deps.root, ".gleam-scan/candidates/1.md"), "x");
    const id = await finishedId();
    const folder = `.gleam-scan/round-1-${id.slice(0, 12)}`;
    expect(render(await runNext(deps), false)).toContain(`Moved this round's drafts and notes to ${folder}/.`);
    for (const name of ["pr-1.md", "advisory-1.md", "leads.md", "candidates/1.md"]) {
      expect(exists(deps, `${folder}/${name}`)).toBe(true);
      expect(exists(deps, `.gleam-scan/${name}`)).toBe(false);
    }
    expect(exists(deps, ".gleam-scan/started-at")).toBe(true);
    expect(exists(deps, ".gleam-scan/attestation.json")).toBe(true);
  });

  it("words the coverage by how much of the area is examined", () => {
    const left = (examined: number) => nextMessage({ ...NEXT, areasLeft: [{ id: "boundary", label: "Trust boundary", functions: 137, examined }] });
    expect(left(0)).toContain("Nobody has examined any of the 137 functions in Trust boundary yet.");
    expect(left(137)).toContain("Trust boundary is the least-covered area left.");
  });

  it("still offers a round once the paid places are gone", () => {
    expect(nextMessage({ ...NEXT, nextPaid: false, nextRewardAtomic: "0" })).toBe(
      'Round 1 (Key material) earned 12.40 points; the paid places are gone, so round 2 is recorded but earns no points. Nobody has examined 97 of the 137 functions in Trust boundary yet. Reply "next" to scan it.',
    );
    expect(nextMessage({ ...NEXT, points: "0", nextPaid: false, nextRewardAtomic: "0" })).toMatch(/^Round 1 \(Key material\) earned no points; the paid places are gone/);
  });

  it("says when the wallet has no area left, and offers no command", async () => {
    const done = { ...NEXT, round: 5, area: "build", nextRound: 6, areasLeft: [], suggested: null } as NextResponse;
    expect(nextMessage(done)).toBe("Round 5 (Build and release) earned 12.40 points. This wallet has no areas of v1.4.0 left to scan; the next release opens new rounds.");
    const { deps } = setup(done);
    const out = render(await runNext(deps), false);
    expect(out).not.toContain("pnpm scan start");
  });

  it("leaves out the area and round for a scan from before areas", () => {
    expect(nextMessage({ ...NEXT, area: null })).toMatch(/^Round 1 earned 12\.40 points, and round 2/);
    expect(nextMessage({ ...NEXT, area: null, round: null })).toMatch(/^This scan earned 12\.40 points, and round 2/);
  });

  it("passes the server's unknown_attestation sentence through", async () => {
    const error = "No signed attestation has this id yet; sign it in Gleam from the link `pnpm scan finish` printed, then run `pnpm scan next` again.";
    const { deps } = setup({ error, code: "unknown_attestation" }, 404);
    expect(render(await runNext(deps), false)).toBe(`✗ unknown_attestation: ${error}`);
  });

  it("asks for start, or finish, before it calls the server", async () => {
    const empty = makeDeps();
    expect(render(await runNext(empty), false)).toBe("✗ .gleam-scan/attestation.json: There is no attestation file; run `pnpm scan start` first.");
    const { deps, urls } = setup(NEXT, 200, goodAttestation());
    expect(render(await runNext(deps), false)).toBe(
      "✗ .gleam-scan/attestation.json: .gleam-scan/attestation.json isn't a finished attestation; run `pnpm scan finish` until it passes, have the user sign it, then run `pnpm scan next`.",
    );
    expect(urls).toHaveLength(0);
  });

  it("rejects a reply in an unexpected shape", async () => {
    const { deps } = setup({ ...NEXT, points: 12.4 });
    expect(render(await runNext(deps), false)).toMatch(/^✗ next: The points API sent the next round in an unexpected shape;/);
  });

  it("--json prints one object with the closing message", async () => {
    const { deps } = setup(NEXT);
    const out: string[] = [];
    expect(await main(["next", "--json"], deps, { out: (t) => out.push(t), tty: false })).toBe(0);
    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0]!);
    expect(parsed).toMatchObject({ ok: true, command: "next", round: 1, nextRound: 2, suggested: "boundary", userMessage: nextMessage(NEXT) });
  });
});
