import { describe, expect, it } from "vitest";
import { SCAN_AREAS, areaOfTier, isScanAreaId, surfaceFileTiers } from "./areas";

describe("scan areas", () => {
  it("names one area per surface tier", () => {
    expect(SCAN_AREAS.map((area) => area.tier)).toEqual([1, 2, 3, 4, 5]);
    expect(areaOfTier(3).id).toBe("boundary");
    expect(isScanAreaId("keys")).toBe(true);
    expect(isScanAreaId("all")).toBe(false);
  });

  it("gives a file covered twice the lower tier and skips unscannable files", () => {
    const tiers = surfaceFileTiers(
      [
        { tier: 3, path: "src/a/" },
        { tier: 1, path: "src/a/key.ts" },
        { tier: 5, path: "wxt.config.ts" },
      ],
      ["src/a/key.ts", "src/a/page.ts", "src/a/page.test.ts", "wxt.config.ts", "README.md"],
    );
    expect([...tiers]).toEqual([
      ["src/a/key.ts", 1],
      ["src/a/page.ts", 3],
      ["wxt.config.ts", 5],
    ]);
  });
});
