import { mkdir, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { formatPoints } from "../../packages/app/src/screens/points/src/formatPoints.ts";
import { attestationId, isScanAreaId, parseAttestation, scanArea, type ScanAreaId } from "../../packages/core/src/scan/index.ts";
import { callApi } from "./api.ts";
import { CLOSING_HEADER } from "./finish.ts";
import { ATTESTATION_FILE, SCAN_DIR, fail, jsonParseProblem, readText, type Deps, type Outcome } from "./shared.ts";

export interface AreaLeft {
  id: ScanAreaId;
  label: string;
  functions: number;
  examined: number;
}

/** `GET /scan/next`: the round the signed attestation was, and what the wallet's next round earns. */
export interface NextResponse {
  release: string;
  /** Null for a whole-surface scan made before areas existed. */
  area: ScanAreaId | null;
  /** Null for a scan made before rounds. */
  round: number | null;
  points: string;
  nextRound: number;
  nextRewardAtomic: string;
  nextPaid: boolean;
  areasLeft: AreaLeft[];
  suggested: ScanAreaId | null;
}

const ATOMIC = /^\d{1,40}$/;

function isNextResponse(value: unknown): value is NextResponse {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const count = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
  return (
    typeof v.release === "string" &&
    (v.area === null || isScanAreaId(v.area)) &&
    (v.round === null || (Number.isInteger(v.round) && (v.round as number) >= 1)) &&
    typeof v.points === "string" &&
    ATOMIC.test(v.points) &&
    Number.isInteger(v.nextRound) &&
    typeof v.nextRewardAtomic === "string" &&
    ATOMIC.test(v.nextRewardAtomic) &&
    typeof v.nextPaid === "boolean" &&
    (v.suggested === null || isScanAreaId(v.suggested)) &&
    Array.isArray(v.areasLeft) &&
    v.areasLeft.every((a) => {
      const area = a as Record<string, unknown> | null;
      return area !== null && typeof area === "object" && isScanAreaId(area.id) && typeof area.label === "string" && count(area.functions) && count(area.examined);
    })
  );
}

/** The message that ends the agent's turn after the drafts are filed: what this round earned and why to run another. */
export function nextMessage(next: NextResponse): string {
  const area = next.area === null ? "" : ` (${scanArea(next.area).label})`;
  const earned = `${next.round === null ? "This scan" : `Round ${next.round}`}${area} earned ${next.points === "0" ? "no points" : `${formatPoints(next.points)} points`}`;
  const suggested = next.areasLeft.find((a) => a.id === next.suggested);
  if (suggested === undefined) {
    return `${earned}. This wallet has no areas of v${next.release} left to scan; the next release opens new rounds.`;
  }
  const reward = next.nextPaid
    ? `${earned}, and round ${next.nextRound} earns ${formatPoints(next.nextRewardAtomic)} points even with no findings.`
    : `${earned}; the paid places are gone, so round ${next.nextRound} is recorded but earns no points.`;
  const unexamined = suggested.functions - suggested.examined;
  const coverage =
    unexamined <= 0
      ? `${suggested.label} is the least-covered area left.`
      : suggested.examined === 0
        ? `Nobody has examined any of the ${suggested.functions} functions in ${suggested.label} yet.`
        : `Nobody has examined ${unexamined} of the ${suggested.functions} functions in ${suggested.label} yet.`;
  return `${reward} ${coverage} Reply "next" to scan it.`;
}

/** Drafts and notes the agent filed this round; left in place they would be counted and filed again next round. */
const ROUND_FILES = /^(pr-.*\.md|advisory-.*\.md|leads\.md|candidates)$/;

async function archiveRound(deps: Deps, folder: string): Promise<boolean> {
  let names: string[];
  try {
    names = (await readdir(join(deps.root, SCAN_DIR))).filter((name) => ROUND_FILES.test(name));
  } catch {
    return false;
  }
  if (names.length === 0) return false;
  await mkdir(join(deps.root, folder), { recursive: true });
  for (const name of names) await rename(join(deps.root, SCAN_DIR, name), join(deps.root, folder, name));
  return true;
}

export async function runNext(deps: Deps): Promise<Outcome> {
  const text = await readText(deps, ATTESTATION_FILE);
  if (text === undefined) {
    return fail("next", [{ path: ATTESTATION_FILE, message: "There is no attestation file; run `pnpm scan start` first." }]);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return fail("next", [jsonParseProblem(ATTESTATION_FILE, text, error)]);
  }
  const parsed = parseAttestation(raw);
  if (!parsed.ok) {
    return fail("next", [
      { path: ATTESTATION_FILE, message: `${ATTESTATION_FILE} isn't a finished attestation; run \`pnpm scan finish\` until it passes, have the user sign it, then run \`pnpm scan next\`.` },
    ]);
  }
  const id = await attestationId(parsed.attestation);

  const fetched = await callApi(deps, `/scan/next?attestation=${id}`, undefined, "pnpm scan next");
  if (!fetched.ok) return fail("next", fetched.issues);
  if (!isNextResponse(fetched.body)) {
    return fail("next", [
      { path: "next", message: "The points API sent the next round in an unexpected shape; update this checkout (`git fetch --tags`) and run `pnpm scan next` again." },
    ]);
  }
  const next = fetched.body;

  const folder = `${SCAN_DIR}/round-${next.round ?? 1}-${id.slice(0, 12)}`;
  const archived = await archiveRound(deps, folder);
  const message = nextMessage(next);
  const command = next.suggested === null ? undefined : `pnpm scan start --area ${next.suggested}`;
  const lines = [
    `${next.round === null ? "The scan" : `Round ${next.round}`} of Gleam v${next.release} is signed (attestation ${id}).`,
    ...(archived ? [`Moved this round's drafts and notes to ${folder}/.`] : []),
    ...(command === undefined ? [] : [`If the user replies "next", run \`${command}\` in this checkout and scan that area (security/scan/SKILL.md § Next round).`]),
    "",
    CLOSING_HEADER,
    "",
    message,
  ];
  return {
    ok: true,
    command: "next",
    lines,
    issues: [],
    json: { attestationId: id, ...next, ...(command === undefined ? {} : { nextCommand: command }), closingHeader: CLOSING_HEADER, userMessage: message },
  };
}
