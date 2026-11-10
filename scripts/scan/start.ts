import {
  SCAN_AREAS,
  findFunction,
  isJsxPath,
  isScanAreaId,
  parseSurfaceText,
  scanArea,
  surfaceFileTiers,
  type SurfaceEntry,
  type SurfaceTier,
} from "../../packages/core/src/scan/index.ts";
import { callApi } from "./api.ts";
import {
  AREA_FILES_FILE,
  ATTESTATION_FILE,
  CHALLENGE_FILE,
  SCAN_DIR,
  STARTED_FILE,
  fail,
  gitOrUndefined,
  isChallengeResponse,
  readText,
  showAtCommit,
  writeJson,
  type Deps,
  type Outcome,
  type Problem,
} from "./shared.ts";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const AREA_IDS = SCAN_AREAS.map((area) => area.id).join(", ");

/**
 * The files of one area: the scannable files `surfaceFileTiers` puts in the
 * tier, plus the config, CI and lockfile entries the challenge never draws
 * from but a build-area review still has to read. Tests are left out.
 */
export function areaFiles(entries: readonly SurfaceEntry[], paths: readonly string[], tier: SurfaceTier): string[] {
  const scannable = surfaceFileTiers(entries, paths);
  return paths
    .filter((path) => {
      if (scannable.has(path)) return scannable.get(path) === tier;
      if (/\.(test|spec)\.tsx?$/.test(path)) return false;
      const tiers = entries.filter((e) => (e.path.endsWith("/") ? path.startsWith(e.path) : path === e.path)).map((e) => e.tier);
      return tiers.length > 0 && Math.min(...tiers) === tier;
    })
    .sort();
}

export async function runStart(deps: Deps, options: { area?: string } = {}): Promise<Outcome> {
  const { area } = options;
  if (area !== undefined && !isScanAreaId(area)) {
    const named = area === "" ? "--area needs an area id" : `${JSON.stringify(area)} isn't a scan area`;
    return fail("start", [{ path: "area", message: `${named}; use one of ${AREA_IDS}, or leave out --area to scan the least-covered one.` }]);
  }
  const path = area === undefined ? "/scan/challenge" : `/scan/challenge?area=${area}`;
  const rerun = area === undefined ? "pnpm scan start" : `pnpm scan start --area ${area}`;
  const fetched = await callApi(deps, path, undefined, rerun);
  if (!fetched.ok) return fail("start", fetched.issues);
  if (!isChallengeResponse(fetched.body) || fetched.body.functions.length === 0) {
    return fail("start", [
      { path: "challenge", message: "The points API sent a challenge in an unexpected shape; update this checkout (`git fetch --tags`) and run `pnpm scan start` again." },
    ]);
  }
  const challenge = fetched.body;

  const head = await gitOrUndefined(deps, ["rev-parse", "HEAD"]);
  if (head === undefined) {
    return fail("start", [{ path: "git", message: "This isn't a git checkout of Gleam; run `pnpm scan start` from inside a git checkout of the latest Gleam release tag." }]);
  }
  if (head !== challenge.commit) {
    return fail("start", [
      {
        path: "git",
        message: `HEAD is ${head.slice(0, 7)} but the latest release is v${challenge.release} (${challenge.commit.slice(0, 7)}); run \`git fetch --tags && git checkout v${challenge.release} && pnpm install --frozen-lockfile\`, then \`pnpm scan start\` again.`,
      },
    ]);
  }

  const spans: { file: string; symbol: string; startLine: number; endLine: number }[] = [];
  const problems: Problem[] = [];
  for (const fn of challenge.functions) {
    const text = await showAtCommit(deps, challenge.commit, fn.file);
    const span = text === undefined ? undefined : findFunction(text, fn.symbol, { jsx: isJsxPath(fn.file) });
    if (!span) {
      problems.push({
        path: fn.file,
        message: `\`${fn.symbol}\` isn't in ${fn.file} at ${challenge.commit.slice(0, 7)}; run \`git fetch --tags\` and \`pnpm scan start\` again, and if it persists tell the user the challenge is broken.`,
      });
    } else spans.push({ ...fn, startLine: span.startLine, endLine: span.endLine });
  }
  if (problems.length > 0) return fail("start", problems);

  const chosen = scanArea(challenge.area);
  const surface = await showAtCommit(deps, challenge.commit, "security/surface.txt");
  const tracked = (await gitOrUndefined(deps, ["ls-files"]))?.split("\n").filter(Boolean) ?? [];
  const files = surface === undefined ? [] : areaFiles(parseSurfaceText(surface), tracked, chosen.tier);

  const notes: string[] = [];
  await writeJson(deps, CHALLENGE_FILE, challenge);
  await writeFile(join(deps.root, STARTED_FILE), `${deps.now()}\n`);
  await writeFile(join(deps.root, AREA_FILES_FILE), files.map((file) => `${file}\n`).join(""));
  const existingText = await readText(deps, ATTESTATION_FILE);
  let existing: unknown;
  let keep = false;
  if (existingText !== undefined) {
    try {
      existing = JSON.parse(existingText);
    } catch {
      existing = undefined;
    }
    const old = (existing as { challenge?: unknown } | null | undefined)?.challenge;
    keep = old === challenge.challenge;
    if (!keep) {
      const label = typeof old === "string" && /^[A-Za-z0-9_-]+$/.test(old) ? old : "unreadable";
      const backup = `${SCAN_DIR}/attestation.${label}.json`;
      await writeFile(join(deps.root, backup), existingText);
      notes.push(`Backed up the previous ${ATTESTATION_FILE} to ${backup}.`);
    }
  }
  if (!keep) {
    await writeJson(deps, ATTESTATION_FILE, {
      challenge: challenge.challenge,
      model: "",
      answers: spans.map(({ file, symbol }) => ({ file, symbol, line: 0, check: "" })),
      result: "pass",
      report: "",
    });
  }

  const short = challenge.commit.slice(0, 7);
  const lines = [
    `Challenge ready for Gleam v${challenge.release} (commit ${short}).`,
    files.length === 0
      ? `Area: ${chosen.label} (${chosen.id}, tier ${chosen.tier}).`
      : `Area: ${chosen.label} (${chosen.id}, tier ${chosen.tier}). Review these ${files.length} files first, then follow anything they reach:`,
    ...files.map((file) => `    ${file}`),
    "Answer these functions. Lines are checked against the committed file (`git show <commit>:<file>`), not your working tree.",
    ...spans.map((s, i) => `  ${i + 1}. ${s.file}  ${s.symbol}  lines ${s.startLine}-${s.endLine}`),
    `Expires: ${challenge.expiresAt}`,
    ...notes,
    keep ? `Kept your ${ATTESTATION_FILE}.` : `Wrote ${CHALLENGE_FILE}, ${AREA_FILES_FILE} and a starter ${ATTESTATION_FILE}.`,
    "Next:",
    `  1. Read security/scan/SKILL.md and scan the ${chosen.label} area of the release.`,
    `  2. Edit ${ATTESTATION_FILE}: per answer set line (a line in the function body that makes a security check) and check (one sentence on what it prevents); set model, result ("pass" or "scanned") and report.`,
    "  3. Run `pnpm scan finish`.",
  ];
  return { ok: true, command: "start", lines, issues: [], json: { challenge: { ...challenge, functions: spans }, area: { ...chosen, files } } };
}
