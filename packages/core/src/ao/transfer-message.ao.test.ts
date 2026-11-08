import { describe, expect, it } from "vitest";
import { readAoTransferMessage } from "./transfer-message";

const PROCESS = "0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc";
const RECIPIENT = "g".repeat(43);
const TAGS = [
  { name: "Data-Protocol", value: "ao" },
  { name: "Action", value: "Transfer" },
  { name: "Recipient", value: RECIPIENT },
  { name: "Quantity", value: "1500000000000" },
];

const recase = (tags: typeof TAGS, recased: (name: string) => string) =>
  tags.map((tag) => (tag.name === "Data-Protocol" ? tag : { ...tag, name: recased(tag.name) }));

describe("readAoTransferMessage", () => {
  it("reads the process, recipient and quantity of a Transfer message", () => {
    expect(readAoTransferMessage({ target: PROCESS, tags: TAGS })).toEqual({
      kind: "transfer",
      processId: PROCESS,
      recipient: RECIPIENT,
      quantity: "1500000000000",
    });
  });

  it("reads a clean transfer in any tag order, with other tags", () => {
    const tags = [{ name: "X-Note", value: "hi" }, ...TAGS].reverse();
    expect(readAoTransferMessage({ target: PROCESS, tags })?.kind).toBe("transfer");
  });

  it.each([
    ["no target", { target: null, tags: TAGS }],
    ["a target that isn't an address", { target: "short", tags: TAGS }],
    ["another action", { target: PROCESS, tags: TAGS.map((tag) => (tag.name === "Action" ? { ...tag, value: "Balance" } : tag)) }],
    ["no action at all", { target: PROCESS, tags: TAGS.filter((tag) => tag.name !== "Action") }],
  ])("is null for %s", (_name, item) => {
    expect(readAoTransferMessage(item)).toBeNull();
  });

  it.each([
    ["lowercase names", { target: PROCESS, tags: recase(TAGS, (name) => name.toLowerCase()).map((tag) => (tag.name === "action" ? { ...tag, value: "transfer" } : tag)) }],
    ["ACTION=TRANSFER", { target: PROCESS, tags: TAGS.map((tag) => (tag.name === "Action" ? { name: "ACTION", value: "TRANSFER" } : tag)) }],
    ["a lowercase Transfer value", { target: PROCESS, tags: TAGS.map((tag) => (tag.name === "Action" ? { ...tag, value: "transfer" } : tag)) }],
    ["a lowercase recipient", { target: PROCESS, tags: TAGS.map((tag) => (tag.name === "Recipient" ? { ...tag, name: "recipient" } : tag)) }],
    ["a quantity that isn't an integer", { target: PROCESS, tags: TAGS.map((tag) => (tag.name === "Quantity" ? { ...tag, value: "1.5" } : tag)) }],
    ["a recipient that isn't an address", { target: PROCESS, tags: TAGS.map((tag) => (tag.name === "Recipient" ? { ...tag, value: "bob" } : tag)) }],
    ["a second Quantity", { target: PROCESS, tags: [...TAGS, { name: "Quantity", value: "1" }] }],
    ["a second Recipient", { target: PROCESS, tags: [...TAGS, { name: "Recipient", value: "h".repeat(43) }] }],
    ["a second Action", { target: PROCESS, tags: [...TAGS, { name: "Action", value: "Transfer" }] }],
    ["a lowercase action beside Action", { target: PROCESS, tags: [...TAGS, { name: "action", value: "transfer" }] }],
    ["a lowercase recipient beside Recipient", { target: PROCESS, tags: [...TAGS, { name: "recipient", value: "h".repeat(43) }] }],
    ["a lowercase quantity beside Quantity", { target: PROCESS, tags: [...TAGS, { name: "quantity", value: "1" }] }],
  ])("is unreadable for %s", (_name, item) => {
    expect(readAoTransferMessage(item)).toEqual({ kind: "unreadable" });
  });
});
