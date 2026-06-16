import { describe, it, expect } from 'vitest';
import { handToCounts, tileToIndex } from '../src/tiles';
import { canWinStandard, classifyChiDui, canWin } from '../src/winning';

const W = (r: number) => tileToIndex({ suit: 'W', rank: r as any });
const T = (r: number) => tileToIndex({ suit: 'T', rank: r as any });

describe('标准型胡牌', () => {
  it('123W 123W 789W 99W(将) + 555T 一刻 = 胡', () => {
    const hand = handToCounts([
      W(1), W(2), W(3), W(1), W(2), W(3),
      W(7), W(8), W(9), W(9), W(9),
      T(5), T(5), T(5),
    ]);
    expect(canWinStandard(hand, 0)).toBe(true);
  });
  it('meldCount=3 时 123W + 55W(将) = 胡', () => {
    const hand = handToCounts([W(1), W(2), W(3), W(5), W(5)]);
    expect(canWinStandard(hand, 3)).toBe(true);
    const bad = handToCounts([W(1), W(2), W(4), W(5), W(5)]);
    expect(canWinStandard(bad, 3)).toBe(false);
  });
});

describe('七对系列', () => {
  it('七对（无龙）', () => {
    const hand = handToCounts([
      W(1), W(1), W(2), W(2), W(3), W(3), W(4), W(4),
      W(5), W(5), W(6), W(6), T(9), T(9),
    ]);
    expect(classifyChiDui(hand)).toEqual({ isChiDui: true, longs: 0 });
  });
  it('龙七对（含 1 组 4 张）', () => {
    const hand = handToCounts([
      W(1), W(1), W(1), W(1), W(2), W(2), W(3), W(3),
      W(4), W(4), W(5), W(5), T(9), T(9),
    ]);
    expect(classifyChiDui(hand)).toEqual({ isChiDui: true, longs: 1 });
  });
  it('非对子手牌不是七对', () => {
    const hand = handToCounts([W(1), W(2), W(2), W(3), W(3), W(4)]);
    expect(classifyChiDui(hand).isChiDui).toBe(false);
  });
});

describe('canWin 含缺门校验', () => {
  it('手中含缺门不能胡', () => {
    const hand = handToCounts([
      W(1), W(2), W(3), W(1), W(2), W(3),
      W(7), W(8), W(9), W(9), W(9), T(5), T(5), T(5),
    ]);
    expect(canWin(hand, [], 'T')).toBe(false); // 缺条但手里有条
    expect(canWin(hand, [], 'B')).toBe(true);  // 缺筒，手里无筒
  });
});
