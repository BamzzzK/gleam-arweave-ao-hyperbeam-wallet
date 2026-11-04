import { mnemonicToSeed } from "@gleam/core/src/keys/mnemonic.ts";
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

self.onmessage = async (event: MessageEvent<string[]>) => {
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
