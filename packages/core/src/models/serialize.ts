/**
 * Runs async tasks one at a time, in call order. A task starts only after
 * the one before it settles, and a failed task doesn't stop the next: its
 * error goes to its own caller only.
 */
export type Serializer = <T>(task: () => Promise<T>) => Promise<T>;

export function createSerializer(): Serializer {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };
}

/**
 * One `Serializer` per key: tasks for the same key run one at a time,
 * tasks for different keys don't wait for each other. A key's queue is
 * dropped once it drains.
 */
export class KeyedQueue<K> {
  private readonly tails = new Map<K, Promise<unknown>>();

  run<T>(key: K, task: () => Promise<T>): Promise<T> {
    const run = (this.tails.get(key) ?? Promise.resolve()).then(task);
    const tail = run.catch(() => undefined);
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return run;
  }

  /** Keys with a task queued or running. */
  get size(): number {
    return this.tails.size;
  }
}
