import { useCallback, useEffect, useState } from "react";
import type { Grant, RuntimePort } from "@gleam/core";
import { NetworkErrorBanner, SkeletonRow } from "@gleam/ui/src/components/wallet/index.ts";
import { EmptyState } from "@gleam/ui/src/primitives/empty-state.tsx";
import { ScreenHeader } from "@gleam/ui/src/primitives/screen-header.tsx";
import { useT, type TFunction } from "../../../i18n";
import { errorText } from "../../../i18n/errors";

/**
 * Per-origin grant list with scope + expiry inline (never hidden behind
 * a detail tap). "Revoke" (never "disconnect") actually ends access via
 * `ProtocolMap.revokeGrant`, not just hiding the row.
 *
 * Not yet wired into `App.tsx`'s view-switch — this view module is
 * complete and independently mountable, following the same shape
 * `OnboardingView`/`SendView` use for the same reason.
 *
 * Uses the shared `SkeletonRow`/`NetworkErrorBanner` (already used by
 * main-screen/activity) instead of an ad hoc loading/error primitive.
 */
export interface ConnectedAppsViewProps {
  runtime: RuntimePort;
  onBack: () => void;
  /** The site the user came from in the browser: its entry is listed first and set apart. */
  highlightOrigin?: string;
}

function hostnameOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

function canRequestPayments(grant: Grant): boolean {
  return grant.permissions.some((permission) => permission === "SIGN_TRANSACTION" || permission === "DISPATCH");
}

function scopeSummary(grant: Grant, t: TFunction): string {
  if (canRequestPayments(grant)) return t("connectedApps.scopePayments");
  if (grant.permissions.length > 1) return t("connectedApps.scopeMore");
  return t("connectedApps.scopeAddress");
}

function expirySummary(grant: Grant, t: TFunction): string {
  if (grant.expiresAt === null) return t("connectedApps.noExpiry");
  const daysLeft = Math.max(0, Math.ceil((grant.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
  return t(daysLeft === 1 ? "connectedApps.expiresOneDay" : "connectedApps.expiresDays", { days: daysLeft });
}

export function ConnectedAppsView({ runtime, onBack, highlightOrigin }: ConnectedAppsViewProps) {
  const t = useT();
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const result = await runtime.send<void, Grant[]>({ type: "getConnectedApps", payload: undefined });
      setGrants(result);
    } catch (loadError) {
      setError(errorText(loadError));
    }
  }, [runtime]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRevoke = async (origin: string) => {
    await runtime.send<{ origin: string }, void>({ type: "revokeGrant", payload: { origin } });
    await load();
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title={t("connectedApps.title")} onBack={onBack} />
      {error ? <NetworkErrorBanner onRetry={() => void load()} /> : null}
      <div className="flex flex-1 flex-col px-5 py-4">
        {grants === null ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : grants.length === 0 ? (
          <EmptyState message={t("connectedApps.empty")} />
        ) : (
          <div className="flex flex-col">
            {[...grants].sort((a, b) => Number(b.origin === highlightOrigin) - Number(a.origin === highlightOrigin)).map((grant) => (
              <div
                key={grant.origin}
                className={`flex items-start gap-3 py-3.5 ${grant.origin === highlightOrigin ? "-mx-3 rounded-xl bg-mist px-3" : ""}`}
              >
                <div className="mt-px flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-line bg-mist text-label font-bold text-muted">
                  {hostnameOf(grant.origin).charAt(0).toUpperCase()}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-label font-semibold text-foreground">
                      {hostnameOf(grant.origin)}
                    </span>
                  </div>
                  <span className="font-mono text-caption text-faint">{hostnameOf(grant.origin)}</span>
                  <span className="text-label leading-snug text-muted">{scopeSummary(grant, t)}</span>
                  <span className="text-caption text-faint">{expirySummary(grant, t)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRevoke(grant.origin)}
                  className="mt-px flex-shrink-0 rounded-md border border-line bg-background px-3 py-1.5 text-label font-semibold text-foreground hover:border-warning hover:text-warning"
                >
                  {t("connectedApps.revoke")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
