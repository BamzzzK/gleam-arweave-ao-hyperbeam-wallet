// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSurfaceText } from "../../packages/core/src/scan/index.ts";
import { main, render } from "./cli.ts";
import {
  CHALLENGE,
  CHALLENGE_ID,
  COMMIT,
  SOURCE,
  challengeFor,
  exists,
  fakeApi,
  fakeGit,
  finishedAttestation,
  goodAttestation,
  json,
  makeDeps,
  readJsonFile,
  writeRound,
} from "./harness.ts";
import { CLOSING_HEADER } from "./shared.ts";
import { areaFiles, runStart } from "./start.ts";

const KEYS = ".gleam-scan/rounds/keys";

describe("pnpm scan start", () => {
  it("writes the round folder and a starter attestation, and lists the functions with spans", async () => {
    const deps = makeDeps();
    const outcome = await runStart(deps, { area: "keys" });
    expect(outcome.ok).toBe(true);
    expect(readJsonFile(deps, `${KEYS}/challenge.json`)).toEqual(CHALLENGE);
    expect(readJsonFile(deps, `${KEYS}/attestation.json`)).toEqual({
      challenge: CHALLENGE_ID,
      model: "",
      answers: CHALLENGE.functions.map((fn) => ({ ...fn, line: 0, check: "" })),
      result: "pass",
      report: "",
    });
    const text = render(outcome, false);
    expect(text).toContain("pkg/a.ts  unlockVault  lines 7-17");
    expect(text).toContain("pkg/c.ts  KeySession.get  lines 34-39");
    expect(text).toContain("not your working tree");
    expect(text).toContain("Run `pnpm scan finish`");
    expect(text).toContain(`Expires: ${CHALLENGE.expiresAt}`);
    expect(text).toContain("Started: 2026-10-16T00:00:00.000Z");
    expect(text).toContain(`Round folder: ${KEYS}/`);
    expect(readFileSync(join(deps.root, `${KEYS}/started-at`), "utf8").trim()).toBe(String(deps.now()));
    expect(readFileSync(join(deps.root, ".gleam-scan/current"), "utf8")).toBe("keys\n");
  });

  it("without --area picks the least-covered area that has no round here", async () => {
    const calls: string[] = [];
    const deps = makeDeps({ fetchImpl: fakeApi({}, calls) });
    expect(render(await runStart(deps), false)).toContain("Area: Trust boundary (boundary, tier 3).");
    expect(calls).toEqual(["/scan/areas", "/scan/challenge?area=boundary"]);

    calls.length = 0;
    writeRound(deps, "boundary", { attestation: finishedAttestation("boundary"), finished: true });
    // keys and preview are both half examined; the lower tier wins the tie.
    expect(render(await runStart(deps), false)).toContain("Area: Key material (keys, tier 1).");
    expect(calls).toEqual(["/scan/areas", "/scan/challenge?area=keys"]);
  });

  it("without --area points at an open round instead of starting another", async () => {
    const calls: string[] = [];
    const deps = makeDeps({ fetchImpl: fakeApi({}, calls) });
    writeRound(deps, "signing", { attestation: goodAttestation({}, "signing") });
    expect(render(await runStart(deps), false)).toBe(
      "✗ round: The Signing round is open in .gleam-scan/rounds/signing/; finish it (security/scan/SKILL.md § Resumed session) and run `pnpm scan finish --area signing`. If its challenge expired, run `pnpm scan start --area signing` first.",
    );
    expect(calls).toEqual([]);
  });

  it("with every area taken, ends on the file offer while rounds wait", async () => {
    const deps = makeDeps();
    for (const area of ["keys", "signing", "boundary", "preview"] as const) {
      writeRound(deps, area, { attestation: finishedAttestation(area), finished: true, files: area === "keys" ? { "pr-1.md": "x" } : {} });
    }
    const outcome = await runStart(deps);
    expect(outcome.ok).toBe(false);
    expect(render(outcome, false).split("\n")).toEqual([
      "✗ area: Every area of v1.4.0 is scanned in this checkout, so there is no round to start; end the turn with the message below.",
      "",
      CLOSING_HEADER,
      "",
      'Every area of v1.4.0 is done in this checkout. Reply "file" to sign the 4 rounds and file 1 report.',
    ]);
  });

  it("with every area signed, ends on the wallet having scanned them all", async () => {
    const deps = makeDeps();
    for (const area of ["keys", "signing", "boundary", "preview"] as const) {
      writeRound(deps, area, { attestation: finishedAttestation(area), signed: { attestationId: "a".repeat(64), round: 1, points: "0" } });
    }
    expect(render(await runStart(deps), false).split("\n").at(-1)).toBe("This wallet has scanned every area of v1.4.0; the next release opens new rounds.");
  });

  it("refuses an area that waits to be signed or is signed, before calling the server", async () => {
    const calls: string[] = [];
    const deps = makeDeps({ fetchImpl: fakeApi({}, calls) });
    writeRound(deps, "keys", { attestation: finishedAttestation("keys"), finished: true });
    expect(render(await runStart(deps, { area: "keys" }), false)).toBe(
      "✗ area: The Key material round passed `pnpm scan finish` and waits to be signed; run `pnpm scan start` for another area, or `pnpm scan file` to sign.",
    );
    writeRound(deps, "keys", { signed: { attestationId: "a".repeat(64), round: 1, points: "0" } });
    expect(render(await runStart(deps, { area: "keys" }), false)).toBe(
      "✗ area: The Key material round is signed in this checkout; run `pnpm scan start` to scan the least-covered area left.",
    );
    expect(calls).toEqual([]);
  });

  it("moves rounds of an older release aside", async () => {
    const deps = makeDeps();
    writeRound(deps, "boundary", { challenge: { ...challengeFor("boundary"), release: "1.3.0", commit: "d".repeat(40) }, finished: true });
    const out = render(await runStart(deps), false);
    expect(out).toContain("Area: Trust boundary (boundary, tier 3).");
    expect(out).toContain("Moved the Trust boundary round of v1.3.0 to .gleam-scan/v1.3.0/boundary/.");
    expect(exists(deps, ".gleam-scan/v1.3.0/boundary/finished.json")).toBe(true);
    expect(exists(deps, ".gleam-scan/rounds/boundary/finished.json")).toBe(false);
  });

  it("writes nothing and says how to check out the release when HEAD differs", async () => {
    const deps = makeDeps({ git: fakeGit({ head: "d".repeat(40) }) });
    const outcome = await runStart(deps, { area: "keys" });
    expect(outcome.ok).toBe(false);
    expect(render(outcome, false)).toBe(
      "✗ git: HEAD is ddddddd but the latest release is v1.4.0 (ccccccc); run `git fetch --tags && git checkout v1.4.0 && pnpm install --frozen-lockfile`, then `pnpm scan start --area keys` again.",
    );
    expect(exists(deps, ".gleam-scan")).toBe(false);
  });

  it("reports server errors by code, with the server's sentence", async () => {
    const release = makeDeps({
      fetchImpl: fakeApi({
        "/scan/areas": () => json({ error: "Gleam hasn't published a release yet.", code: "no_release", issues: [{ code: "no_release", path: "release", message: "Gleam hasn't published a release yet." }] }, 404),
      }),
    });
    expect(render(await runStart(release), false)).toBe("✗ release: Gleam hasn't published a release yet.");

    const limited = makeDeps({ fetchImpl: fakeApi({ "/scan/challenge": () => json({ error: "x", code: "rate_limited" }, 429, { "Retry-After": "300" }) }) });
    expect(render(await runStart(limited, { area: "keys" }), false)).toBe(
      "✗ rate_limited: The points API is rate limiting this address; wait 300 seconds, then run `pnpm scan start --area keys` again.",
    );
    const unreachable = makeDeps({ fetchImpl: (async () => { throw new Error("getaddrinfo ENOTFOUND"); }) as typeof fetch });
    expect(render(await runStart(unreachable), false)).toBe(
      "✗ network: Couldn't reach https://api.test (getaddrinfo ENOTFOUND); check the connection and run `pnpm scan start` again.",
    );
    const github = makeDeps({ fetchImpl: fakeApi({ "/scan/challenge": () => json({ error: "Gleam couldn't read the release from GitHub; run the command again in a minute.", code: "github_unavailable" }, 503) }) });
    expect(render(await runStart(github), false)).toContain("github_unavailable: Gleam couldn't read the release");
  });

  it("keeps an attestation for the same challenge", async () => {
    const deps = makeDeps();
    writeRound(deps, "keys", { attestation: { challenge: CHALLENGE_ID, model: "mine" } });
    const outcome = await runStart(deps, { area: "keys" });
    expect(outcome.ok).toBe(true);
    expect(readJsonFile(deps, `${KEYS}/attestation.json`)).toEqual({ challenge: CHALLENGE_ID, model: "mine" });
    expect(render(outcome, false)).toContain(`Kept your ${KEYS}/attestation.json.`);
  });

  it("backs up an open round's attestation for another challenge, and keeps its drafts", async () => {
    const deps = makeDeps();
    const old = "O".repeat(22);
    writeRound(deps, "keys", { attestation: { challenge: old, model: "old" }, files: { "advisory-1.md": "Title: x" } });
    const outcome = await runStart(deps, { area: "keys" });
    expect(readJsonFile(deps, `${KEYS}/attestation.${old}.json`)).toEqual({ challenge: old, model: "old" });
    expect((readJsonFile(deps, `${KEYS}/attestation.json`) as { challenge: string }).challenge).toBe(CHALLENGE_ID);
    expect(render(outcome, false)).toContain(`Backed up the previous ${KEYS}/attestation.json to ${KEYS}/attestation.${old}.json.`);
    expect(exists(deps, `${KEYS}/advisory-1.md`)).toBe(true);
  });

  it("fails when the challenge names a function the commit lacks", async () => {
    const deps = makeDeps({ git: fakeGit({ files: { "pkg/a.ts": "const x = 1;\n", "pkg/b.ts": "", "pkg/c.ts": "" } }) });
    const outcome = await runStart(deps, { area: "keys" });
    expect(outcome.ok).toBe(false);
    expect(outcome.issues[0]!.message).toContain(`isn't in pkg/a.ts at ${COMMIT.slice(0, 7)}`);
    expect(exists(deps, ".gleam-scan")).toBe(false);
  });

  it("tells apart a missing route, a server error and an unexplained 4xx when there is no code", async () => {
    const reply = (status: number, body?: string) =>
      makeDeps({ fetchImpl: fakeApi({ "/scan/challenge": () => new Response(body ?? "<html>Not Found</html>", { status }) }) });
    expect(render(await runStart(reply(404), { area: "keys" }), false)).toBe(
      "✗ http_404: https://api.test has no /scan/challenge endpoint; community scans may not be live on this server yet. Check https://gleamwallet.app/scan.html, or set GLEAM_POINTS_API.",
    );
    expect(render(await runStart(reply(502), { area: "keys" }), false)).toBe(
      "✗ http_502: The points API had a server error (502); wait a few minutes, then run `pnpm scan start --area keys` again.",
    );
    expect(render(await runStart(reply(418), { area: "keys" }), false)).toBe(
      "✗ http_418: The points API answered 418 with no explanation; tell the user, since this is a bug to report.",
    );
  });

  it("names the area, lists its files and saves them for the skill's commands", async () => {
    const deps = makeDeps();
    const outcome = await runStart(deps, { area: "keys" });
    const text = render(outcome, false);
    expect(text).toContain("Area: Key material (keys, tier 1). Review these 3 files first, then follow anything they reach:\n    pkg/a.ts\n    pkg/b.ts\n    pkg/c.ts\n");
    expect(text).toContain(`1. Scan the Key material area (security/scan/SKILL.md § Round brief). Leads, candidates and drafts go in ${KEYS}/.`);
    expect(outcome.json).toMatchObject({ area: { id: "keys", label: "Key material", tier: 1, files: ["pkg/a.ts", "pkg/b.ts", "pkg/c.ts"] }, folder: KEYS });
    expect(readFileSync(join(deps.root, `${KEYS}/area-files.txt`), "utf8")).toBe("pkg/a.ts\npkg/b.ts\npkg/c.ts\n");
  });

  it("asks for the named area and rejects an unknown one before calling the server", async () => {
    const calls: string[] = [];
    const deps = makeDeps({ fetchImpl: fakeApi({}, calls) });
    expect(render(await runStart(deps, { area: "boundary" }), false)).toContain("Area: Trust boundary (boundary, tier 3).\n");
    expect(calls).toEqual(["/scan/challenge?area=boundary"]);

    const out: string[] = [];
    expect(await main(["start", "--area", "wallet"], deps, { out: (t) => out.push(t), tty: false })).toBe(1);
    expect(out[0]).toBe("✗ area: \"wallet\" isn't a scan area; use one of keys, signing, boundary, preview, build, or leave out --area to scan the least-covered one.");
    expect(await main(["start", "--area"], deps, { out: (t) => out.push(t), tty: false })).toBe(1);
    expect(out[1]).toMatch(/^✗ area: --area needs an area id;/);
    expect(await main(["start", "--area=signing"], deps, { out: () => {}, tty: false })).toBe(0);
    expect(calls).toEqual(["/scan/challenge?area=boundary", "/scan/challenge?area=signing"]);
  });

  it("files of an area: lowest tier wins, config files count, tests don't", () => {
    const entries = parseSurfaceText("3 pkg/\n1 pkg/vault.ts\n5 .github/workflows/\n5 pnpm-lock.yaml\n");
    const paths = ["pkg/vault.ts", "pkg/router.ts", "pkg/router.test.ts", ".github/workflows/ci.yml", "pnpm-lock.yaml", "other/x.ts"];
    expect(areaFiles(entries, paths, 1)).toEqual(["pkg/vault.ts"]);
    expect(areaFiles(entries, paths, 3)).toEqual(["pkg/router.ts"]);
    expect(areaFiles(entries, paths, 5)).toEqual([".github/workflows/ci.yml", "pnpm-lock.yaml"]);
  });

  it("still starts when the surface file can't be read", async () => {
    const deps = makeDeps({ git: fakeGit({ files: { "pkg/a.ts": SOURCE, "pkg/b.ts": SOURCE, "pkg/c.ts": SOURCE } }) });
    const outcome = await runStart(deps, { area: "keys" });
    expect(outcome.ok).toBe(true);
    expect(render(outcome, false)).toContain("Area: Key material (keys, tier 1).\n");
  });
});
