import { SITE_URL } from "@gleam/core";
import { t } from "./i18n";

export function inviteLinkFor(inviteCode: string): string {
  const url = new URL("invite.html", SITE_URL);
  url.searchParams.set("c", inviteCode);
  return url.toString();
}

export function invitesLine(seats: number): string {
  if (seats <= 0) return t("points.invitesUsed");
  return t(seats === 1 ? "points.invitesHaveOne" : "points.invitesHaveMany", { count: seats });
}

/** The Points screen's count, where "remaining" fits because seats run down as friends use them. */
export function invitesRemainingLine(seats: number): string {
  if (seats <= 0) return t("points.invitesUsed");
  return t(seats === 1 ? "points.invitesRemainingOne" : "points.invitesRemainingMany", { count: seats });
}
