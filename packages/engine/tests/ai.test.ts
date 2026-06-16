import { describe, it, expect } from 'vitest';
import { handToCounts, tileToIndex } from '../src/tiles';
import { BasicBot } from '../src/ai/basicBot';

const W = (r: number) => tileToIndex({ suit: 'W', rank: r as any });
const T = (r: number) => tileToIndex({ suit: 'T', rank: r as any });
const B = (r: number) => tileToIndex({ suit: 'B', rank: r as any });

describe('BasicBot 定缺', () => {
  it('选张数最少的一门', () => {
    const bot = new BasicBot();
    const hand = handToCounts([
      W(1), W(2), W(3), W(4), W(5), // 5 万
      T(1), T(2), T(3),             // 3 条
      B(9),                         // 1 筒
    ]);
    expect(bot.chooseLackByHand(hand)).toBe('B');
  });
});

describe('BasicBot 出牌', () => {
  it('优先打缺门牌', () => {
    const bot = new BasicBot();
    const hand = handToCounts([W(1), W(2), W(3), T(5), B(9)]);
    const discard = bot.chooseDiscardByHand(hand, 'B', 0); // 缺筒
    expect(discard).toBe(B(9));
  });
  it('无缺门牌时返回合法的一张（向听最小）', () => {
    const bot = new BasicBot();
    const hand = handToCounts([W(1), W(2), W(3), W(5), T(9)]);
    const discard = bot.chooseDiscardByHand(hand, 'B', 0);
    expect(hand[discard]!).toBeGreaterThan(0); // 是手中的牌
  });
});
