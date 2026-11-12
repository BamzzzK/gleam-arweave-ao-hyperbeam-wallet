import { describe, expect, it } from "vitest";
import { paidPlacesFor, roundReward, scanRewardOf } from "./rewards";

describe("scan rewards", () => {
  it("opens one paid place per 3 unexamined functions, from 1 to 100", () => {
    expect(paidPlacesFor(0)).toBe(1);
    expect(paidPlacesFor(3)).toBe(1);
    expect(paidPlacesFor(4)).toBe(2);
    expect(paidPlacesFor(31)).toBe(11);
    expect(paidPlacesFor(150)).toBe(50);
    expect(paidPlacesFor(300)).toBe(100);
    expect(paidPlacesFor(594)).toBe(100);
  });

  it("truncates 0.1% of the day's issued points", () => {
    expect(scanRewardOf(1_243_332n)).toBe(1243n);
    expect(scanRewardOf(0n)).toBe(0n);
  });

  it("adds 10% of the base per round after the first", () => {
    expect(roundReward(1000n, 1)).toBe(1000n);
    expect(roundReward(1000n, 2)).toBe(1100n);
    expect(roundReward(1243n, 5)).toBe(1740n);
    expect(() => roundReward(1000n, 0)).toThrow();
  });
});
