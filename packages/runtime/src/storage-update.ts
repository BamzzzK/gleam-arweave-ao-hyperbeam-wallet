import { KeyedQueue, type StoragePort } from "@gleam/core";

/**
 * One queue per `StoragePort` object. Both shells hand every handler the
 * same port in one background context, so this serializes every
 * `updateStored` of a key across handlers.
 */
const queues = new WeakMap<StoragePort, KeyedQueue<string>>();

/**
 * Writes `key` from its current value. Updates of one key run one at a
 * time, so a value computed from a read can't overwrite another update's
 * write that landed in between. `next` gets the stored value (`null` when
 * absent) and returns the new one, `null` to remove the key or
 * `undefined` to leave it untouched. It must not await anything: do
 * network work first and merge its result in `next`.
 */
export function updateStored<T>(
  storage: StoragePort,
  key: string,
  next: (current: unknown) => T | null | undefined,
): Promise<T | null | undefined> {
  let queue = queues.get(storage);
  if (!queue) {
    queue = new KeyedQueue<string>();
    queues.set(storage, queue);
  }
  return queue.run(key, async () => {
    const value = next(await storage.get<unknown>(key));
    if (value === null) await storage.remove(key);
    else if (value !== undefined) await storage.set(key, value);
    return value;
  });
}
