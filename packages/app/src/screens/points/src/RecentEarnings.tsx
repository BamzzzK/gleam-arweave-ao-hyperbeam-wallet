import type { PointsRecentEntry } from "@gleam/core";
import { cn } from "@gleam/ui/src/primitives/cn.ts";
import { useT } from "../../../i18n";
import { formatPoints } from "./formatPoints";
import { recentDays, type RecentRow } from "./recentDays";

/** Each source keeps one beam color, the way the invite seats use them. */
const SOURCE_COLOR: Partial<Record<RecentRow["kind"], string>> = {
  holding: "var(--color-beam-sky)",
  invited: "var(--color-beam-purple)",
  invites: "var(--color-beam-purple)",
  founder: "var(--color-beam-green)",
  scan: "var(--color-beam-yellow)",
  finding: "var(--color-beam-red)",
};

function pullRequestNumber(ref: string | null): string | null {
  return ref?.match(/\/pull\/(\d+)/)?.[1] ?? null;
}

/** Today's and yesterday's credits by source. Renders nothing when neither day has one. */
export function RecentEarnings({
  entries,
  dailyRateAtomic,
  referralPercent,
  friends,
  now = new Date(),
}: {
  entries: readonly PointsRecentEntry[];
  dailyRateAtomic: string;
  referralPercent: number;
  friends: number;
  now?: Date;
}) {
  const t = useT();
  const days = recentDays(entries, now, dailyRateAtomic);
  if (days.length === 0) return null;

  const label = (row: RecentRow): { title: string; detail: string | null } => {
    switch (row.kind) {
      case "holding":
        return { title: t("points.sourceHolding"), detail: t("points.sourceHoldingDetail") };
      case "invited":
        return { title: t("points.sourceInvited"), detail: null };
      case "founder":
        return { title: t("points.sourceFounder"), detail: null };
      case "invites":
        return {
          title: t("points.sourceInvites"),
          detail: t(friends === 1 ? "points.friendsOne" : "points.friendsMany", { count: friends, percent: referralPercent }),
        };
      case "scan":
        return { title: t("points.sourceScan"), detail: `v${row.release}` };
      case "finding": {
        const pr = pullRequestNumber(row.ref);
        return { title: t("points.sourceFinding"), detail: pr ? `${t("points.sourcePr", { number: pr })} · v${row.release}` : `v${row.release}` };
      }
      case "friendJoined":
        return { title: t("points.sourceFriendJoined"), detail: t("points.sourceFriendJoinedDetail", { percent: referralPercent }) };
      case "pending":
        return { title: t("points.sourceDaily"), detail: t("points.sourceDailyDetail") };
    }
  };

  return (
    <section aria-labelledby="points-recent" className="flex flex-col gap-4">
      <h2 id="points-recent" className="text-h3 font-semibold text-foreground">
        {t("points.recent")}
      </h2>
      {days.map((day) => (
        <section key={day.day} aria-label={t(`points.${day.day}`)} className="flex flex-col gap-2">
          <h3 className="flex justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
            <span>{t(`points.${day.day}`)}</span>
            <span className="tabular-nums tracking-normal">+{formatPoints(day.totalAtomic)}</span>
          </h3>
          <ul className="flex flex-col gap-2">
            {day.rows.map((row, index) => {
              const { title, detail } = label(row);
              const color = SOURCE_COLOR[row.kind];
              const href = row.kind === "finding" && row.ref?.startsWith("https://") ? row.ref : null;
              const amount =
                row.kind === "friendJoined" ? null : row.kind === "pending" ? `~${formatPoints(row.amountAtomic)}` : `+${formatPoints(row.amountAtomic)}`;
              const body = (
                <>
                  <span
                    aria-hidden="true"
                    className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[2px]", !color && "border border-faint")}
                    style={color ? { backgroundColor: color } : undefined}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body font-semibold text-foreground">
                      {title}
                      {href ? <span aria-hidden="true" className="ml-1 font-normal text-faint">↗</span> : null}
                    </span>
                    {detail ? <span className="text-label text-muted">{detail}</span> : null}
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap text-body tabular-nums",
                      row.kind === "pending" || amount === null ? "text-faint" : "font-semibold text-foreground",
                    )}
                  >
                    {amount ?? "—"}
                  </span>
                </>
              );
              return (
                <li key={`${row.kind}-${"at" in row ? row.at : "pending"}-${index}`}>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer" className="-mx-2 flex gap-3 rounded-md px-2 py-1 hover:bg-mist">
                      {body}
                    </a>
                  ) : (
                    <div className="flex gap-3 py-1">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
