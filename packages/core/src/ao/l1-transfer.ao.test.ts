import { describe, expect, it } from "vitest";
import { l1TransferTags, readL1TokenTransfer } from "./l1-transfer";

const PID = "EuEkh8ZYkoPKXimgjre7W268XXX_qRn5vofc66oRTOw";
const RECIPIENT = "R".repeat(43);
const TRANSFER = { kind: "transfer", processId: PID, recipient: RECIPIENT, quantity: "311" };
const UNREADABLE = { kind: "unreadable" };

function read(tags: Array<{ name: string; value: string }>, fields: { quantity?: string; data_size?: string } = {}) {
  return readL1TokenTransfer({ target: PID, quantity: "0", data_size: "0", tags, ...fields });
}

describe("readL1TokenTransfer", () => {
  it("reads back exactly what l1TransferTags writes", () => {
    expect(read(l1TransferTags(RECIPIENT, "311"))).toEqual(TRANSFER);
  });

  it("reads the tags by name, in any order and case, beside other tags", () => {
    const [action, recipient, quantity] = l1TransferTags(RECIPIENT, "311");
    expect(read([{ name: "x", value: "y" }, action!, recipient!, quantity!])).toEqual(TRANSFER);
    expect(read([quantity!, recipient!, action!])).toEqual(TRANSFER);
    expect(
      read([
        { name: "Action", value: "Transfer" },
        { name: "RECIPIENT", value: RECIPIENT },
        { name: "Quantity", value: "311" },
      ]),
    ).toEqual(TRANSFER);
  });

  it("flags a transfer-looking transaction it can't read cleanly", () => {
    const tags = l1TransferTags(RECIPIENT, "5");
    expect(read([...tags, { name: "Quantity", value: "999" }])).toEqual(UNREADABLE);
    expect(read([...tags, { name: "Action", value: "Transfer" }])).toEqual(UNREADABLE);
    expect(read([...tags, { name: "action", value: "Other" }])).toEqual(UNREADABLE);
    expect(read(tags, { quantity: "1" })).toEqual(UNREADABLE);
    expect(read(tags, { data_size: "4" })).toEqual(UNREADABLE);
    // A dispatch this large is bundled into a data item, which an AO token reads as its Transfer.
    const aoTags = [
      { name: "Action", value: "Transfer" },
      { name: "Recipient", value: RECIPIENT },
      { name: "Quantity", value: "5" },
    ];
    expect(read(aoTags, { data_size: String(150 * 1024) })).toEqual(UNREADABLE);
    expect(read(l1TransferTags("not-an-address", "5"))).toEqual(UNREADABLE);
    expect(read(l1TransferTags(RECIPIENT, "0"))).toEqual(UNREADABLE);
    expect(read(l1TransferTags(RECIPIENT, "1.5"))).toEqual(UNREADABLE);
    expect(read([{ name: "action", value: "transfer" }])).toEqual(UNREADABLE);
  });

  it("flags a transfer the scheduler would also assign to other processes", () => {
    const tags = l1TransferTags(RECIPIENT, "5");
    const other = "Q".repeat(43);
    expect(read([...tags, { name: "Assign-To", value: other }])).toEqual(UNREADABLE);
    expect(read([...tags, { name: "assign-to", value: `${other},${"P".repeat(43)}` }])).toEqual(UNREADABLE);
    expect(read([...tags, { name: "Assign-To", value: PID }])).toEqual(UNREADABLE);
  });

  it("is null for a transaction that isn't a transfer", () => {
    expect(read([])).toBeNull();
    expect(read([{ name: "action", value: "eval" }, { name: "recipient", value: RECIPIENT }])).toBeNull();
    expect(readL1TokenTransfer({ target: "", quantity: "0", data_size: "0", tags: l1TransferTags(RECIPIENT, "5") })).toBeNull();
  });
});
