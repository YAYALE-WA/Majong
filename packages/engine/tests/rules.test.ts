import { describe, it, expect } from 'vitest';
import { handToCounts, tileToIndex } from '../src/tiles';
import { canPong, canGangFromDiscard, canGangSelf, validLack } from '../src/rules';

const W = (r: number) => tileToIndex({ suit: 'W', rank: r as any });

describe('碰/杠校验', () => {
  it('有 2 张可碰', () => {
    const hand = handToCounts([W(5), W(5), W(1)]);
    expect(canPong(hand, W(5))).toBe(true);
    expect(canPong(hand, W(1))).toBe(false);
  });
  it('有 3 张可直杠（别人打出）', () => {
    const hand = handToCounts([W(5), W(5), W(5)]);
    expect(canGangFromDiscard(hand, W(5))).toBe(true);
  });
  it('手中 4 张可暗杠', () => {
    const hand = handToCounts([W(5), W(5), W(5), W(5)]);
    expect(canGangSelf(hand, W(5))).toBe(true);
  });
});

describe('定缺校验', () => {
  it('合法花色', () => {
    expect(validLack('W')).toBe(true);
    expect(validLack('T')).toBe(true);
    expect(validLack('B')).toBe(true);
  });
});
