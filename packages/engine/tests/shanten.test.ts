import { describe, it, expect } from 'vitest';
import { handToCounts, tileToIndex } from '../src/tiles';
import { shanten } from '../src/shanten';

const W = (r: number) => tileToIndex({ suit: 'W', rank: r as any });
const T = (r: number) => tileToIndex({ suit: 'T', rank: r as any });

describe('向听数', () => {
  it('已胡牌（标准型，含将）向听 = -1', () => {
    const hand = handToCounts([
      W(1), W(2), W(3), W(1), W(2), W(3),
      W(7), W(8), W(9), W(9), W(9), T(5), T(5), T(5),
    ]);
    expect(shanten(hand, 0)).toBe(-1);
  });
  it('听牌（差 1 张）向听 = 0', () => {
    // 123W 123W 789W 99W(将) + 55T 听 5T
    const hand = handToCounts([
      W(1), W(2), W(3), W(1), W(2), W(3),
      W(7), W(8), W(9), W(9), W(9), T(5), T(5),
    ]);
    expect(shanten(hand, 0)).toBe(0);
  });
  it('七对听牌向听 = 0', () => {
    const hand = handToCounts([
      W(1), W(1), W(2), W(2), W(3), W(3), W(4), W(4),
      W(5), W(5), W(6), W(6), T(9),
    ]);
    expect(shanten(hand, 0)).toBe(0);
  });
  it('4 面子（副露）+ 搭子无将 ≠ 胡，向听 = 0', () => {
    // meldCount=4，暗牌 [1W,2W] 是搭子而非将 → 不是胡牌
    const hand = handToCounts([W(1), W(2)]);
    expect(shanten(hand, 4)).toBe(0);
  });
  it('14 张：4 面子 + 搭子无将 ≠ 胡，向听 = 0', () => {
    // W1W2W3 W4W5W6 W7W8W9 T1T2T3 + T4T5（搭子，无将）
    const hand = handToCounts([
      W(1), W(2), W(3), W(4), W(5), W(6), W(7), W(8), W(9),
      T(1), T(2), T(3), T(4), T(5),
    ]);
    expect(shanten(hand, 0)).toBe(0);
  });
  it('4 面子（副露）+ 真将（金钩钓）= 胡，向听 = -1', () => {
    // meldCount=4，暗牌 [5W,5W] 是真将 → 胡牌
    const hand = handToCounts([W(5), W(5)]);
    expect(shanten(hand, 4)).toBe(-1);
  });
});
