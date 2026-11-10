import { isScannablePath, type SurfaceEntry, type SurfaceTier } from "./surface";

/**
 * A scan covers one area of a release: the surface files of one tier. A
 * wallet may scan each area of a release once, so a contributor with the
 * budget can run a round per area instead of stopping after one scan.
 */
export const SCAN_AREAS = [
  { id: "keys", tier: 1, label: "Key material" },
  { id: "signing", tier: 2, label: "Signing" },
  { id: "boundary", tier: 3, label: "Trust boundary" },
  { id: "preview", tier: 4, label: "Approval preview" },
  { id: "build", tier: 5, label: "Build and release" },
] as const satisfies readonly { id: string; tier: SurfaceTier; label: string }[];

export type ScanArea = (typeof SCAN_AREAS)[number];
export type ScanAreaId = ScanArea["id"];

export function isScanAreaId(value: unknown): value is ScanAreaId {
  return typeof value === "string" && SCAN_AREAS.some((area) => area.id === value);
}

export function scanArea(id: ScanAreaId): ScanArea {
  return SCAN_AREAS.find((area) => area.id === id)!;
}

export function areaOfTier(tier: SurfaceTier): ScanArea {
  return SCAN_AREAS.find((area) => area.tier === tier)!;
}

/**
 * The tier of each scannable surface file. A file several entries cover
 * (a directory and a file inside it) takes the lowest tier, the one with
 * the worst outcome.
 */
export function surfaceFileTiers(entries: readonly SurfaceEntry[], repoPaths: readonly string[]): Map<string, SurfaceTier> {
  const tiers = new Map<string, SurfaceTier>();
  for (const path of repoPaths) {
    if (!isScannablePath(path)) continue;
    for (const entry of entries) {
      const covers = entry.path.endsWith("/") ? path.startsWith(entry.path) : path === entry.path;
      const current = tiers.get(path);
      if (covers && (current === undefined || entry.tier < current)) tiers.set(path, entry.tier);
    }
  }
  return tiers;
}
