import { describe, expect, it } from "vitest";
import { nextScanIsFull, paidPlacesFor, roundReward, scanRewards } from "./rewards";

describe("scan rewards", () => {
  it("pays the full reward to a release's first 20 paid scans", () => {
    expect(nextScanIsFull(0)).toBe(true);
    expect(nextScanIsFull(19)).toBe(true);
    expect(nextScanIsFull(20)).toBe(false);
    expect(nextScanIsFull(99)).toBe(false);
  });

  it("opens one paid place per 3 unexamined functions, from 10 to 100", () => {
    expect(paidPlacesFor(0)).toBe(10);
    expect(paidPlacesFor(30)).toBe(10);
    expect(paidPlacesFor(31)).toBe(11);
    expect(paidPlacesFor(150)).toBe(50);
    expect(paidPlacesFor(300)).toBe(100);
    expect(paidPlacesFor(594)).toBe(100);
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
