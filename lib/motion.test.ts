import { describe, expect, it } from 'vitest';
import { WANDER_DELAY, calmEase, randomWanderDelay, walkableNeighbors } from './motion';

describe('calm grid motion', () => {
  it('offers only adjacent in-bounds cells and excludes occupied cells', () => {
    expect(walkableNeighbors({tileX:0,tileY:0}, [{tileX:1,tileY:0}])).toEqual([{tileX:0,tileY:1}]);
    expect(walkableNeighbors({tileX:4,tileY:4}, [])).toHaveLength(2);
  });
  it('starts and ends on exact tile coordinates without overshoot', () => {
    expect(calmEase(0)).toBe(0);
    expect(calmEase(1)).toBe(1);
    const samples = Array.from({length:101}, (_,i) => calmEase(i/100));
    expect(samples.every((v,i) => v >= 0 && v <= 1 && (!i || v >= samples[i-1]))).toBe(true);
  });
  it('gives each wander an independently variable short rest', () => {
    expect(randomWanderDelay(true, () => 0)).toBe(WANDER_DELAY.initialMin);
    expect(randomWanderDelay(true, () => 1)).toBe(WANDER_DELAY.initialMax);
    expect(randomWanderDelay(false, () => 0)).toBe(WANDER_DELAY.restMin);
    expect(randomWanderDelay(false, () => 1)).toBe(WANDER_DELAY.restMax);
    expect(randomWanderDelay(false, () => .17)).not.toBe(randomWanderDelay(false, () => .83));
  });
});
