import type { Tag } from "../models/tag";

/**
 * Which reader a signing preview's headline came from. `ao` is
 * `readAoTransferMessage`, `l1` is `readL1TokenTransfer` (collectibles
 * included), `plain` a transaction or item the headline reads nothing
 * from but its target and quantity.
 */
export type TransferTagReader = "ao" | "l1" | "plain";

/** The tags a clean `readAoTransferMessage` reading consumed, matched exactly as aos does. */
export const AO_TRANSFER_TAG_NAMES: readonly string[] = ["Action", "Recipient", "Quantity"];
/** The tags a clean `readL1TokenTransfer` reading consumed, matched in any case as the scheduler does. */
export const L1_TRANSFER_TAG_NAMES: readonly string[] = ["action", "recipient", "quantity"];

/**
 * Protocol and client tags that every AO message carries and no token acts
 * on, by lowercase name, with the one value that is harmless (`null`: any
 * value). They are left out of the count so it stays rare enough to be
 * read. `Type: Process` or another `Data-Protocol` is counted: AO routes on
 * them. A name the readers know (`Action`, `Recipient`, `Quantity`,
 * `Assign-To`) must never be here.
 */
export const HARMLESS_TAGS: Readonly<Record<string, string | null>> = {
  "data-protocol": "ao",
  variant: "ao.TN.1",
  type: "Message",
  sdk: null,
  "content-type": null,
};

/** Whether `tag` is one of `HARMLESS_TAGS` with its harmless value. */
export function isHarmlessTag(tag: Tag): boolean {
  const name = tag.name.toLowerCase();
  if (!Object.hasOwn(HARMLESS_TAGS, name)) return false;
  const value = HARMLESS_TAGS[name];
  return value === null || tag.value === value;
}

/**
 * The tags beside a preview's headline that its reader did not consume:
 * what the transaction also says that the amount line doesn't. Every one
 * of them is counted next to the headline, never only under Details.
 */
export function otherTags(tags: readonly Tag[], reader: TransferTagReader): Tag[] {
  const consumed = (tag: Tag) =>
    reader === "ao"
      ? AO_TRANSFER_TAG_NAMES.includes(tag.name)
      : reader === "l1"
        ? L1_TRANSFER_TAG_NAMES.includes(tag.name.toLowerCase())
        : false;
  return tags.filter((tag) => !consumed(tag) && !isHarmlessTag(tag));
}
