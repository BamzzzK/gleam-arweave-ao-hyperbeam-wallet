import { prepareTransfer } from "../arweave/transfer";
import type { ArweaveTransactionJson } from "../arweave/transaction";
import type { Winston } from "../models/balance";
import type { Tag } from "../models/tag";
import { userErrorMessage } from "../models/user-errors";

/**
 * Tokens on `arweave-scheduler@1.0` (fungible tokens and collectibles
 * alike) read their messages from Arweave L1, so a transfer is a plain
 * L1 transaction to the token process rather than an ANS-104 item posted
 * to the MU. It moves no AR; the transfer is in the tags, whose
 * lowercase names are what that scheduler matches. The sender pays the
 * network reward.
 */
const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const ATOMIC = /^[1-9]\d*$/;

export function l1TransferTags(recipient: string, quantity: string): Tag[] {
  return [
    { name: "action", value: "transfer" },
    { name: "recipient", value: recipient },
    { name: "quantity", value: quantity },
  ];
}

/** The unsigned transaction that moves `quantity` atomic units of `processId` from `ownerB64Url` to `recipient`. */
export async function prepareL1TokenTransfer(
  gatewayUrl: string,
  ownerB64Url: string,
  processId: string,
  recipient: string,
  quantity: string,
  reward: Winston,
): Promise<ArweaveTransactionJson> {
  if (!ADDRESS.test(processId)) {
    throw new Error(`Token process must be an Arweave id (43 base64url characters), got "${processId}".`);
  }
  if (!ADDRESS.test(recipient)) {
    throw new Error(userErrorMessage("recipientInvalid", { recipient }));
  }
  if (!ATOMIC.test(quantity)) {
    throw new Error(`Transfer quantity must be a positive whole number of the token's smallest unit, got "${quantity}".`);
  }
  return prepareTransfer(gatewayUrl, ownerB64Url, processId, "0", reward, l1TransferTags(recipient, quantity));
}

/**
 * How a transaction to a token process reads as a token transfer.
 * `unreadable` is one that looks like a transfer (an `action` tag of
 * `transfer`) but has no single clean reading, so it must be shown as the
 * plain transaction it is, with a warning, rather than as zero AR alone.
 */
export type L1TokenTransferReading =
  | { kind: "transfer"; processId: string; recipient: string; quantity: string }
  | { kind: "unreadable" };

/**
 * Reads a transaction as `prepareL1TokenTransfer`'s output, or null when
 * it doesn't look like a token transfer at all. `tags` are plain text.
 * Tags are matched by name, case-insensitively and in any order, with
 * other tags allowed, because the scheduler and HyperBEAM's `dev_token`
 * read them that way. A name given twice is unreadable: the token could
 * act on either copy.
 */
export function readL1TokenTransfer(transaction: {
  target: string;
  quantity: string;
  data_size: string;
  tags: readonly Tag[];
}): L1TokenTransferReading | null {
  if (!ADDRESS.test(transaction.target)) return null;
  const named = (name: string) => transaction.tags.filter((tag) => tag.name.toLowerCase() === name);
  const actions = named("action");
  if (!actions.some((tag) => tag.value.toLowerCase() === "transfer")) return null;
  const only = (name: string): string | null => {
    const matches = named(name);
    return matches.length === 1 ? matches[0]!.value : null;
  };
  const recipient = only("recipient");
  const quantity = only("quantity");
  if (
    actions.length !== 1 ||
    (transaction.quantity || "0") !== "0" ||
    transaction.data_size !== "0" ||
    recipient === null ||
    !ADDRESS.test(recipient) ||
    quantity === null ||
    !ATOMIC.test(quantity)
  ) {
    return { kind: "unreadable" };
  }
  return { kind: "transfer", processId: transaction.target, recipient, quantity };
}
