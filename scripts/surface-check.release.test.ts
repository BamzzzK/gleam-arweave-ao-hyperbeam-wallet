// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ACKNOWLEDGED, touchedSurface, verdict } from "./surface-check.mjs";

const ENTRIES = [
  { tier: "1", path: "packages/core/src/signer/" },
  { tier: "4", path: "packages/app/src/approval/" },
  { tier: "3", path: "packages/core/src/signer/site.ts" },
];

describe("touchedSurface", () => {
  it("matches files under a directory entry and exact file entries, at the lowest tier", () => {
    expect(
      touchedSurface(["packages/core/src/signer/site.ts", "packages/app/src/approval/Root.tsx", "README.md"], ENTRIES),
    ).toEqual([
      { file: "packages/core/src/signer/site.ts", tier: 1, path: "packages/core/src/signer/" },
      { file: "packages/app/src/approval/Root.tsx", tier: 4, path: "packages/app/src/approval/" },
    ]);
  });

  it("doesn't match a sibling that only shares a prefix", () => {
    expect(touchedSurface(["packages/core/src/signer-extra.ts"], ENTRIES)).toEqual([]);
  });
});

describe("verdict", () => {
  const touched = [{ file: "packages/app/src/approval/Root.tsx", tier: 4 }];

  it("passes a PR that touches nothing on the surface", () => {
    expect(verdict([], { body: "", author: "someone" }).ok).toBe(true);
  });

  it("fails an unacknowledged surface change and names the highest tier", () => {
    const result = verdict([...touched, { file: "x", tier: 2 }], { body: "- [ ] Touches `security/surface.txt` paths", author: "someone" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("highest tier 2 (signing)");
  });

  it("passes once the box is ticked", () => {
    expect(verdict(touched, { body: "- [x] Touches `security/surface.txt` paths (fresh audit)", author: "someone" }).ok).toBe(true);
  });

  it("passes Dependabot, which can't tick a box", () => {
    expect(verdict(touched, { body: "", author: "dependabot[bot]" }).ok).toBe(true);
  });

  it("reads the box as the PR template writes it", async () => {
    const { readFileSync } = await import("node:fs");
    const template = readFileSync(new URL("../.github/PULL_REQUEST_TEMPLATE.md", import.meta.url), "utf8");
    const box = template.split("\n").find((line) => line.includes("security/surface.txt"));
    expect(box, "the template has the surface box").toBeDefined();
    expect(ACKNOWLEDGED.test(box!)).toBe(false);
    expect(ACKNOWLEDGED.test(box!.replace("[ ]", "[x]"))).toBe(true);
  });
});
