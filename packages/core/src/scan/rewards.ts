import { CHALLENGE_SIZE } from "./attestation";

/** The most paid places a release opens; later scans are recorded and earn nothing. */
export const PAID_SCANS_PER_RELEASE = 100;
/** The fewest paid places a release opens, so every release gets fresh reviews even when little is unexamined. */
export const MIN_PAID_SCANS_PER_RELEASE = 10;
/** The first this-many paid scans of a release earn the full reward; the rest earn the tail reward. */
export const FULL_REWARD_SCANS = 20;
/** A full-reward scan earns 1/1000 (0.1%) of the previous day's total holding points. */
const FULL_REWARD_DIVISOR = 1000n;
/** A tail scan earns 1/5000 (0.02%). */
const TAIL_REWARD_DIVISOR = 5000n;

/** Both scan rewards for a day that issued `issuedAtomic` holding points, truncated. */
export function scanRewards(issuedAtomic: bigint): { fullAtomic: bigint; tailAtomic: bigint } {
  return { fullAtomic: issuedAtomic / FULL_REWARD_DIVISOR, tailAtomic: issuedAtomic / TAIL_REWARD_DIVISOR };
}

/**
 * The paid places a release opens when it has `unexamined` surface functions
 * no scan has examined in their current form: enough scans to answer each
 * once, within the floor and the cap.
 */
export function paidPlacesFor(unexamined: number): number {
  const needed = Math.ceil(Math.max(0, unexamined) / CHALLENGE_SIZE);
  return Math.min(PAID_SCANS_PER_RELEASE, Math.max(MIN_PAID_SCANS_PER_RELEASE, needed));
}

/** Whether the next scan of a release that already has `paidScans` paid scans earns the full reward. */
export function nextScanIsFull(paidScans: number): boolean {
  return paidScans < FULL_REWARD_SCANS;
}

/** Each further round a wallet scans in one release earns this much more than the base reward, per round. */
export const ROUND_STEP_PERCENT = 10;

/** What round `round` (1 for a wallet's first scan of a release) earns on a place worth `baseAtomic`, truncated. */
export function roundReward(baseAtomic: bigint, round: number): bigint {
  if (!Number.isInteger(round) || round < 1) throw new Error(`A round is a whole number from 1, got ${round}.`);
  return (baseAtomic * BigInt(100 + ROUND_STEP_PERCENT * (round - 1))) / 100n;
}
