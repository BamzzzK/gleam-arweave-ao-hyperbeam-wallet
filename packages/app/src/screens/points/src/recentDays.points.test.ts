import { describe, expect, it } from "vitest";
import type { PointsRecentEntry } from "@gleam/core";
import { recentDays } from "./recentDays";

const NOW = new Date(2026, 10, 9, 15, 0);
const at = (day: number, hour: number) => new Date(2026, 10, day, hour).toISOString();

describe("recentDays", () => {
  it("groups by the viewer's day, biggest first, and drops anything before yesterday", () => {
    const entries: PointsRecentEntry[] = [
      { kind: "scan", amountAtomic: "250", at: at(9, 10), release: "1.42.0" },
      { kind: "holding", amountAtomic: "8", at: at(8, 2) },
      { kind: "invites", amountAtomic: "80", at: at(8, 2) },
      { kind: "holding", amountAtomic: "70", at: at(7, 23) },
    ];

    const days = recentDays(entries, NOW);

    expect(days.map((day) => [day.day, day.totalAtomic, day.rows.map((row) => row.kind)])).toEqual([
      ["today", "250", ["scan"]],
      ["yesterday", "88", ["invites", "holding"]],
    ]);
  });

  it("shows no day that has only a friend joining", () => {
    expect(recentDays([{ kind: "friendJoined", at: at(9, 9) }], NOW)).toEqual([]);
  });

  it("shows nothing without activity", () => {
    expect(recentDays([], NOW)).toEqual([]);
  });

  it("keeps a friend joining after the credits", () => {
    const days = recentDays(
      [
        { kind: "friendJoined", at: at(8, 9) },
        { kind: "holding", amountAtomic: "80", at: at(8, 2) },
      ],
      NOW,
    );

    expect(days[0]!.rows.map((row) => row.kind)).toEqual(["holding", "friendJoined"]);
  });
});
