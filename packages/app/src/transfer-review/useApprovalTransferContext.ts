import { useEffect, useMemo, useState } from "react";
import type { DisplayCurrency, DisplaySettings, RuntimePort, TokenPrice } from "@gleam/core";
import { DEFAULT_AO_TOKEN } from "@gleam/ui";
import { balancesQuery, type WalletBalances } from "../screens/activity/src/useBalances";
import { readRowVisibility } from "../token-visibility";
import type { TransferContext } from "./model";

/**
 * Balances, prices and display settings for an approval's transfer, read
 * once when it opens. The approval window has no query cache of its own,
 * and every read is best effort: a failed one only hides the fiat line,
 * the logo or the balance after.
 *
 * Only a token the wallet added by hand is priced from its orderbook, as
 * on the main screen; any other token's price would be its creator's claim.
 */
export function useApprovalTransferContext(
  runtime: RuntimePort | null,
  address: string | null,
  tokens: Array<string | null>,
): TransferContext {
  const [settings, setSettings] = useState<DisplaySettings>();
  const [balances, setBalances] = useState<WalletBalances>();
  const [prices, setPrices] = useState<TokenPrice[]>();
  const active = runtime !== null && address !== null && tokens.length > 0;
  const tokensKey = [...new Set(tokens.map((token) => token ?? ""))].sort().join(",");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => runtime.send<void, DisplaySettings>({ type: "getDisplaySettings", payload: undefined }))
      .then((next) => !cancelled && setSettings(next))
      .catch(() => {});
    void Promise.resolve()
      .then(() => balancesQuery(runtime, address).queryFn())
      .then((next) => !cancelled && setBalances(next))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active, runtime, address]);

  const currency: DisplayCurrency | undefined = settings?.currency;
  const watched = (balances?.tokenBalances ?? [])
    .filter((balance) => balance.source !== "discovered" && balance.available !== false)
    .map((balance) => balance.processId)
    .filter((processId) => processId !== DEFAULT_AO_TOKEN.processId && tokensKey.split(",").includes(processId))
    .sort();
  const watchedKey = watched.join(",");

  useEffect(() => {
    if (!active || currency === undefined) return;
    let cancelled = false;
    const requests: Array<Promise<TokenPrice[]>> = [
      Promise.resolve().then(() =>
        runtime.send<{ currency: DisplayCurrency }, TokenPrice[]>({ type: "getTokenPrices", payload: { currency } }),
      ),
    ];
    const processIds = watchedKey === "" ? [] : watchedKey.split(",");
    if (processIds.length > 0) {
      requests.push(
        Promise.resolve()
          .then(() =>
            runtime.send<{ currency: DisplayCurrency; processIds: string[] }, TokenPrice[]>({
              type: "getTokenPrices",
              payload: { currency, processIds },
            }),
          )
          .then((found) => found.filter((entry) => entry.processId !== null && processIds.includes(entry.processId))),
      );
    }
    void Promise.allSettled(requests).then((results) => {
      if (cancelled) return;
      setPrices(results.flatMap((result) => (result.status === "fulfilled" && Array.isArray(result.value) ? result.value : [])));
    });
    return () => {
      cancelled = true;
    };
  }, [active, runtime, currency, watchedKey]);

  const visibility = useMemo(() => (address ? readRowVisibility(address) : {}), [address]);

  return {
    address: address ?? undefined,
    balances,
    prices,
    currency,
    tokenLogos: settings?.tokenLogos ?? true,
    balancesHidden: settings?.balancesHidden ?? false,
    visibility,
  };
}
