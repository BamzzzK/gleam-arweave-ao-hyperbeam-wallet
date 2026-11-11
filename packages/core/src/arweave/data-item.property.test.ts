import { beforeAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import { ArweaveSigner, createData } from "@dha-team/arbundles/web";
import { generateJWK } from "../signer/keys";
import type { JWKInterface } from "../models/wallet";
import { bytesToBase64Url } from "../vault/base64";
import { buildUnsignedDataItem, dataItemSignatureData, readDataItemFields, type DataItemFields } from "./data-item";

let jwk: JWKInterface;

beforeAll(async () => {
  jwk = await generateJWK();
}, 30_000);

/** Any code point, NUL and bidi controls included. */
const text = (maxLength: number) => fc.string({ unit: "binary", maxLength });

const fields: fc.Arbitrary<DataItemFields> = fc.record(
  {
    data: fc.uint8Array({ maxLength: 64 * 1024 }),
    tags: fc.array(fc.record({ name: text(64).filter((name) => name.length > 0), value: text(300) }), { maxLength: 128 }),
    target: fc.uint8Array({ minLength: 32, maxLength: 32 }).map(bytesToBase64Url),
    anchor: fc.string({ unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), minLength: 32, maxLength: 32 }),
  },
  { requiredKeys: ["data"] },
);

describe("buildUnsignedDataItem against arbundles", () => {
  it("builds arbundles' bytes and deep hash for any fields, and reads them back", async () => {
    await fc.assert(
      fc.asyncProperty(fields, async (input) => {
        const reference = createData(input.data, new ArweaveSigner(jwk), {
          target: input.target,
          anchor: input.anchor,
          tags: input.tags,
        });
        let unsigned: Uint8Array;
        try {
          unsigned = buildUnsignedDataItem(jwk.n, input);
        } catch (error) {
          // ANS-104 caps encoded tags at 4096 bytes; arbundles doesn't check.
          expect((error as Error).message).toMatch(/4096-byte limit/);
          expect(reference.rawTags.byteLength).toBeGreaterThan(4096);
          return;
        }
        expect(Buffer.from(unsigned).equals(reference.getRaw())).toBe(true);
        expect(Buffer.from(await dataItemSignatureData(unsigned)).equals(Buffer.from(await reference.getSignatureData()))).toBe(true);

        const read = readDataItemFields(unsigned);
        expect(read.target).toBe(input.target ?? "");
        expect(read.anchor).toBe(input.anchor ?? "");
        expect(read.tags).toEqual(input.tags ?? []);
        expect(Buffer.from(read.data).equals(Buffer.from(input.data))).toBe(true);
      }),
      { numRuns: 40 },
    );
  }, 60_000);
});
