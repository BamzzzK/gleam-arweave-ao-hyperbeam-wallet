import { CHALLENGE_SIZE } from "./attestation";

/** The most paid places a release opens; later scans are recorded and earn nothing. */
export const PAID_SCANS_PER_RELEASE = 100;
/** The fewest paid places a release opens, so a release with nothing unexamined still pays one scan. */
export const MIN_PAID_SCANS_PER_RELEASE = 1;
/** A paid scan earns 1/1000 (0.1%) of the previous day's total holding points. */
const SCAN_REWARD_DIVISOR = 1000n;

/** What a paid scan earns on a day that issued `issuedAtomic` holding points, truncated. */
export function scanRewardOf(issuedAtomic: bigint): bigint {
  return issuedAtomic / SCAN_REWARD_DIVISOR;
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

/** Each further round a wallet scans in one release earns this much more than the base reward, per round. */
export const ROUND_STEP_PERCENT = 10;

/** What round `round` (1 for a wallet's first scan of a release) earns on a place worth `baseAtomic`, truncated. */
export function roundReward(baseAtomic: bigint, round: number): bigint {
  if (!Number.isInteger(round) || round < 1) throw new Error(`A round is a whole number from 1, got ${round}.`);
  return (baseAtomic * BigInt(100 + ROUND_STEP_PERCENT * (round - 1))) / 100n;
}
