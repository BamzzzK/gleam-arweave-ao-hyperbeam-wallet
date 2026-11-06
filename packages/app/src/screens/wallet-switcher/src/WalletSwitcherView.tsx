import { useCallback, useEffect, useState } from "react";
import type { RuntimePort, WalletState, WalletSummary } from "@gleam/core";
import { AccountAvatar, MemorableAddress, NetworkErrorBanner, SkeletonRow } from "@gleam/ui/src/components/wallet/index.ts";
import { ScreenHeader } from "@gleam/ui/src/primitives/screen-header.tsx";
import { useAddressIdentity } from "../../../address-identity";
import { useCopy } from "../../points/src/useCopy";
import { useT } from "../../../i18n";
import { errorText } from "../../../i18n/errors";

// JWK is what nearly every wallet is, so only the other methods get a label.
// The label sits inside the name's truncating span, so a narrow row cuts
// the label before the name. Hardware brands stay untranslated.
const WALLET_METHOD_LABEL: Record<Exclude<WalletSummary["method"], "watch">, string | null> = {
  jwk: null,
  ethereum: "Ethereum",
  ledger: "Ledger",
  keystone: "Keystone",
};

/**
 * The sheet opened from the main screen's account pill. Lists every stored
 * wallet from `getState()` in saved order, marks the active one with a
 * green checkmark, and
 * switches on tap via `switchWallet`.
 *
 * "Add wallet" hands off to the add-wallet flow through `onAddWallet`. The
 * per-row "manage" chevron opens the wallet detail screen (rename/back up)
 * through `onManage`.
 *
 * Each wallet's row uses the same dicebear identicon as the main screen's
 * account pill (`AccountAvatar` + `src/account-avatar.ts`'s
 * `avatarSvg`, keyed on `wallet.address`, computed locally
 * with no network call) so the same wallet shows the same identity mark on
 * both screens.
 */
export interface WalletSwitcherViewProps {
  runtime: RuntimePort;
  onSwitched: (walletId: string) => void;
  onBack: () => void;
  onAddWallet: () => void;
  onManage: (walletId: string) => void;
}

interface LoadState {
  wallets: WalletSummary[];
  activeWalletId: string | null;
  loading: boolean;
  error: string | null;
}

export function WalletSwitcherView({ runtime, onSwitched, onBack, onAddWallet, onManage }: WalletSwitcherViewProps) {
  const t = useT();
  const [state, setState] = useState<LoadState>({
    wallets: [],
    activeWalletId: null,
    loading: true,
    error: null,
  });
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await runtime.send<void, WalletState>({ type: "getState", payload: undefined });
      setState({
        wallets: result.wallets,
        activeWalletId: result.activeWalletId,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorText(error),
      }));
    }
  }, [runtime]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSwitch = async (walletId: string) => {
    if (walletId === state.activeWalletId) return;
    setSwitchingId(walletId);
    try {
      await runtime.send<{ walletId: string }, void>({ type: "switchWallet", payload: { walletId } });
      onSwitched(walletId);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: errorText(error),
      }));
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <div className="flex min-h-full flex-col" role="dialog" aria-label={t("walletSwitcher.switchWallet")}>
      {state.error ? <NetworkErrorBanner onRetry={() => void load()} /> : null}

      <ScreenHeader title={t("walletSwitcher.wallets")} onBack={onBack} />

      <div className="px-6 phone:px-5 pb-3 pt-9 phone:pt-4">
        <div>
          {state.loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : (
            // Saved order, never active-first: a list that reshuffles on every switch loses people.
            state.wallets.map((wallet) => (
              <WalletSwitcherRow
                key={wallet.id}
                wallet={wallet}
                active={wallet.id === state.activeWalletId}
                switching={switchingId === wallet.id}
                onSwitch={() => void handleSwitch(wallet.id)}
                onManage={() => onManage(wallet.id)}
              />
            ))
          )}
        </div>

        <button
          type="button"
          onClick={onAddWallet}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-mist"
        >
          <span
            aria-hidden="true"
            className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-2xl border border-dashed border-line text-muted"
          >
            <PlusIcon />
          </span>
          <span className="text-label font-semibold text-foreground">{t("walletSwitcher.addWallet")}</span>
        </button>
      </div>
    </div>
  );
}

interface WalletSwitcherRowProps {
  wallet: WalletSummary;
  active: boolean;
  switching: boolean;
  onSwitch: () => void;
  onManage: () => void;
}

function WalletSwitcherRow({ wallet, active, switching, onSwitch, onManage }: WalletSwitcherRowProps) {
  const t = useT();
  const identity = useAddressIdentity();
  const avatarSvg = identity.avatarSvg(wallet.address);
  const methodLabel = wallet.method === "watch" ? t("common.watchOnly") : WALLET_METHOD_LABEL[wallet.method];
  const { copied, copy } = useCopy(wallet.address);

  return (
    // The row bleeds 8px past the list edge so the hover fill has room
    // around its content while text stays aligned with the header. Only
    // the checkmark marks the active row: a fill would read as hover. Copy
    // floats beside the chevron instead of taking a column, so the address
    // keeps the full width for its 7-chunk first row.
    <div
      className={`group relative -mx-2 flex items-center gap-1 rounded-xl pl-2 pr-1 ${active ? "" : "hover:bg-mist"}`}
    >
      <button
        type="button"
        disabled={switching}
        onClick={onSwitch}
        aria-current={active ? "true" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left disabled:opacity-60"
      >
        <AccountAvatar svgMarkup={avatarSvg} label={t("walletSwitcher.avatarOf", { name: wallet.name })} size={36} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-label font-semibold text-foreground">
              {wallet.name}
              {methodLabel ? <span className="font-normal text-faint"> · {methodLabel}</span> : null}
            </span>
            {active ? (
              <span className="flex flex-shrink-0 items-center gap-1 text-caption font-medium text-positive">
                <CheckIcon size={12} />
                {t("walletSwitcher.active")}
              </span>
            ) : (
              // Hidden on phone: tapping the row is the expected way to switch,
              // and the text would take the width the name needs.
              <span className="flex-shrink-0 text-caption font-medium text-muted opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 phone:hidden">
                {t("walletSwitcher.makeActive")}
              </span>
            )}
          </span>
          <MemorableAddress address={wallet.address} emphasisPick={identity.emphasisPick} className="-ml-[0.35ch]" />
        </span>
      </button>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? t("walletSwitcher.addressCopied", { name: wallet.name }) : t("walletSwitcher.copyAddressOf", { name: wallet.name })}
        title={copied ? t("walletSwitcher.copied") : t("walletSwitcher.copyAddress")}
        className={`absolute right-[30px] top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-opacity hover:bg-background focus-visible:opacity-100 group-hover:opacity-100 phone:static phone:h-11 phone:w-11 phone:shrink-0 phone:translate-y-0 phone:opacity-100 ${copied ? "text-positive opacity-100" : "text-faint opacity-0 hover:text-foreground"}`}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <button
        type="button"
        aria-label={t("walletSwitcher.manage", { name: wallet.name })}
        onClick={onManage}
        className="flex h-7 w-5 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-background hover:text-foreground phone:h-11 phone:w-11"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}

function CheckIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Opens the wallet's own page, so it reads as a way in, not a menu. */
function ChevronRightIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
