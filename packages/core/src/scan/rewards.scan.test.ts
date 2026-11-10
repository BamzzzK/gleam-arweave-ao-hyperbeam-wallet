import { describe, expect, it } from "vitest";
import { nextScanIsFull, roundReward, scanRewards } from "./rewards";

describe("scan rewards", () => {
  it("pays the full reward to the first 20 of 100 paid places", () => {
    expect(nextScanIsFull(100)).toBe(true);
    expect(nextScanIsFull(81)).toBe(true);
    expect(nextScanIsFull(80)).toBe(false);
    expect(nextScanIsFull(1)).toBe(false);
  });

  it("truncates 0.1% and 0.02% of the day's issued points", () => {
    expect(scanRewards(1_243_332n)).toEqual({ fullAtomic: 1243n, tailAtomic: 248n });
    expect(scanRewards(0n)).toEqual({ fullAtomic: 0n, tailAtomic: 0n });
  });

  it("adds 10% of the base per round after the first", () => {
    expect(roundReward(1000n, 1)).toBe(1000n);
    expect(roundReward(1000n, 2)).toBe(1100n);
    expect(roundReward(1243n, 5)).toBe(1740n);
    expect(() => roundReward(1000n, 0)).toThrow();
  });
});
