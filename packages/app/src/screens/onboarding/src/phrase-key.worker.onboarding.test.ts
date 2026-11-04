import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@gleam/core/src/keys/mnemonic-jwk.ts", () => ({
  jwkFromSeed: vi.fn(async () => ({ kty: "RSA", n: "n", e: "AQAB" })),
}));

const PHRASE = "legal winner thank year wave sausage worth useful legal winner thank yellow".split(" ");
const postMessage = vi.spyOn(self, "postMessage").mockImplementation(() => {});
const { isFromOwner, isPhraseWords } = await import("./phrase-key.worker");

const send = async (data: unknown, origin = "") => {
  self.onmessage!(new MessageEvent("message", { data, origin }));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => postMessage.mockClear());
afterAll(() => postMessage.mockRestore());

describe("phrase-key worker", () => {
  it("accepts messages from the page that created it", () => {
    expect(isFromOwner(new MessageEvent("message", { origin: "" }))).toBe(true);
    expect(isFromOwner(new MessageEvent("message", { origin: self.location.origin }))).toBe(true);
  });

  it("ignores a message from any other origin", async () => {
    expect(isFromOwner(new MessageEvent("message", { origin: "https://evil.example" }))).toBe(false);
    await send(PHRASE, "https://evil.example");
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("only takes 12 to 24 lowercase wordlist-shaped words", () => {
    expect(isPhraseWords(PHRASE)).toBe(true);
    expect(isPhraseWords(PHRASE.slice(0, 11))).toBe(false);
    expect(isPhraseWords([...PHRASE.slice(0, 11), "Legal"])).toBe(false);
    expect(isPhraseWords([...PHRASE.slice(0, 11), 7])).toBe(false);
    expect(isPhraseWords(PHRASE.join(" "))).toBe(false);
  });

  it("refuses malformed input without deriving", async () => {
    const { jwkFromSeed } = await import("@gleam/core/src/keys/mnemonic-jwk.ts");
    await send({ words: PHRASE });
    expect(postMessage).toHaveBeenCalledWith({ ok: false, error: "That isn't a recovery phrase." });
    expect(jwkFromSeed).not.toHaveBeenCalled();
  });

  it("derives the key for a phrase from its owner", async () => {
    await send(PHRASE);
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledWith({ ok: true, jwk: { kty: "RSA", n: "n", e: "AQAB" } }));
  });
});
