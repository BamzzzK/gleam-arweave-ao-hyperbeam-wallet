import { describe, expect, it } from "vitest";
import { KeyedQueue, createSerializer } from "./serialize";

/** A promise the test settles by hand. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createSerializer", () => {
  it("starts each task only after the one before settles", async () => {
    const serialize = createSerializer();
    const log: string[] = [];
    const first = deferred();
    const a = serialize(async () => {
      log.push("a start");
      await first.promise;
      log.push("a end");
      return "a";
    });
    const b = serialize(async () => {
      log.push("b start");
      return "b";
    });
    await tick();
    expect(log).toEqual(["a start"]);
    first.resolve();
    await expect(Promise.all([a, b])).resolves.toEqual(["a", "b"]);
    expect(log).toEqual(["a start", "a end", "b start"]);
  });

  it("gives a task's error to its own caller and runs the next", async () => {
    const serialize = createSerializer();
    const failed = serialize(async () => {
      throw new Error("boom");
    });
    const next = serialize(async () => "next");
    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe("next");
  });
});

describe("KeyedQueue", () => {
  it("serializes tasks for one key and lets other keys run", async () => {
    const queue = new KeyedQueue<string>();
    const log: string[] = [];
    const held = deferred();
    const a1 = queue.run("a", async () => {
      log.push("a1");
      await held.promise;
    });
    const a2 = queue.run("a", async () => {
      log.push("a2");
    });
    const b1 = queue.run("b", async () => {
      log.push("b1");
    });
    await b1;
    expect(log).toEqual(["a1", "b1"]);
    held.resolve();
    await Promise.all([a1, a2]);
    expect(log).toEqual(["a1", "b1", "a2"]);
  });

  it("keeps going after a failed task and drops a drained key", async () => {
    const queue = new KeyedQueue<string>();
    const failed = queue.run("a", async () => {
      throw new Error("boom");
    });
    const next = queue.run("a", async () => 2);
    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe(2);
    await tick();
    expect(queue.size).toBe(0);
  });
});
