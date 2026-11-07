import type { Tag } from "../models/tag";

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const ATOMIC = /^(0|[1-9]\d*)$/;

/** What an AO `Transfer` message moves, read from its own signed target and tags. */
export interface AoTransferMessage {
  /** The token process the message is sent to. */
  processId: string;
  recipient: string;
  /** Atomic units. */
  quantity: string;
}

/**
 * Reads a data item as an AO token transfer, or `null` when it isn't one.
 * A name that appears twice makes it `null`: a process could read either
 * copy, so no single amount or recipient can be shown for it.
 */
export function readAoTransferMessage(item: { target: string | null | undefined; tags: readonly Tag[] }): AoTransferMessage | null {
  if (!item.target || !ADDRESS.test(item.target)) return null;
  const only = (name: string): string | null => {
    const matches = item.tags.filter((tag) => tag.name === name);
    return matches.length === 1 ? matches[0]!.value : null;
  };
  if (only("Action") !== "Transfer") return null;
  const recipient = only("Recipient");
  const quantity = only("Quantity");
  if (recipient === null || !ADDRESS.test(recipient) || quantity === null || !ATOMIC.test(quantity)) return null;
  return { processId: item.target, recipient, quantity };
}
