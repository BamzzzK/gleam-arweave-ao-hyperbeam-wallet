import type { RuntimePort } from "@gleam/core";
import { releaseUrl, sitePageUrl } from "@gleam/core";
import { useT } from "../../../i18n";
import { useScanStats } from "../../points/src/useScanStats";

export interface AboutBuildProps {
  runtime: RuntimePort;
  version: string;
}

/** Lets a user match the installed build to a public release. */
export function AboutBuild({ runtime, version }: AboutBuildProps) {
  const t = useT();
  const scanStats = useScanStats(runtime);
  const count = scanStats.data?.total;
  return (
    <div className="flex flex-col gap-1 pt-3 text-caption text-muted">
      <div className="flex items-center justify-between gap-3">
        <span>{t("settingsHome.version", { version })}</span>
        <a href={releaseUrl(version)} target="_blank" rel="noreferrer" className="text-foreground underline phone:flex phone:min-h-11 phone:items-center">
          {t("settingsHome.viewRelease")}
        </a>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span>{t("settingsHome.securityReviews")}</span>
        <a href={sitePageUrl("review-results", version)} target="_blank" rel="noreferrer" className="text-foreground underline phone:flex phone:min-h-11 phone:items-center">
          {typeof count === "number"
            ? t(count === 1 ? "settingsHome.oneReview" : "settingsHome.manyReviews", { count })
            : t("settingsHome.viewReviews")}
        </a>
      </div>
    </div>
  );
}
