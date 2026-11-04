import { describe, expect, it } from "vitest";
import { BIP39_ENGLISH } from "./bip39-wordlist";

// SHA-256 of bitcoin/bips bip-0039/english.txt (2048 lines, trailing newline).
const ENGLISH_TXT_SHA256 = "2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda";

describe("BIP39_ENGLISH", () => {
  it("is the published English wordlist", async () => {
    expect(BIP39_ENGLISH).toHaveLength(2048);
    const text = new TextEncoder().encode(`${BIP39_ENGLISH.join("\n")}\n`);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", text));
    expect(Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")).toBe(ENGLISH_TXT_SHA256);
  });

  it("can't be changed at runtime", () => {
    expect(Object.isFrozen(BIP39_ENGLISH)).toBe(true);
  });
});
