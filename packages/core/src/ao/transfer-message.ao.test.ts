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

describe("readAoTransferMessage", () => {
  it("reads the process, recipient and quantity of a Transfer message", () => {
    expect(readAoTransferMessage({ target: PROCESS, tags: TAGS })).toEqual({
      processId: PROCESS,
      recipient: RECIPIENT,
      quantity: "1500000000000",
    });
  });

  it.each([
    ["no target", { target: null, tags: TAGS }],
    ["a target that isn't an address", { target: "short", tags: TAGS }],
    ["another action", { target: PROCESS, tags: TAGS.map((tag) => (tag.name === "Action" ? { ...tag, value: "Balance" } : tag)) }],
    ["a quantity that isn't an integer", { target: PROCESS, tags: TAGS.map((tag) => (tag.name === "Quantity" ? { ...tag, value: "1.5" } : tag)) }],
    ["a recipient that isn't an address", { target: PROCESS, tags: TAGS.map((tag) => (tag.name === "Recipient" ? { ...tag, value: "bob" } : tag)) }],
    ["a second Quantity", { target: PROCESS, tags: [...TAGS, { name: "Quantity", value: "1" }] }],
    ["a second Recipient", { target: PROCESS, tags: [...TAGS, { name: "Recipient", value: "h".repeat(43) }] }],
    ["a second Action", { target: PROCESS, tags: [...TAGS, { name: "Action", value: "Transfer" }] }],
  ])("is null for %s", (_name, item) => {
    expect(readAoTransferMessage(item)).toBeNull();
  });
});
