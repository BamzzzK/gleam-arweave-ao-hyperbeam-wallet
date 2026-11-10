import { CHALLENGE_SIZE, SCAN_AREAS, isScanAreaId, type ScanAreaId } from "@gleam/core/src/scan/index.ts";
import type { Queryable } from "./db";
import type { ReleaseFunction } from "./github";

/** One area of a release, as `GET /scan/areas` lists it. */
export interface AreaSummary {
  id: ScanAreaId;
  label: string;
  tier: number;
  /** The area's checking functions at the release's commit. */
  functions: number;
  /** Distinct functions of the area answered by non-voided attestations. */
  examined: number;
  /** Non-voided attestations of this area. */
  scans: number;
}

export const functionKey = (fn: { file: string; symbol: string }) => `${fn.file}\n${fn.symbol}`;

/** Every function answered by a non-voided attestation of the release, by `functionKey`. */
export async function answeredFunctions(db: Queryable, release: string): Promise<Set<string>> {
  const { rows } = await db.query<{ file: string; symbol: string }>(
    `SELECT DISTINCT a->>'file' AS file, a->>'symbol' AS symbol
       FROM attestations, jsonb_array_elements(body->'answers') a
      WHERE release = $1 AND voided_at IS NULL`,
    [release],
  );
  return new Set(rows.map(functionKey));
}

/** Each area of the release in tier order, with its functions, coverage and scans. */
export async function areaSummaries(db: Queryable, release: string, functions: readonly ReleaseFunction[]): Promise<AreaSummary[]> {
  const [answered, counted] = await Promise.all([
    answeredFunctions(db, release),
    db.query<{ area: string; scans: string }>(
      "SELECT area, count(*)::text AS scans FROM attestations WHERE release = $1 AND voided_at IS NULL AND area IS NOT NULL GROUP BY area",
      [release],
    ),
  ]);
  const scans = new Map(counted.rows.map((row) => [row.area, Number(row.scans)]));
  return SCAN_AREAS.map((area) => {
    const own = functions.filter((fn) => fn.area === area.id);
    return {
      id: area.id,
      label: area.label,
      tier: area.tier,
      functions: own.length,
      examined: own.filter((fn) => answered.has(functionKey(fn))).length,
      scans: scans.get(area.id) ?? 0,
    };
  });
}

/** An area with too few functions can't be challenged, so it is never offered. */
export function canChallenge(area: AreaSummary): boolean {
  return area.functions >= CHALLENGE_SIZE;
}

/** Smallest examined share first, then lower tier. Cross-multiplied so no float decides the order. */
export function byLeastCovered(a: AreaSummary, b: AreaSummary): number {
  return a.examined * b.functions - b.examined * a.functions || a.tier - b.tier;
}

/** The areas this wallet has scanned on the release, voided scans included, as the unique key counts them. */
export async function walletAreas(db: Queryable, address: string, release: string): Promise<Set<ScanAreaId>> {
  const { rows } = await db.query<{ area: string | null }>("SELECT area FROM attestations WHERE address = $1 AND release = $2", [
    address,
    release,
  ]);
  return new Set(rows.map((row) => row.area).filter(isScanAreaId));
}

/** The areas the wallet can still scan on the release, least covered first. */
export function areasLeft(summaries: readonly AreaSummary[], scanned: ReadonlySet<ScanAreaId>): AreaSummary[] {
  return summaries.filter((area) => canChallenge(area) && !scanned.has(area.id)).sort(byLeastCovered);
}
