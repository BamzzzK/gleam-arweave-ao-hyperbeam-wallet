/**
 * Derives the keyfile for a checked recovery phrase. Injected into
 * `ImportPhrase` so tests can stand in for the real derivation, which
 * takes up to minutes. The keyfile stays opaque here, as in the keyfile
 * import: `importWallet` validates it in the background.
 */
export type DerivePhraseKey = (words: readonly string[], signal: AbortSignal) => Promise<unknown>;

type WorkerReply = { ok: true; jwk: unknown } | { ok: false; error: string };

/**
 * Runs the derivation in `phrase-key.worker.ts`, a fresh worker per call,
 * terminated on reply or abort so nothing derived outlives the import.
 */
export const derivePhraseKey: DerivePhraseKey = (words, signal) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const worker = new Worker(new URL("./phrase-key.worker.ts", import.meta.url), { type: "module" });
    const onAbort = () => {
      worker.terminate();
      reject(signal.reason);
    };
    const settle = () => {
      worker.terminate();
      signal.removeEventListener("abort", onAbort);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      settle();
      if (event.data.ok) resolve(event.data.jwk);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      settle();
      reject(new Error(event.message || "The recovery phrase couldn't be processed."));
    };
    worker.postMessage([...words]);
  });
