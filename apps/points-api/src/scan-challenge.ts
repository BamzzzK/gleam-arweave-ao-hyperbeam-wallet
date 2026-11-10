import { randomBytes } from "node:crypto";
import {
  CHALLENGE_SIZE,
  SCAN_AREAS,
  isScanAreaId,
  pickChallenge,
  scanArea,
  type ChallengeFunction,
  type ScanAreaId,
} from "@gleam/core/src/scan/index.ts";
import type { Queryable } from "./db";
import { GithubUnavailableError, type GithubClient } from "./github";
import { answeredFunctions, areaSummaries, canChallenge, functionKey } from "./scan-areas";
import { GITHUB_UNAVAILABLE, NO_RELEASE, failure, type ScanFailure } from "./scan-errors";

export const CHALLENGE_TTL_MS = 24 * 3_600_000;
/** Unused challenges are kept a day past expiry, then dropped when the next one is issued. */
const PURGE_AFTER_MS = 24 * 3_600_000;

export interface IssuedChallenge {
  challenge: string;
  release: string;
  commit: string;
  area: ScanAreaId;
  functions: ChallengeFunction[];
  expiresAt: string;
}

/** `GET /scan/challenge`'s query: the area to scan, or null to let the server pick. */
export function parseChallengeQuery(query: { area?: string }): { area: ScanAreaId | null } | ScanFailure {
  if (query.area === undefined) return { area: null };
  if (isScanAreaId(query.area)) return { area: query.area };
  return failure(400, "malformed_request", "area", `area must be one of ${SCAN_AREAS.map((area) => area.id).join(", ")}.`);
}

/**
 * Draws a challenge from one area's functions, the first of them from those
 * no scan of the release has examined yet. Without an area it takes the one
 * with the fewest scans (ties go to the lower tier), among areas with enough
 * functions to challenge.
 */
export async function issueChallenge(
  db: Queryable,
  github: GithubClient,
  now: Date,
  requested: ScanAreaId | null = null,
): Promise<{ ok: true; challenge: IssuedChallenge } | ScanFailure> {
  try {
    const latest = await github.latestRelease();
    if (!latest) return NO_RELEASE;
    const { functions } = await github.filesAt(latest.commit);

    let area: ScanAreaId;
    if (requested) {
      if (functions.filter((fn) => fn.area === requested).length < CHALLENGE_SIZE) {
        return failure(
          503,
          "challenge_unavailable",
          "area",
          `The ${scanArea(requested).label} area of v${latest.release} has fewer than ${CHALLENGE_SIZE} security functions to ask about; scan another area.`,
        );
      }
      area = requested;
    } else {
      const open = (await areaSummaries(db, latest.release, functions)).filter(canChallenge);
      const quietest = open.sort((a, b) => a.scans - b.scans || a.tier - b.tier)[0];
      if (!quietest) {
        return failure(
          503,
          "challenge_unavailable",
          "$",
          `v${latest.release} has fewer than ${CHALLENGE_SIZE} security functions to ask about in any area; tell the maintainers, since scans can't start until it does.`,
        );
      }
      area = quietest.id;
    }

    const pool = functions.filter((fn) => fn.area === area);
    const answered = await answeredFunctions(db, latest.release);
    const unexamined = pool.filter((fn) => !answered.has(functionKey(fn)));
    const picked = await pickChallenge(pool, randomBytes(32), unexamined);
    const id = randomBytes(24).toString("base64url");
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
    await db.query(
      "DELETE FROM challenges WHERE expires_at < $1 AND used_by_attestation IS NULL AND NOT EXISTS (SELECT 1 FROM attestations a WHERE a.challenge_id = challenges.id)",
      [new Date(now.getTime() - PURGE_AFTER_MS)],
    );
    await db.query(
      "INSERT INTO challenges (id, release, commit, functions, created_at, expires_at, area) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [id, latest.release, latest.commit, JSON.stringify(picked), now, expiresAt, area],
    );
    return {
      ok: true,
      challenge: { challenge: id, release: latest.release, commit: latest.commit, area, functions: picked, expiresAt: expiresAt.toISOString() },
    };
  } catch (error) {
    if (error instanceof GithubUnavailableError) return GITHUB_UNAVAILABLE;
    throw error;
  }
}
