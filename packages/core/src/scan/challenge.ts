import { CHALLENGE_SIZE } from "./attestation";

export interface ChallengeFunction {
  file: string;
  symbol: string;
}

/**
 * Draws `CHALLENGE_SIZE` distinct functions, from distinct files while
 * enough files remain. The draw depends only on the seed and the set of
 * functions (their order doesn't matter), so the server can store the seed
 * and re-derive the challenge, and tests are stable.
 *
 * Each draw is SHA-256(seed ‖ counter) read as a 48-bit integer, with
 * rejection sampling so every candidate is equally likely.
 *
 * When `prefer` names functions in the pool (those no scan has examined
 * yet), the first function comes from them, so coverage grows with each
 * scan. Only the first: drawing all three from a shrinking set would hand
 * consecutive scans the same functions, and one scan's answers to another
 * wallet.
 */
export async function pickChallenge(
  functions: readonly ChallengeFunction[],
  seed: string | Uint8Array,
  prefer: readonly ChallengeFunction[] = [],
): Promise<ChallengeFunction[]> {
  const seedBytes = typeof seed === "string" ? new TextEncoder().encode(seed) : seed;
  if (seedBytes.length === 0) throw new Error("The challenge seed must not be empty.");

  const unique = new Map<string, ChallengeFunction>();
  for (const fn of functions) unique.set(`${fn.file}\n${fn.symbol}`, { file: fn.file, symbol: fn.symbol });
  const pool = [...unique.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, fn]) => fn);
  if (pool.length < CHALLENGE_SIZE) {
    throw new Error(`A challenge needs at least ${CHALLENGE_SIZE} functions, got ${pool.length}.`);
  }

  let counter = 0;
  const draw = async (bound: number): Promise<number> => {
    const limit = Math.floor(2 ** 48 / bound) * bound;
    for (;;) {
      const input = new Uint8Array(seedBytes.length + 4);
      input.set(seedBytes);
      new DataView(input.buffer).setUint32(seedBytes.length, counter++);
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
      const value = digest.slice(0, 6).reduce((total, byte) => total * 256 + byte, 0);
      if (value < limit) return value % bound;
    }
  };

  const picked: ChallengeFunction[] = [];
  const usedFiles = new Set<string>();
  const preferred = new Set(prefer.map((fn) => `${fn.file}\n${fn.symbol}`));
  const firstPool = pool.filter((fn) => preferred.has(`${fn.file}\n${fn.symbol}`));
  if (firstPool.length > 0) {
    const choice = firstPool[await draw(firstPool.length)]!;
    picked.push(choice);
    usedFiles.add(choice.file);
  }
  while (picked.length < CHALLENGE_SIZE) {
    const fromNewFiles = pool.filter((fn) => !usedFiles.has(fn.file));
    const candidates = fromNewFiles.length > 0 ? fromNewFiles : pool.filter((fn) => !picked.includes(fn));
    const choice = candidates[await draw(candidates.length)]!;
    picked.push(choice);
    usedFiles.add(choice.file);
  }
  return picked;
}
