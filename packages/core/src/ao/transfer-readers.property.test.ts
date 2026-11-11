import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { Tag } from "../models/tag";
import { readL1TokenTransfer } from "./l1-transfer";
import { readAoTransferMessage } from "./transfer-message";

const address = fc.string({ unit: fc.constantFrom(..."ABCabc0123_-"), minLength: 43, maxLength: 43 });

/** Tag names a token might read, in the cases a page might send them. */
const name = fc.oneof(
  fc.constantFrom("Action", "action", "ACTION", "Recipient", "recipient", "RECIPIENT", "Quantity", "quantity", "Assign-To", "assign-to"),
  fc.string({ maxLength: 12 }),
);
const value = fc.oneof(fc.constantFrom("Transfer", "transfer", "TRANSFER", "0", "7", "01", "-1"), address, fc.string({ maxLength: 50 }));
const randomTags = fc.array(fc.record({ name, value }), { maxLength: 8 });
/** A clean transfer's tags, maybe recased, with other tags mixed in, in any order. */
const nearTransfer = fc
  .tuple(
    address,
    fc.bigInt({ min: 0n, max: 10n ** 30n }),
    fc.constantFrom("Action", "action"),
    fc.constantFrom("Transfer", "transfer"),
    randomTags,
  )
  .chain(([recipient, amount, actionName, actionValue, extra]) => {
    const all = [
      { name: actionName, value: actionValue },
      { name: "Recipient", value: recipient },
      { name: "Quantity", value: amount.toString() },
      ...extra,
    ];
    return fc.shuffledSubarray(all, { minLength: all.length, maxLength: all.length });
  });
const tags = fc.oneof(randomTags, nearTransfer);

/** Every value carried by a tag whose name is `name` in any case. */
const valuesNamed = (list: readonly Tag[], tagName: string) =>
  list.filter((tag) => tag.name.toLowerCase() === tagName).map((tag) => tag.value);

describe("a transfer reading names exactly what the tags carry", () => {
  it("readAoTransferMessage", () => {
    let transfers = 0;
    fc.assert(
      fc.property(address, tags, (target, list) => {
        const reading = readAoTransferMessage({ target, tags: list });
        if (reading?.kind !== "transfer") return;
        transfers += 1;
        expect(reading.processId).toBe(target);
        expect(valuesNamed(list, "recipient")).toEqual([reading.recipient]);
        expect(valuesNamed(list, "quantity")).toEqual([reading.quantity]);
        expect(valuesNamed(list, "action")).toEqual(["Transfer"]);
        expect(list.find((tag) => tag.name.toLowerCase() === "recipient")!.name).toBe("Recipient");
        expect(reading.quantity).toMatch(/^(0|[1-9]\d*)$/);
      }),
      { numRuns: 2000 },
    );
    expect(transfers).toBeGreaterThan(50);
  });

  it("readL1TokenTransfer", () => {
    let transfers = 0;
    fc.assert(
      fc.property(address, tags, fc.constantFrom("0", "", "5"), fc.constantFrom("0", "12"), (target, list, quantity, dataSize) => {
        const reading = readL1TokenTransfer({ target, quantity, data_size: dataSize, tags: list });
        if (reading?.kind !== "transfer") return;
        transfers += 1;
        expect(reading.processId).toBe(target);
        expect(valuesNamed(list, "recipient")).toEqual([reading.recipient]);
        expect(valuesNamed(list, "quantity")).toEqual([reading.quantity]);
        expect(valuesNamed(list, "action").map((action) => action.toLowerCase())).toEqual(["transfer"]);
        expect(valuesNamed(list, "assign-to")).toEqual([]);
        expect(quantity || "0").toBe("0");
        expect(dataSize).toBe("0");
      }),
      { numRuns: 2000 },
    );
    expect(transfers).toBeGreaterThan(50);
  });
});
