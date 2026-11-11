import { beforeAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import { generateJWK } from "../signer/keys";
import type { JWKInterface } from "../models/wallet";
import { bytesToBase64Url } from "../vault/base64";
import { clientForGateway } from "./client";
import { buildUnsignedTransaction, transactionSignatureData } from "./transaction";

const GATEWAY = "https://arweave.net";
const arweave = clientForGateway(GATEWAY);

let jwk: JWKInterface;

beforeAll(async () => {
  jwk = await generateJWK();
}, 30_000);

const winston = fc.bigInt({ min: 0n, max: 2n ** 96n }).map(String);

const transaction = fc.record({
  data: fc.uint8Array({ maxLength: 600 * 1024 }),
  target: fc.option(fc.uint8Array({ minLength: 32, maxLength: 32 }).map(bytesToBase64Url), { nil: "" }),
  quantity: winston,
  reward: winston,
  last_tx: fc.uint8Array({ minLength: 48, maxLength: 48 }).map(bytesToBase64Url),
  tags: fc.array(fc.record({ name: fc.string({ unit: "binary", minLength: 1, maxLength: 40 }), value: fc.string({ unit: "binary", maxLength: 200 }) }), {
    maxLength: 20,
  }),
});

describe("transactionSignatureData against arweave-js", () => {
  it("recomputes arweave-js's deep hash for any format-2 transaction", async () => {
    await fc.assert(
      fc.asyncProperty(transaction, async ({ tags, ...attributes }) => {
        const reference = await arweave.createTransaction({ ...attributes }, jwk);
        for (const tag of tags) reference.addTag(tag.name, tag.value);
        const unsigned = await buildUnsignedTransaction(GATEWAY, jwk.n, { ...attributes }, tags);

        expect(Buffer.from(await transactionSignatureData(unsigned)).equals(Buffer.from(await reference.getSignatureData()))).toBe(true);
      }),
      { numRuns: 25 },
    );
  }, 60_000);
});
