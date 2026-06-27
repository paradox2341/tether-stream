import { describe, it, expect } from 'vitest';
import { computeUnlocked, computeClaimable, vestProgressPct } from './vesting';

// 100 TTH locked, starting at t=100, over a 10s duration.
const LOCKED = 100;
const START = 100;
const DURATION = 10;

describe('computeUnlocked (linear vesting, mirrors the channel contract)', () => {
  it('unlocks nothing at the start', () => {
    expect(computeUnlocked(LOCKED, START, DURATION, 100)).toBe(0);
  });

  it('unlocks 50% at the half-way point', () => {
    expect(computeUnlocked(LOCKED, START, DURATION, 105)).toBe(50);
  });

  it('unlocks 100% exactly at the duration', () => {
    expect(computeUnlocked(LOCKED, START, DURATION, 110)).toBe(100);
  });

  it('caps at 100% past the duration', () => {
    expect(computeUnlocked(LOCKED, START, DURATION, 200)).toBe(100);
  });

  it('never unlocks before the channel starts', () => {
    expect(computeUnlocked(LOCKED, START, DURATION, 50)).toBe(0);
  });

  it('returns 0 for a zero-duration channel (no divide-by-zero)', () => {
    expect(computeUnlocked(LOCKED, START, 0, 105)).toBe(0);
  });
});

describe('computeClaimable (unlocked minus already-released)', () => {
  it('is the full unlocked amount when nothing has been released', () => {
    expect(computeClaimable(LOCKED, START, DURATION, 0, 105)).toBe(50);
  });

  it('subtracts capital already released', () => {
    expect(computeClaimable(LOCKED, START, DURATION, 30, 105)).toBe(20);
  });

  it('never goes negative when more was released than is currently unlocked', () => {
    expect(computeClaimable(LOCKED, START, DURATION, 60, 105)).toBe(0);
  });
});

describe('vestProgressPct', () => {
  it('is 0% at the start', () => {
    expect(vestProgressPct(START, DURATION, 100)).toBe(0);
  });

  it('is 50% half-way through', () => {
    expect(vestProgressPct(START, DURATION, 105)).toBe(50);
  });

  it('clamps to 100% past the duration', () => {
    expect(vestProgressPct(START, DURATION, 999)).toBe(100);
  });
});
