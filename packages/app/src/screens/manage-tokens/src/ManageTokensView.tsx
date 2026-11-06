import { useCallback, useEffect, useRef, useState } from "react";
import { truncateAddress } from "@gleam/ui/src/format/truncate-address.ts";
import { useQueryClient } from "@tanstack/react-query";
import type { RuntimePort, TokenBalance } from "@gleam/core";
import { NetworkErrorBanner, TokenGlyph } from "@gleam/ui/src/components/wallet/index.ts";
import { Button } from "@gleam/ui/src/primitives/button.tsx";
import { ScreenHeader } from "@gleam/ui/src/primitives/screen-header.tsx";
import { useT } from "../../../i18n";
import { displayTicker, formatAtomicAsDisplay } from "../../main-screen/src/formatWinston";
import { walletQueryKeys } from "../../activity/src/queryKeys";
import { errorText } from "../../../i18n/errors";

/**
 * Reached from Settings. AR and AO aren't listed: they can't be removed,
 * only hidden on the main screen. Tokens the wallet has received show
 * up on their own ("Found in your wallet") and can be hidden; adding by id
 * is for a token the wallet hasn't received yet.
 */
export interface ManageTokensViewProps {
  runtime: RuntimePort;
  address: string;
  onBack: () => void;
}

const PROCESS_ID = /^[A-Za-z0-9_-]{43}$/;

interface LoadState {
  processIds: string[];
  discovered: TokenBalance[];
  balances: Map<string, TokenBalance>;
  loading: boolean;
  error: string | null;
}

