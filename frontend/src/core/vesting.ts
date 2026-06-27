/**
 * Linear vesting math for TetherStream capital channels.
 *
 * These pure functions mirror the on-chain `compute_unlocked_capital` logic in
 * the `channel` contract, so the live UI ticker and the smart contract agree on
 * how much capital has unlocked at any point in time:
 *
 *   unlocked = locked_capital × min(elapsed, duration) / duration
 */

/** Capital linearly unlocked at `nowSec` (denominated TTH). */
export function computeUnlocked(
  lockedCapital: number,
  epochStart: number,
  channelDuration: number,
  nowSec: number
): number {
  if (channelDuration <= 0) return 0;
  const elapsed = Math.max(0, nowSec - epochStart);
  if (elapsed >= channelDuration) return lockedCapital;
  return (lockedCapital * elapsed) / channelDuration;
}

/** Capital currently claimable: unlocked minus what has already been released. */
export function computeClaimable(
  lockedCapital: number,
  epochStart: number,
  channelDuration: number,
  capitalReleased: number,
  nowSec: number
): number {
  const unlocked = computeUnlocked(
    lockedCapital,
    epochStart,
    channelDuration,
    nowSec
  );
  return Math.max(0, unlocked - capitalReleased);
}

/** Vesting progress as a percentage in the range [0, 100]. */
export function vestProgressPct(
  epochStart: number,
  channelDuration: number,
  nowSec: number
): number {
  if (channelDuration <= 0) return 0;
  const elapsed = Math.max(0, nowSec - epochStart);
  return Math.min(100, (elapsed / channelDuration) * 100);
}
