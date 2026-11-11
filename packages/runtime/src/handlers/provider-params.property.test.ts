import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { readBytes, readDataItem, readDataItems, readTransaction } from "./provider-params";

/** What a page can put in a field: anything, base64url-ish text or bytes. */
const field = fc.oneof(
  fc.anything(),
  fc.base64String().map((text) => text.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")),
  fc.uint8Array({ maxLength: 64 }),
  fc.array(fc.record({ name: fc.anything(), value: fc.anything() }, { requiredKeys: [] }), { maxLength: 4 }),
);

/** Objects shaped like a transaction or data item, with any values in the fields. */
const shaped = fc.record(
  { data: field, tags: field, target: field, anchor: field, quantity: field, reward: field, last_tx: field, format: field },
  { requiredKeys: [] },
);

const pageValue = fc.oneof(fc.anything(), shaped, fc.array(shaped, { maxLength: 3 }));

/**
 * A reader either returns or refuses with a plain `Error` naming the
 * problem. A `TypeError` or `RangeError` means page input reached code
 * that assumed a shape, which is how a crafted request gets past a check.
 */
function refusesCleanly(read: () => unknown): void {
  try {
    read();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).constructor).toBe(Error);
    expect((error as Error).message.length).toBeGreaterThan(0);
  }
}

describe("page parameter readers on arbitrary input", () => {
  it("readTransaction returns or refuses with a plain Error", () => {
    fc.assert(fc.property(pageValue, (value) => refusesCleanly(() => readTransaction(value, "sign"))), { numRuns: 500 });
  });

  it("readDataItem and readDataItems return or refuse with a plain Error", () => {
    fc.assert(
      fc.property(pageValue, (value) => {
        refusesCleanly(() => readDataItem(value, "signDataItem"));
        refusesCleanly(() => readDataItems(value));
      }),
      { numRuns: 500 },
    );
  });

  it("readBytes returns or refuses with a plain Error in every string mode", () => {
    fc.assert(
      fc.property(field, fc.constantFrom("reject", "utf8", "base64url") as fc.Arbitrary<"reject" | "utf8" | "base64url">, (value, mode) =>
        refusesCleanly(() => readBytes(value, "data", mode)),
      ),
      { numRuns: 500 },
    );
  });
});
