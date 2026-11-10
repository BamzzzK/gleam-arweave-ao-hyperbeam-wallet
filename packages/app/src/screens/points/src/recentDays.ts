import type { PointsRecentEntry } from "@gleam/core";

export interface RecentDay {
  day: "today" | "yesterday";
  totalAtomic: string;
  rows: PointsRecentEntry[];
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function credit(row: PointsRecentEntry): bigint {
  return "amountAtomic" in row ? BigInt(row.amountAtomic) : 0n;
}

/**
 * Groups the server's last 48 hours into the viewer's own today and
 * yesterday, biggest credit first. A day shows only when it has a credit:
 * a friend joining rides along at the end but never makes a day appear on
 * its own.
 */
export function recentDays(entries: readonly PointsRecentEntry[], now: Date): RecentDay[] {
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
    const rows = [...groups[day]].sort((a, b) => {
      const diff = credit(b) - credit(a);
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });
    days.push({ day, totalAtomic: total.toString(), rows });
  }
  return days;
}
