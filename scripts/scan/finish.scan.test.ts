// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { main, render, renderJson } from "./cli.ts";
import { runFinish } from "./finish.ts";
import {
  COMMIT,
  FUNCTIONS,
  acceptCheck,
  exists,
  fakeApi,
  fakeGit,
  finishedAttestation,
  goodAttestation,
  idOf,
  json,
  makeDeps,
  readJsonFile,
  writeRound,
} from "./harness.ts";
import { CLOSING_HEADER, type Deps } from "./shared.ts";

const KEYS = ".gleam-scan/rounds/keys";

function setup(attestation: unknown, overrides: Partial<Deps> = {}, raw?: string): Deps {
  const deps = makeDeps(overrides);
  writeRound(deps, "keys", raw === undefined ? { attestation } : { raw });
  return deps;
}

async function lines(deps: Deps, area?: string): Promise<string[]> {
  return render(await runFinish(deps, { area }), false).split("\n");
}

const closing = (text: string) => text.slice(text.indexOf(CLOSING_HEADER) + CLOSING_HEADER.length + 2);

describe("pnpm scan finish: local checks", () => {
  it("asks for start when there is no round or no attestation", async () => {
    expect(await lines(makeDeps())).toEqual(["✗ round: There is no round yet; run `pnpm scan start` first."]);
    expect(await lines(makeDeps(), "signing")).toEqual([
      "✗ .gleam-scan/rounds/signing/challenge.json: There is no challenge for Signing; run `pnpm scan start --area signing` first.",
    ]);
    const deps = makeDeps();
    writeRound(deps, "keys");
    expect(await lines(deps)).toEqual([`✗ ${KEYS}/attestation.json: There is no attestation file; run \`pnpm scan start --area keys\` first.`]);
  });

  it("names the line and column of bad JSON", async () => {
    const [line] = await lines(setup(undefined, {}, '{\n  "model": "x",\n  oops\n}'));
    expect(line).toMatch(/^✗ \.gleam-scan\/rounds\/keys\/attestation\.json: \.gleam-scan\/rounds\/keys\/attestation\.json isn't valid JSON at line 3, column 3;/);
  });

  it("flags the starter placeholders with targeted lines", async () => {
    const starter = { challenge: "Q".repeat(22), model: "", answers: FUNCTIONS.map((fn) => ({ ...fn, line: 0, check: "" })), result: "pass", report: "" };
    const out = await lines(setup(starter));
    expect(out).toContain("✗ model: model is empty; set it to your model name, such as claude-opus-5-5.");
    expect(out).toContain("✗ report: report is empty; write markdown on what you checked and what you didn't.");
    expect(out).toContain("✗ answers[0].line: answers[0].line is 0; set it to the line of a security check in the body of `unlockVault` (lines 8-16).");
    expect(out).toContain("✗ answers[2].check: answers[2].check is empty; write one sentence on what the cited line prevents.");
    expect(out).toHaveLength(2 + 3 * 2);
  });

  it("surfaces core answer issues, one line each", async () => {
    const attestation = goodAttestation();
    const answers = attestation.answers as { line: number; symbol: string }[];
    answers[0]!.line = 11; // a comment line inside unlockVault
    answers[1]!.line = 1;
    answers[2]!.symbol = "nope";
    const out = await lines(setup(attestation));
    expect(out.every((line) => line.startsWith("✗ "))).toBe(true);
    expect(out.join("\n")).toContain("answers[0].line 11 is a comment");
    expect(out.join("\n")).toContain("answers[1].line 1 is outside `isAllowedOrigin`");
    expect(out.join("\n")).toContain("answers[2]");
  });

  it("surfaces shape issues and invisible characters", async () => {
    const out = await lines(setup(goodAttestation({ result: "maybe", extra: 1 })));
    expect(out).toContain('✗ result: result must be "pass" if you filed nothing, or "scanned" if you filed a PR or an advisory.');
    expect(out).toContain("✗ extra: extra isn't part of the attestation format; remove it.");
    expect(await lines(setup(goodAttestation({ report: "Checked the vault.​" })))).toContain(
      "✗ report: report contains an invisible character (U+00AD, U+200B–U+200D, U+2060, U+FEFF or a tag character U+E0000–U+E007F); remove it.",
    );
  });

  it("names this area in the fix for an expired challenge, and fails on a HEAD that isn't the release", async () => {
    const expired = setup(goodAttestation(), { now: () => Date.parse("2026-10-20T00:00:00Z") });
    expect(await lines(expired)).toContain(
      "✗ challenge: The challenge expired at 2026-10-19T00:00:00.000Z; run `pnpm scan start --area keys`, answer its 3 new functions, copy model, result and report from the backup it names, then run `pnpm scan finish --area keys`.",
    );
    const moved = setup(goodAttestation(), { git: fakeGit({ head: "e".repeat(40), tags: [] }) });
    const out = (await lines(moved)).join("\n");
    expect(out).toContain("has no v<x.y.z> release tag; run `git checkout v1.4.0`");
    expect(out).toContain("HEAD is eeeeeee but the challenge is for v1.4.0 (ccccccc)");
  });

  it("does not call the server when a local check fails", async () => {
    const calls: string[] = [];
    await runFinish(setup(goodAttestation({ report: "" }), { fetchImpl: fakeApi({}, calls) }));
    expect(calls).toEqual([]);
  });

  it("refuses a signed round", async () => {
    const deps = setup(finishedAttestation("keys"));
    writeRound(deps, "keys", { signed: { attestationId: "a".repeat(64), round: 1, points: "0" } });
    expect(await lines(deps)).toEqual(["✗ round: The Key material round is signed already; run `pnpm scan next`."]);
  });
});

describe("pnpm scan finish: server", () => {
  it("prints server issues the same way", async () => {
    const message = "v1.4.0 isn't the latest release; check out v1.5.0, run `pnpm scan start` and answer again.";
    const deps = setup(goodAttestation(), {
      fetchImpl: fakeApi({ "/attestations/check": () => json({ error: "x", code: "release_not_latest", issues: [{ code: "release_not_latest", path: "release", message }] }, 409) }),
    });
    expect(await lines(deps)).toEqual([`✗ release: ${message}`]);
  });

  it("rewrites the server's restart for a dead challenge to name this area, and reopens the round", async () => {
    const deps = setup(goodAttestation(), {
      fetchImpl: fakeApi({
        "/attestations/check": () =>
          json({ error: "x", code: "challenge_used", issues: [{ code: "challenge_used", path: "challenge", message: "This challenge was already used; run `pnpm scan start` for a new one." }] }, 409),
      }),
    });
    writeRound(deps, "keys", { finished: true });
    expect(await lines(deps)).toEqual([
      "✗ challenge: This challenge was already used; run `pnpm scan start --area keys`, answer its 3 new functions, copy model, result and report from the backup it names, then run `pnpm scan finish --area keys`.",
    ]);
    expect(exists(deps, `${KEYS}/finished.json`)).toBe(false);
  });

  it("keeps a finished round waiting through a server error, and reopens it on a rejection", async () => {
    const deps = setup(finishedAttestation("keys"), { fetchImpl: fakeApi({ "/attestations/check": () => json({ code: "rate_limited" }, 429) }) });
    writeRound(deps, "keys", { finished: true });
    await runFinish(deps);
    expect(exists(deps, `${KEYS}/finished.json`)).toBe(true);
    deps.fetchImpl = fakeApi({ "/attestations/check": () => json({ error: "x", code: "answers_failed", issues: [{ code: "answers_failed", path: "answers[0].line", message: "bad" }] }, 422) });
    await runFinish(deps);
    expect(exists(deps, `${KEYS}/finished.json`)).toBe(false);
  });

  it("explains a network failure and a 429 in one sentence", async () => {
    const down = setup(goodAttestation(), { fetchImpl: (async () => { throw new TypeError("fetch failed"); }) as typeof fetch });
    expect(await lines(down)).toEqual(["✗ network: Couldn't reach https://api.test (fetch failed); check the connection and run `pnpm scan finish` again."]);
    const limited = setup(goodAttestation(), { fetchImpl: fakeApi({ "/attestations/check": () => json({ code: "rate_limited" }, 429, { "Retry-After": "42" }) }) });
    expect(await lines(limited, "keys")).toEqual([
      "✗ rate_limited: The points API is rate limiting this address; wait 42 seconds, then run `pnpm scan finish --area keys` again.",
    ]);
  });

  it("fails when the server's id differs from the local one", async () => {
    const deps = setup(goodAttestation(), { fetchImpl: fakeApi({ "/attestations/check": () => json({ ok: true, attestationId: "0".repeat(64) }) }) });
    expect((await lines(deps))[0]).toContain("The server computed a different attestation id");
  });
});

describe("pnpm scan finish: the round offer", () => {
  it("fills release and commit, marks the round finished, and ends with the offer", async () => {
    const deps = setup(goodAttestation({ release: "0.9.0", commit: "f".repeat(40) }));
    const outcome = await runFinish(deps);
    expect(outcome.ok).toBe(true);
    const id = await idOf(finishedAttestation("keys"));
    expect(render(outcome, false).split("\n")).toEqual([
      '✓ Replaced release "0.9.0" with 1.4.0 from git.',
      `Replaced commit "${"f".repeat(40)}" with ${COMMIT} from git.`,
      "Attestation valid for Gleam v1.4.0, area Key material.",
      `Attestation id: ${id}`,
      "Paid places left: 90",
      "",
      CLOSING_HEADER,
      "",
      'Round 1 (Key material) is ready. 1 round is waiting to be signed. Round 2 earns 13.64 points even with no findings, and nobody has examined 97 of the 137 functions in Trust boundary yet. Reply "next" to scan it, or "file" to sign and file everything.',
    ]);
    expect(readJsonFile(deps, `${KEYS}/attestation.json`)).toMatchObject({ release: "1.4.0", commit: COMMIT });
    expect(readJsonFile(deps, `${KEYS}/finished.json`)).toEqual({ attestationId: id });
  });

  it("counts the waiting rounds and their reports, and numbers rounds after the signed ones", async () => {
    const deps = makeDeps();
    writeRound(deps, "keys", { attestation: finishedAttestation("keys"), finished: true, startedAt: 1, files: { "pr-1.md": "x", "advisory-1.md": "Title: A site can read balances\nShort." } });
    writeRound(deps, "signing", { attestation: goodAttestation({}, "signing"), startedAt: 2, files: { "pr-1.md": "x" } });
    expect(closing(render(await runFinish(deps), false))).toBe(
      'Round 2 (Signing) is ready. 2 rounds and 3 reports are waiting to be signed. Round 3 earns 14.88 points even with no findings, and nobody has examined 97 of the 137 functions in Trust boundary yet. Reply "next" to scan it, or "file" to sign and file everything.',
    );

    // A round signed earlier (here, the wallet's third) moves the numbering on, and a filed report no longer waits.
    writeRound(deps, "keys", { signed: { attestationId: "a".repeat(64), round: 3, points: "1" }, files: { "filed.txt": "pr-1.md https://x\n" } });
    writeRound(deps, "signing", { files: { "filed.txt": "pr-1.md https://github.com/x/pull/1\n" } });
    expect(closing(render(await runFinish(deps), false))).toBe(
      'Round 4 (Signing) is ready. 1 round is waiting to be signed. Round 5 earns 17.36 points even with no findings, and nobody has examined 97 of the 137 functions in Trust boundary yet. Reply "next" to scan it, or "file" to sign and file everything.',
    );
  });

  it("forecasts the tail reward, and no points once the waiting rounds take the last places", async () => {
    const tail = setup(goodAttestation(), { fetchImpl: fakeApi({ "/attestations/check": acceptCheck(81) }) });
    expect(closing(render(await runFinish(tail), false))).toContain("Round 2 earns 2.72 points even with no findings");

    const gone = setup(goodAttestation(), { fetchImpl: fakeApi({ "/attestations/check": acceptCheck(1) }) });
    expect(closing(render(await runFinish(gone), false))).toContain("Round 2 is recorded but earns no points, and nobody has examined");

    const none = setup(goodAttestation(), { fetchImpl: fakeApi({ "/attestations/check": acceptCheck(0) }) });
    const text = render(await runFinish(none), false);
    expect(text).toContain("Warning: no paid places are left, so this round will be recorded but earns no points.");
    expect(closing(text)).toContain("Round 2 is recorded but earns no points");
  });

  it("still offers the next round when rewards or areas can't be read", async () => {
    const down = () => json({}, 502);
    const noRewards = setup(goodAttestation(), { fetchImpl: fakeApi({ "/scan/rewards": down }) });
    expect(closing(render(await runFinish(noRewards), false))).toContain("Round 2 earns points even with no findings, and nobody has examined");
    const noAreas = setup(goodAttestation(), { fetchImpl: fakeApi({ "/scan/areas": down }) });
    expect(closing(render(await runFinish(noAreas), false))).toContain("Round 2 earns 13.64 points even with no findings, and Signing is next.");
  });

  it("offers only file once every area has a round here", async () => {
    const deps = makeDeps();
    writeRound(deps, "keys", { attestation: finishedAttestation("keys"), finished: true, startedAt: 1 });
    writeRound(deps, "signing", { attestation: finishedAttestation("signing"), signed: { attestationId: "a".repeat(64), round: 1, points: "1" }, startedAt: 2 });
    writeRound(deps, "boundary", { attestation: finishedAttestation("boundary"), finished: true, startedAt: 3, files: { "advisory-1.md": "Title: A site can read balances\nShort." } });
    writeRound(deps, "preview", { attestation: goodAttestation({}, "preview"), startedAt: 4 });
    expect(closing(render(await runFinish(deps), false))).toBe(
      'Round 4 (Approval preview) is ready. Every area of v1.4.0 is done in this checkout. Reply "file" to sign the 3 rounds and file 1 report.',
    );
  });

  it("reports the time since `pnpm scan start`, and omits it when start left no record", async () => {
    const timed = setup(goodAttestation());
    writeRound(timed, "keys", { startedAt: timed.now() - 125_000 });
    const outcome = await runFinish(timed);
    expect(render(outcome, false)).toContain("Scan time: 2m 05s.");
    expect(outcome.json).toMatchObject({ elapsedMs: 125_000, elapsed: "2m 05s" });
    expect(render(await runFinish(setup(goodAttestation())), false)).not.toContain("Scan time");
  });

  it("warns about a long advisory draft above the closing message, without failing", async () => {
    const deps = setup(goodAttestation({ result: "scanned" }));
    const wordy = Array.from({ length: 30 }, () => "The page signs a tag the user never saw.").join(" ");
    writeRound(deps, "keys", { files: { "advisory-1.md": `Title: A site can steal funds\n${wordy}` } });
    const outcome = await runFinish(deps);
    expect(outcome.ok).toBe(true);
    const out = render(outcome, false).split("\n");
    const warning = out.findIndex((line) => line.startsWith(`! ${KEYS}/advisory-1.md: 270 words above <details>`));
    expect(warning).toBeGreaterThan(0);
    expect(warning).toBeLessThan(out.indexOf(CLOSING_HEADER));
    expect(outcome.json).toMatchObject({ warnings: [out[warning]] });
  });

  it("--json prints exactly one object on stdout", async () => {
    const out: string[] = [];
    expect(await main(["finish", "--json"], setup(goodAttestation()), { out: (t) => out.push(t), tty: true })).toBe(0);
    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0]!);
    expect(Object.keys(parsed).sort()).toEqual(
      ["area", "attestationId", "challenge", "closingHeader", "command", "nextRewardAtomic", "nextRound", "ok", "paidPlacesLeft", "round", "suggested", "userMessage", "waiting"].sort(),
    );
    expect(parsed).toMatchObject({ ok: true, command: "finish", area: "keys", round: 1, suggested: "boundary", nextRound: 2, nextRewardAtomic: "13640000000000", closingHeader: CLOSING_HEADER });
    expect(parsed.userMessage).toMatch(/^Round 1 \(Key material\) is ready\./);
    expect(out[0]).not.toContain("\u001b");

    const failed: string[] = [];
    expect(await main(["finish", "--json"], setup(goodAttestation({ report: "" })), { out: (t) => failed.push(t), tty: true })).toBe(1);
    expect(JSON.parse(failed[0]!)).toEqual({
      ok: false,
      command: "finish",
      issues: [{ path: "report", message: "report is empty; write markdown on what you checked and what you didn't." }],
    });
    expect(renderJson({ ok: true, command: "start", lines: [], issues: [], json: {} })).toBe('{"ok":true,"command":"start"}');
  });

  it("rejects an unknown subcommand with usage, and --area on file and next", async () => {
    const out: string[] = [];
    expect(await main(["bogus"], makeDeps(), { out: (t) => out.push(t), tty: false })).toBe(1);
    expect(out[0]).toContain("Usage: pnpm scan start [--area <id>] | pnpm scan finish [--area <id>] | pnpm scan file | pnpm scan next [--json]");
    expect(await main(["file", "--area", "keys"], makeDeps(), { out: (t) => out.push(t), tty: false })).toBe(1);
    expect(out[1]).toBe("✗ area: `pnpm scan file` acts on every waiting round; run it without --area.");
  });
});

describe("pnpm scan finish: real run", () => {
  const repo = join(import.meta.dirname, "../..");
  it.skipIf(existsSync(join(repo, ".gleam-scan")))("with no .gleam-scan/ prints the start-first line and exits 1", () => {
    const run = spawnSync("pnpm", ["--silent", "scan", "finish"], { cwd: repo, encoding: "utf8" });
    expect(run.status).toBe(1);
    expect(run.stdout.trim()).toBe("✗ round: There is no round yet; run `pnpm scan start` first.");
  });

  it("--json from an empty directory is one JSON line", () => {
    const empty = mkdtempSync(join(tmpdir(), "gleam-scan-empty-"));
    // `node --import tsx` rather than the tsx binary: its IPC socket is blocked in sandboxed scan environments.
    const tsx = pathToFileURL(join(repo, "node_modules/tsx/dist/loader.mjs")).href;
    const run = spawnSync(process.execPath, ["--import", tsx, join(repo, "scripts/scan/cli.ts"), "finish", "--json"], { cwd: empty, encoding: "utf8" });
    expect(run.status).toBe(1);
    expect(JSON.parse(run.stdout)).toMatchObject({ ok: false, command: "finish" });
  });
});
