import { mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { attestationId, parseAttestation, type ScanAreaId } from "../../packages/core/src/scan/index.ts";
import type { SignedRecord } from "./rounds.ts";
import type { Deps, GitRunner } from "./shared.ts";

export const COMMIT = "c".repeat(40);
export const CHALLENGE_ID = "Q".repeat(22);
export const SOURCE = readFileSync(new URL("../../packages/core/src/scan/fixtures/sample.ts.txt", import.meta.url), "utf8");
export const NOW = Date.parse("2026-10-16T00:00:00.000Z");

export const FUNCTIONS = [
  { file: "pkg/a.ts", symbol: "unlockVault" },
  { file: "pkg/b.ts", symbol: "isAllowedOrigin" },
  { file: "pkg/c.ts", symbol: "KeySession.get" },
];
export const LINES = [8, 21, 36];

const CHALLENGE_IDS: Record<ScanAreaId, string> = {
  keys: CHALLENGE_ID,
  signing: "S".repeat(22),
  boundary: "B".repeat(22),
  preview: "P".repeat(22),
  build: "U".repeat(22),
};

/** Each area gets its own challenge id, so two rounds never share an attestation id. */
export function challengeFor(area: ScanAreaId) {
  return { challenge: CHALLENGE_IDS[area], release: "1.4.0", commit: COMMIT, area, functions: FUNCTIONS, expiresAt: "2026-10-19T00:00:00.000Z" };
}

export const CHALLENGE = challengeFor("keys");

export const SURFACE = "# tiers\n1 pkg/\n";

/** `GET /scan/areas`: boundary is the least covered, build has too few functions to challenge. */
export const AREAS = {
  release: "1.4.0",
  areas: [
    { id: "keys", label: "Key material", tier: 1, functions: 10, examined: 5, scans: 3 },
    { id: "signing", label: "Signing", tier: 2, functions: 50, examined: 30, scans: 4 },
    { id: "boundary", label: "Trust boundary", tier: 3, functions: 137, examined: 40, scans: 2 },
    { id: "preview", label: "Approval preview", tier: 4, functions: 20, examined: 10, scans: 1 },
    { id: "build", label: "Build and release", tier: 5, functions: 2, examined: 0, scans: 0 },
  ],
};

export const REWARDS = {
  day: "2026-10-15",
  issuedAtomic: "12400000000000000",
  scanRewardAtomic: "12400000000000",
  tailScanRewardAtomic: "2480000000000",
  bountyPoolAtomic: "0",
  roundStepPercent: 10,
};

/** `files` are readable with `git show`; `ls-files` lists them plus `paths` (files the test never reads). */
export function fakeGit(
  state: { head?: string; tags?: string[]; files?: Record<string, string>; paths?: string[] } = {},
): GitRunner {
  const {
    head = COMMIT,
    tags = ["v1.4.0"],
    files = { "pkg/a.ts": SOURCE, "pkg/b.ts": SOURCE, "pkg/c.ts": SOURCE, "security/surface.txt": SURFACE },
    paths = [],
  } = state;
  return async (args) => {
    if (args[0] === "rev-parse") return `${head}\n`;
    if (args[0] === "tag") return tags.join("\n");
    if (args[0] === "ls-files") return [...Object.keys(files), ...paths].join("\n");
    if (args[0] === "show") {
      const [commit, ...file] = args[1]!.split(":");
      const text = commit === COMMIT || commit === head ? files[file.join(":")] : undefined;
      if (text === undefined) throw new Error("fatal: path does not exist");
      return text;
    }
    throw new Error(`unexpected git ${args.join(" ")}`);
  };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

export const UNKNOWN = {
  error: "No signed attestation has this id yet; sign it in Gleam from the link `pnpm scan finish` printed, then run `pnpm scan next` again.",
  code: "unknown_attestation",
  issues: [{ code: "unknown_attestation", path: "attestation", message: "No signed attestation has this id yet." }],
};

export type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

/** Answers the check with the id of what it received, as the server does. */
export const acceptCheck =
  (paidPlacesLeft = 90, paidScans = 10): Handler =>
  async (_url, init) => {
    const { attestation } = JSON.parse(String(init?.body)) as { attestation: unknown };
    const parsed = parseAttestation(attestation);
    if (!parsed.ok) return json({ code: "invalid_attestation" }, 400);
    return json({ ok: true, attestationId: await attestationId(parsed.attestation), message: "m", paidPlacesLeft, paidScans, area: "keys" });
  };

/** A points API keyed by path; `calls` collects each requested path and query. */
export function fakeApi(handlers: Record<string, Handler> = {}, calls: string[] = []): typeof fetch {
  const all: Record<string, Handler> = {
    "/scan/challenge": (url) => json(challengeFor((url.searchParams.get("area") ?? "keys") as ScanAreaId)),
    "/scan/areas": () => json(AREAS),
    "/scan/rewards": () => json(REWARDS),
    "/attestations/check": acceptCheck(),
    "/scan/next": () => json(UNKNOWN, 404),
    ...handlers,
  };
  return (async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    calls.push(`${url.pathname}${url.search}`);
    const handler = all[url.pathname];
    if (!handler) throw new Error(`no handler for ${url.pathname}`);
    return handler(url, init);
  }) as typeof fetch;
}

export function makeDeps(overrides: Partial<Deps> = {}): Deps {
  return {
    fetchImpl: fakeApi(),
    git: fakeGit(),
    root: mkdtempSync(join(tmpdir(), "gleam-scan-")),
    now: () => NOW,
    apiUrl: "https://api.test",
    siteUrl: "https://site.test/",
    ...overrides,
  };
}

export function readJsonFile(deps: Deps, file: string): unknown {
  return JSON.parse(readFileSync(join(deps.root, file), "utf8"));
}

export function exists(deps: Deps, file: string): boolean {
  return existsSync(join(deps.root, file));
}

export function put(deps: Deps, file: string, text: string): void {
  mkdirSync(dirname(join(deps.root, file)), { recursive: true });
  writeFileSync(join(deps.root, file), text);
}

export function goodAttestation(overrides: Record<string, unknown> = {}, area: ScanAreaId = "keys"): Record<string, unknown> {
  return {
    challenge: CHALLENGE_IDS[area],
    model: "claude-opus-5-5",
    answers: FUNCTIONS.map((fn, i) => ({ ...fn, line: LINES[i], check: "Rejects bad input before it is used." })),
    result: "pass",
    report: "Read the three functions and the surface; filed nothing.",
    ...overrides,
  };
}

/** What `finish` leaves: release and commit filled in. */
export const finishedAttestation = (area: ScanAreaId, overrides: Record<string, unknown> = {}) =>
  goodAttestation({ release: "1.4.0", commit: COMMIT, ...overrides }, area);

export async function idOf(attestation: Record<string, unknown>): Promise<string> {
  const parsed = parseAttestation(attestation);
  if (!parsed.ok) throw new Error("fixture attestation doesn't parse");
  return attestationId(parsed.attestation);
}

/** Writes a round folder as the commands would leave it, and makes it current. */
export function writeRound(
  deps: Deps,
  area: ScanAreaId,
  state: {
    attestation?: unknown;
    raw?: string;
    finished?: boolean;
    signed?: SignedRecord;
    startedAt?: number;
    files?: Record<string, string>;
    challenge?: unknown;
  } = {},
): void {
  const dir = `.gleam-scan/rounds/${area}`;
  put(deps, `${dir}/challenge.json`, JSON.stringify(state.challenge ?? challengeFor(area)));
  if (state.raw !== undefined || state.attestation !== undefined) put(deps, `${dir}/attestation.json`, state.raw ?? JSON.stringify(state.attestation));
  if (state.startedAt !== undefined) put(deps, `${dir}/started-at`, `${state.startedAt}\n`);
  if (state.finished) put(deps, `${dir}/finished.json`, "{}");
  if (state.signed) put(deps, `${dir}/signed.json`, JSON.stringify(state.signed));
  for (const [name, text] of Object.entries(state.files ?? {})) put(deps, `${dir}/${name}`, text);
  put(deps, ".gleam-scan/current", `${area}\n`);
}
