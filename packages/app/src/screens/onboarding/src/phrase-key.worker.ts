import { MNEMONIC_WORD_COUNTS, mnemonicToSeed } from "@gleam/core/src/keys/mnemonic.ts";
import { jwkFromSeed } from "@gleam/core/src/keys/mnemonic-jwk.ts";

/**
 * Derives a recovery phrase's key off the UI thread: the prime search runs
 * for seconds to minutes. One phrase per worker; the client terminates it
 * after the reply, which drops every intermediate value with it.
 *
 * Forge splits its prime search across nested workers whenever `Worker`
 * exists, and that race makes the key depend on timing. This worker does
 * nothing else, so removing `Worker` here touches no other code.
 */
const scope = self as unknown as { Worker?: unknown };
delete scope.Worker;
if (typeof scope.Worker !== "undefined") scope.Worker = undefined;

/**
 * Only the page that created a dedicated worker can message it, and the
 * browser delivers those messages with an empty origin (some engines may
 * use the worker's own). Anything else didn't come from that page.
 */
export function isFromOwner(event: MessageEvent): boolean {
  return event.origin === "" || event.origin === self.location.origin;
}

/** BIP-39 English words are 3 to 8 lowercase letters, in a phrase of 12 to 24. */
export function isPhraseWords(data: unknown): data is string[] {
  return (
    Array.isArray(data) &&
    (MNEMONIC_WORD_COUNTS as readonly number[]).includes(data.length) &&
    data.every((word) => typeof word === "string" && /^[a-z]{3,8}$/u.test(word))
  );
}

self.onmessage = async (event: MessageEvent<unknown>) => {
  if (!isFromOwner(event)) return;
  if (!isPhraseWords(event.data)) {
    self.postMessage({ ok: false, error: "That isn't a recovery phrase." });
    return;
  }
  let seed: Uint8Array | undefined;
  try {
    seed = await mnemonicToSeed(event.data);
    const jwk = await jwkFromSeed(seed);
    self.postMessage({ ok: true, jwk });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  } finally {
    seed?.fill(0);
  }
};
