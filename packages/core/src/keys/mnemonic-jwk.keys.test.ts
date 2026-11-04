import { describe, expect, it } from "vitest";
import { jwkFromSeed } from "./mnemonic-jwk";
import { addressFromOwner } from "./address";
import { validateJWKShape } from "./jwk";
import { WANDER_PHRASE_VECTORS } from "./mnemonic-vectors";

const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g)!, (pair) => parseInt(pair, 16));
const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const vectors = process.env.GLEAM_PHRASE_VECTORS === "all" ? WANDER_PHRASE_VECTORS : WANDER_PHRASE_VECTORS.slice(0, 1);

describe("jwkFromSeed", () => {
  it.each(vectors.map((vector) => [vector.words, vector]))(
    "derives Wander's exact key from a %i-word phrase's seed",
    async (_count, vector) => {
      const jwk = await jwkFromSeed(fromHex(vector.seed));

      expect(validateJWKShape(jwk).valid).toBe(true);
      expect(await addressFromOwner(jwk.n)).toBe(vector.address);
      const fields = JSON.stringify([jwk.kty, jwk.e, jwk.n, jwk.d, jwk.p, jwk.q, jwk.dp, jwk.dq, jwk.qi]);
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fields)));
      expect(toHex(digest)).toBe(vector.jwkSha256);
    },
    180_000,
  );

  it("refuses to run where forge could split the prime search across workers", async () => {
    const scope = globalThis as { Worker?: unknown };
    scope.Worker = class {};
    try {
      await expect(jwkFromSeed(new Uint8Array(64))).rejects.toThrow(/Worker is undefined/);
    } finally {
      delete scope.Worker;
    }
  });
});
