import type { PointsRecentEntry } from "@gleam/core";

export type RecentRow = PointsRecentEntry | { kind: "pending"; amountAtomic: string };

export interface RecentDay {
  day: "today" | "yesterday";
  totalAtomic: string;
  rows: RecentRow[];
}

const DAILY_KINDS = new Set<PointsRecentEntry["kind"]>(["holding", "invited", "founder", "invites"]);

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function credit(row: RecentRow): bigint {
  return row.kind === "pending" || !("amountAtomic" in row) ? 0n : BigInt(row.amountAtomic);
}

/**
 * Groups the server's last 48 hours into the viewer's own today and
 * yesterday, biggest credit first. A day shows only when it has a credit:
 * a friend joining or today's not-yet-settled daily points ride along at
 * the end but never make a day appear on their own. Today's daily points
 * are pending until a daily credit lands in today.
 */
export function recentDays(entries: readonly PointsRecentEntry[], now: Date, dailyRateAtomic: string): RecentDay[] {
  const today = startOfLocalDay(now);
  const yesterday = startOfLocalDay(new Date(today - 1));
  const groups: Record<RecentDay["day"], PointsRecentEntry[]> = { today: [], yesterday: [] };
  for (const entry of entries) {
    const at = new Date(entry.at).getTime();
    if (Number.isNaN(at)) continue;
    if (at >= today) groups.today.push(entry);
    else if (at >= yesterday) groups.yesterday.push(entry);
  }

  const days: RecentDay[] = [];
  for (const day of ["today", "yesterday"] as const) {
    const total = groups[day].reduce((sum, entry) => sum + credit(entry), 0n);
    if (total === 0n) continue;
    const rows: RecentRow[] = [...groups[day]].sort((a, b) => {
      const diff = credit(b) - credit(a);
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });
    if (day === "today" && BigInt(dailyRateAtomic) > 0n && !groups.today.some((entry) => DAILY_KINDS.has(entry.kind))) {
      rows.push({ kind: "pending", amountAtomic: dailyRateAtomic });
    }
    days.push({ day, totalAtomic: total.toString(), rows });
  }
  return days;
}
