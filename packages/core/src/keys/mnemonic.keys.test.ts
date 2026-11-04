import { describe, expect, it } from "vitest";
import { checkMnemonic, isMnemonicWord, mnemonicToSeed, splitPhrase, suggestMnemonicWords } from "./mnemonic";
import { WANDER_PHRASE_VECTORS } from "./mnemonic-vectors";

const ABOUT = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

describe("splitPhrase", () => {
  it("splits on spaces, newlines, tabs, commas and semicolons", () => {
    expect(splitPhrase("one two\nthree\tfour,five; six,  seven")).toEqual([
      "one", "two", "three", "four", "five", "six", "seven",
    ]);
  });

  it("drops numbering from notes apps and password managers", () => {
    expect(splitPhrase("1. legal 2. winner\n3) thank\n4: year #5 wave (6) sausage 7.worth 8-useful")).toEqual([
      "legal", "winner", "thank", "year", "wave", "sausage", "worth", "useful",
    ]);
  });

  it("lowercases, trims and treats non-breaking spaces as spaces", () => {
    expect(splitPhrase("  Legal WINNER  ")).toEqual(["legal", "winner"]);
  });

  it("returns nothing for blank input", () => {
    expect(splitPhrase(" \n , ")).toEqual([]);
  });
});

describe("checkMnemonic", () => {
  it.each(WANDER_PHRASE_VECTORS.map((vector) => [vector.words, vector.mnemonic]))(
    "accepts a valid %i-word phrase",
    async (_count, mnemonic) => {
      expect(await checkMnemonic(splitPhrase(mnemonic))).toEqual({ valid: true });
    },
  );

  it("reports the positions of words that aren't on the list", async () => {
    const words = splitPhrase(ABOUT);
    words[2] = "abandn";
    words[7] = "bitcoin";
    expect(await checkMnemonic(words)).toEqual({ valid: false, problem: { kind: "unknownWords", positions: [2, 7] } });
  });

  it("rejects a length BIP-39 doesn't define", async () => {
    expect(await checkMnemonic(splitPhrase(ABOUT).slice(0, 11))).toEqual({
      valid: false,
      problem: { kind: "wordCount", count: 11 },
    });
    expect(await checkMnemonic([])).toEqual({ valid: false, problem: { kind: "wordCount", count: 0 } });
  });

  it("rejects a wordlist typo through the checksum", async () => {
    const words = splitPhrase(ABOUT);
    words[11] = "abandon";
    expect(await checkMnemonic(words)).toEqual({ valid: false, problem: { kind: "checksum" } });
  });
});

describe("mnemonicToSeed", () => {
  it.each(WANDER_PHRASE_VECTORS.map((vector) => [vector.words, vector.mnemonic, vector.seed]))(
    "matches Wander's seed for a %i-word phrase",
    async (_count, mnemonic, seed) => {
      expect(toHex(await mnemonicToSeed(splitPhrase(mnemonic)))).toBe(seed);
    },
  );
});

describe("wordlist lookups", () => {
  it("knows list words", () => {
    expect(isMnemonicWord("zoo")).toBe(true);
    expect(isMnemonicWord("zoos")).toBe(false);
  });

  it("suggests words by prefix", () => {
    expect(suggestMnemonicWords("aba")).toEqual(["abandon"]);
    expect(suggestMnemonicWords("ab", 3)).toEqual(["abandon", "ability", "able"]);
    expect(suggestMnemonicWords(" ")).toEqual([]);
  });
});
