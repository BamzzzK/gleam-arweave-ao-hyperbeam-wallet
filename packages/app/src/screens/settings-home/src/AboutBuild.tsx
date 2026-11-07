import type { ReactNode } from "react";
import type { RuntimePort } from "@gleam/core";
import { releaseUrl, sitePageUrl } from "@gleam/core";
import { useT } from "../../../i18n";
import { useScanStats } from "../../points/src/useScanStats";

export interface AboutBuildProps {
  runtime: RuntimePort;
  version: string;
}

/** Lets a user match the installed build to a public release and its reviews. */
export function AboutBuild({ runtime, version }: AboutBuildProps) {
  const t = useT();
  const scanStats = useScanStats(runtime);
  const count = scanStats.data?.total;
  return (
    <div className="mt-auto flex flex-wrap items-center justify-center gap-x-2 text-caption text-muted">
      <ExternalLink href={releaseUrl(version)}>{t("settingsHome.version", { version })}</ExternalLink>
      <span aria-hidden="true">·</span>
      <ExternalLink href={sitePageUrl("review-results", version)}>
        {typeof count === "number"
          ? t(count === 1 ? "settingsHome.oneReview" : "settingsHome.manyReviews", { count })
          : t("settingsHome.securityReviews")}
      </ExternalLink>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1 py-1 hover:text-foreground hover:underline phone:min-h-11"
    >
      {children}
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 17 7M8 7h9v9" />
      </svg>
    </a>
  );
}
