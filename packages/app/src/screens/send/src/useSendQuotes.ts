import { useQuery, type QueryClient } from "@tanstack/react-query";
import type { CollectibleRef, CollectibleSendDraft, RecipientAssessment, RuntimePort, TransferFeeQuote } from "@gleam/core";

/** How long a quote shown on compose is reused by Continue instead of fetched again. */
const FEE_QUOTE_STALE_MS = 30_000;

function feeQuoteOptions(runtime: RuntimePort, walletId: string, recipient: string, token: string | null) {
  return {
    queryKey: ["sendFeeQuote", walletId, recipient, token] as const,
    queryFn: () =>
      runtime.send<{ walletId: string; recipient: string; token: string | null; amount: string; fee: null }, TransferFeeQuote>({
        type: "estimateTransfer",
        // The fee depends on the recipient and token, never the amount.
        payload: { walletId, recipient, token, amount: "0", fee: null },
      }),
    staleTime: FEE_QUOTE_STALE_MS,
    retry: false,
  };
}

/** The compose step's live fee line; `recipient` is `undefined` until it's a full address. */
export function useSendFeeQuote(runtime: RuntimePort, walletId: string, recipient: string | undefined, token: string | null) {
  return useQuery({
    ...feeQuoteOptions(runtime, walletId, recipient ?? "", token),
    enabled: recipient !== undefined,
  });
}

/** Continue's blocking read: the quote compose already shows when it's fresh, else a new one. */
export function fetchSendFeeQuote(
  queryClient: QueryClient,
  runtime: RuntimePort,
  walletId: string,
  recipient: string,
  token: string | null,
): Promise<TransferFeeQuote> {
  return queryClient.fetchQuery(feeQuoteOptions(runtime, walletId, recipient, token));
}

function collectibleFeeQuoteOptions(runtime: RuntimePort, walletId: string, recipient: string, collectible: CollectibleRef) {
  return {
    queryKey: ["collectibleFeeQuote", walletId, recipient, collectible.id] as const,
    queryFn: () =>
      runtime.send<CollectibleSendDraft, TransferFeeQuote>({
        type: "estimateCollectibleSend",
        payload: { walletId, recipient, collectible },
      }),
    staleTime: FEE_QUOTE_STALE_MS,
    retry: false,
  };
}

/** The collectible compose step's live fee line; `recipient` is `undefined` until it can be sent to. */
export function useCollectibleFeeQuote(runtime: RuntimePort, walletId: string, recipient: string | undefined, collectible: CollectibleRef) {
  return useQuery({
    ...collectibleFeeQuoteOptions(runtime, walletId, recipient ?? "", collectible),
    enabled: recipient !== undefined,
  });
}

export function fetchCollectibleFeeQuote(
  queryClient: QueryClient,
  runtime: RuntimePort,
  walletId: string,
  recipient: string,
  collectible: CollectibleRef,
): Promise<TransferFeeQuote> {
  return queryClient.fetchQuery(collectibleFeeQuoteOptions(runtime, walletId, recipient, collectible));
}

/**
 * First-time and lookalike checks over the wallet's history. Starts as
 * soon as a full address is entered, since it reads gateway GraphQL and
 * can take far longer than the fee.
 */
export function useRecipientAssessment(runtime: RuntimePort, walletId: string, recipient: string | undefined) {
  return useQuery({
    queryKey: ["recipientAssessment", walletId, recipient ?? ""] as const,
    queryFn: () =>
      runtime.send<{ walletId: string; recipient: string }, RecipientAssessment>({
        type: "assessRecipient",
        payload: { walletId, recipient: recipient ?? "" },
      }),
    enabled: recipient !== undefined,
    staleTime: 60_000,
    retry: false,
  });
}