export function ManageTokensView({ runtime, address, onBack }: ManageTokensViewProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const [state, setState] = useState<LoadState>({
    processIds: [],
    discovered: [],
    balances: new Map(),
    loading: true,
    error: null,
  });
  const [newProcessId, setNewProcessId] = useState("");
  const [preview, setPreview] = useState<TokenBalance | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // The id in the field now, so a preview that resolves after the field changed is dropped.
  const currentIdRef = useRef("");

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [processIds, tokenBalances] = await Promise.all([
        runtime.send<{ address: string }, string[]>({ type: "getWatchedTokens", payload: { address } }),
        runtime.send<{ address: string }, TokenBalance[]>({ type: "getTokenBalances", payload: { address } }),
      ]);
      const balances = new Map(tokenBalances.map((balance) => [balance.processId, balance]));
      const discovered = tokenBalances.filter((balance) => balance.source === "discovered");
      setState({ processIds, discovered, balances, loading: false, error: null });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorText(error),
      }));
    }
  }, [runtime, address]);

  useEffect(() => {
    void load();
  }, [load]);

  const invalidateBalances = () => {
    void queryClient.invalidateQueries({ queryKey: walletQueryKeys.balances(address) });
  };

  const handlePreview = async (processId: string) => {
    if (!PROCESS_ID.test(processId)) {
      setAddError(t("manageTokens.badIdLength", { length: processId.length }));
      return;
    }
    if (state.processIds.includes(processId) || state.discovered.some((token) => token.processId === processId)) {
      setAddError(t("manageTokens.alreadyListed"));
      return;
    }

    setAddError(null);
    setPreviewing(true);
    setPreview(null);
    try {
      const balance = await runtime.send<{ address: string; processId: string }, TokenBalance>({
        type: "previewWatchedToken",
        payload: { address, processId },
      });
      if (currentIdRef.current === processId) setPreview(balance);
    } catch (error) {
      if (currentIdRef.current === processId) setAddError(errorText(error));
    } finally {
      if (currentIdRef.current === processId) setPreviewing(false);
    }
  };

  const handleConfirmAdd = async () => {
    if (!preview) return;
    setAdding(true);
    try {
      await runtime.send<{ address: string; processId: string }, TokenBalance>({
        type: "addWatchedToken",
        payload: { address, processId: preview.processId },
      });
      setState((prev) => ({
        ...prev,
        processIds: [...prev.processIds, preview.processId],
        balances: new Map(prev.balances).set(preview.processId, preview),
      }));
      invalidateBalances();
      setPreview(null);
      setNewProcessId("");
    } catch (error) {
      setAddError(errorText(error));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (processId: string) => {
    setRemovingId(processId);
    try {
      await runtime.send<{ address: string; processId: string }, void>({
        type: "removeWatchedToken",
        payload: { address, processId },
      });
      setState((prev) => ({
        ...prev,
        processIds: prev.processIds.filter((id) => id !== processId),
        discovered: prev.discovered.filter((token) => token.processId !== processId),
      }));
      invalidateBalances();
      if (preview?.processId === processId) setPreview(null);
    } catch (error) {
      setState((prev) => ({ ...prev, error: errorText(error) }));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title={t("manageTokens.title")} onBack={onBack} />
      {state.error ? <NetworkErrorBanner onRetry={() => void load()} /> : null}

      <div className="flex flex-1 flex-col px-6 phone:px-5 pb-6 pt-9 phone:pt-4">
        <div>
          <div className="pb-1 text-label font-semibold uppercase tracking-[0.04em] text-muted">
            {t("manageTokens.watched")}
          </div>
          <div>
            {state.loading ? (
              <TokenSkeletonRow />
            ) : state.processIds.length === 0 ? (
              <p className="py-3.5 text-caption text-faint">
                {t("manageTokens.none")}
              </p>
            ) : (
              state.processIds.map((processId) => {
                const balance = state.balances.get(processId);
                return (
                  <div key={processId} className="flex items-center gap-2.5 py-3.5">
                    {balance?.logoUrl ? (
                      <TokenGlyph label={balance.ticker.slice(0, 2).toUpperCase()} tone={2} logoUrl={balance.logoUrl} />
                    ) : null}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-label font-semibold text-foreground">
                        {balance ? displayTicker(balance.ticker) : t("manageTokens.unavailable")}
                      </span>
                      <span className="truncate font-mono text-caption text-muted">{truncateAddress(processId, 6)}</span>
                    </span>
                    {balance ? (
                      <span
                        className="flex-shrink-0 font-mono text-label text-muted"
                        title={balance.available === false && balance.unavailableReason ? errorText(balance.unavailableReason) : undefined}
                      >
                        {balance.available === false ? t("manageTokens.unavailable") : formatAtomicAsDisplay(balance.quantity, balance.denomination)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={t("manageTokens.remove", { token: balance?.ticker ?? processId })}
                      disabled={removingId === processId}
                      onClick={() => void handleRemove(processId)}
                      className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-md text-faint hover:bg-mist hover:text-warning disabled:opacity-60"
                    >
                      <RemoveIcon />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {state.discovered.length > 0 ? (
          <div className="pt-10">
            <div className="pb-1 text-label font-semibold uppercase tracking-[0.04em] text-muted">
              {t("manageTokens.found")}
            </div>
            {state.discovered.map((token) => (
              <div key={token.processId} className="flex items-center gap-2.5 py-3.5">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-label font-semibold text-foreground">{token.ticker}</span>
                  <span className="truncate font-mono text-caption text-muted">{truncateAddress(token.processId, 6)}</span>
                </span>
                <span className="flex-shrink-0 font-mono text-label text-muted">
                  {formatAtomicAsDisplay(token.quantity, token.denomination)}
                </span>
                <button
                  type="button"
                  aria-label={t("manageTokens.ignore", { token: token.ticker })}
                  disabled={removingId === token.processId}
                  onClick={() => void handleRemove(token.processId)}
                  className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-md text-faint hover:bg-mist hover:text-warning disabled:opacity-60"
                >
                  <RemoveIcon />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="pt-10">
          <div className="pb-1 text-label font-semibold uppercase tracking-[0.04em] text-muted">
            {t("manageTokens.add")}
          </div>
          <div className="flex flex-col gap-2 py-3.5">
            <input
              type="text"
              placeholder={t("manageTokens.placeholder")}
              value={newProcessId}
              onChange={(event) => {
                const processId = event.target.value.trim();
                currentIdRef.current = processId;
                setNewProcessId(event.target.value);
                setAddError(null);
                setPreview(null);
                setPreviewing(false);
                // A whole id previews at once, pasted or typed; anything shorter waits for blur to explain itself.
                if (PROCESS_ID.test(processId)) void handlePreview(processId);
              }}
              onBlur={() => {
                const processId = newProcessId.trim();
                if (processId.length > 0 && !PROCESS_ID.test(processId)) void handlePreview(processId);
              }}
              className="w-full rounded-md border border-line bg-background px-3 py-2 font-mono text-label text-foreground focus:border-foreground focus:outline-none"
            />
            {addError ? (
              <span role="alert" className="text-caption text-warning">
                {addError}
              </span>
            ) : null}
            {previewing ? <TokenSkeletonRow className="py-1" /> : null}
            {preview ? (
              <div className="flex flex-col gap-1 py-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5 text-label font-semibold text-foreground">
                    {preview.logoUrl ? (
                      <TokenGlyph label={preview.ticker.slice(0, 2).toUpperCase()} tone={2} logoUrl={preview.logoUrl} />
                    ) : null}
                    <span className="truncate">
                      {displayTicker(preview.ticker)}
                      {preview.name && preview.name !== preview.ticker ? (
                        <span className="font-normal text-muted"> · {preview.name}</span>
                      ) : null}
                    </span>
                  </span>
                  <span className="flex-shrink-0 font-mono text-label text-muted">
                    {preview.available === false ? t("manageTokens.unavailable") : formatAtomicAsDisplay(preview.quantity, preview.denomination)}
                  </span>
                </div>
                {preview.available === false ? (
                  <div className="flex flex-col gap-2 text-caption leading-snug text-muted" title={preview.unavailableReason ? errorText(preview.unavailableReason) : undefined}>
                    <p>{t("manageTokens.unreadable")}</p>
                    <p>{t("manageTokens.unreadableAdd")}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {preview ? (
              <Button className="mt-1" disabled={adding} onClick={() => void handleConfirmAdd()}>
                {adding
                  ? t("manageTokens.adding")
                  : preview.ticker === preview.processId
                    ? t("manageTokens.addToken")
                    : t("manageTokens.addNamed", { token: preview.ticker })}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function RemoveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Shaped like the rows on this screen (no glyph, no divider), with each
 * bar as tall as the text line it stands in for, so nothing moves when
 * the real row replaces it.
 */
function TokenSkeletonRow({ className = "py-3.5" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="w-16 rounded-md text-label gleam-shimmer">&nbsp;</span>
        <span className="w-28 rounded-md text-caption gleam-shimmer">&nbsp;</span>
      </span>
      <span className="w-12 rounded-md text-label gleam-shimmer">&nbsp;</span>
    </div>
  );
}
