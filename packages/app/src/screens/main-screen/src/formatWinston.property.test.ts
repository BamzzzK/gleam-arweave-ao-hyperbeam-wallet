import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { amountSchema } from "../../send/src/sendFormSchema";
import { formatAtomicAsDisplay, formatWinstonAsAr, parseDisplayToAtomic } from "./formatWinston";

const atomic = fc.bigInt({ min: 0n, max: 2n ** 128n - 1n });
const denomination = fc.integer({ min: 0, max: 24 });

describe("amounts round-trip between atomic units and display text", () => {
  it("parses a full-precision display back to the same atomic amount", () => {
    fc.assert(
      fc.property(atomic, denomination, (amount, places) => {
        const display = formatAtomicAsDisplay(amount.toString(), places, places);
        expect(parseDisplayToAtomic(display, places)).toBe(amount.toString());
      }),
    );
  });

  it("formats Winston exactly as a 12-place token", () => {
    fc.assert(
      fc.property(atomic, fc.integer({ min: 0, max: 12 }), (amount, digits) => {
        expect(formatWinstonAsAr(amount.toString(), digits)).toBe(formatAtomicAsDisplay(amount.toString(), 12, digits));
      }),
    );
  });

  it("never shows more than the amount, and drops less than one shown digit", () => {
    fc.assert(
      fc.property(atomic, denomination, fc.integer({ min: 0, max: 24 }), (amount, places, digits) => {
        const shown = BigInt(parseDisplayToAtomic(formatAtomicAsDisplay(amount.toString(), places, digits), places)!);
        expect(shown <= amount).toBe(true);
        expect(amount - shown < 10n ** BigInt(Math.max(places - digits, 0))).toBe(true);
      }),
    );
  });

  it("parses any amount the send form accepts to the atomic amount it names", () => {
    const entered = fc
      .tuple(denomination, fc.bigInt({ min: 0n, max: 10n ** 30n }), fc.string({ unit: fc.constantFrom(..."0123456789"), maxLength: 24 }))
      .map(([places, whole, fraction]) => ({ places, text: fraction === "" ? `${whole}` : `${whole}.${fraction}` }));
    fc.assert(
      fc.property(entered, ({ places, text }) => {
        if (!amountSchema(places).safeParse(text).success) return;
        const [whole, fraction = ""] = text.split(".");
        const expected = BigInt(whole!) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, "0") || "0");
        expect(parseDisplayToAtomic(text, places)).toBe(expected.toString());
        expect(expected > 0n).toBe(true);
      }),
    );
  });
});
