import { describe, it, expect } from 'vitest';
import { handToCounts, tileToIndex } from '../src/tiles';
import { computeFan, type FanContext } from '../src/fan';
import type { Meld } from '../src/types';

const W = (r: number) => tileToIndex({ suit: 'W', rank: r as any });
const T = (r: number) => tileToIndex({ suit: 'T', rank: r as any });
const B = (r: number) => tileToIndex({ suit: 'B', rank: r as any });

const ctx = (over: Partial<FanContext> = {}): FanContext => ({
  zimo: false, gangFlower: false, haidi: false, qiangGang: false,
  baseScore: 1, capFan: null, ...over,
});

describe('牌型基础番', () => {
  it('平胡 = 0 番', () => {
    const hand = handToCounts([W(1),W(2),W(3),W(4),W(5),W(6),T(2),T(3),T(4),B(5),B(6),B(7),B(9),B(9)]);
    const r = computeFan(hand, [], ctx());
    expect(r.basePattern).toBe('平胡');
    expect(r.baseFan).toBe(0);
  });
  it('对对胡 = 1 番', () => {
    const hand = handToCounts([W(1),W(1),W(1),W(5),W(5),W(5),T(3),T(3),T(3),B(7),B(7),B(7),B(9),B(9)]);
    const r = computeFan(hand, [], ctx());
    expect(r.basePattern).toBe('对对胡');
    expect(r.baseFan).toBe(1);
  });
  it('清一色 = 2 番', () => {
    const hand = handToCounts([W(1),W(2),W(3),W(4),W(5),W(6),W(7),W(8),W(9),W(1),W(1),W(9),W(5),W(5)]);
    const r = computeFan(hand, [], ctx());
    expect(r.basePattern).toContain('清一色');
    expect(r.baseFan).toBe(2);
  });
  it('七对 = 2 番（基础），天然门清 +1', () => {
    const hand = handToCounts([W(1),W(1),W(2),W(2),W(3),W(3),W(4),W(4),T(5),T(5),T(6),T(6),B(9),B(9)]);
    const r = computeFan(hand, [], ctx());
    expect(r.basePattern).toBe('七对');
    expect(r.baseFan).toBe(2);
    expect(r.addOns.some((a) => a.name === '门清')).toBe(true);
    expect(r.totalFan).toBe(3); // 七对2 + 门清1
  });
  it('龙七对 = 3 番（基础）', () => {
    const hand = handToCounts([W(1),W(1),W(1),W(1),W(2),W(2),W(3),W(3),T(5),T(5),T(6),T(6),B(9),B(9)]);
    const r = computeFan(hand, [], ctx());
    expect(r.basePattern).toBe('龙七对');
    expect(r.baseFan).toBe(3);
  });
});

describe('副露牌型', () => {
  it('金钩钓（4 明副露 + 单吊将）= 2 番', () => {
    const melds: Meld[] = [
      { kind: 'PONG', tile: W(1) },
      { kind: 'PONG', tile: W(5) },
      { kind: 'PONG', tile: T(3) },
      { kind: 'GANG_MING', tile: B(7), from: 1 },
    ];
    const hand = handToCounts([B(9), B(9)]); // 单吊将
    const r = computeFan(hand, melds, ctx());
    expect(r.basePattern).toBe('金钩钓');
    expect(r.baseFan).toBe(2);
  });
  it('含暗杠不算金钩钓（仍是对对胡）', () => {
    const melds: Meld[] = [
      { kind: 'PONG', tile: W(1) },
      { kind: 'PONG', tile: W(5) },
      { kind: 'PONG', tile: T(3) },
      { kind: 'GANG_AN', tile: B(7) }, // 暗杠
    ];
    const hand = handToCounts([B(9), B(9)]);
    const r = computeFan(hand, melds, ctx());
    expect(r.basePattern).toBe('对对胡');
  });
  it('十八罗汉（4 杠 + 将）= 5 番，且 4 杠计 4 根', () => {
    const melds: Meld[] = [
      { kind: 'GANG_MING', tile: W(1), from: 1 },
      { kind: 'GANG_AN', tile: W(5) },
      { kind: 'GANG_MING', tile: T(3), from: 2 },
      { kind: 'GANG_BU', tile: B(7) },
    ];
    const hand = handToCounts([B(9), B(9)]);
    const r = computeFan(hand, melds, ctx());
    expect(r.basePattern).toBe('十八罗汉');
    expect(r.baseFan).toBe(5);
    const gen = r.addOns.find((a) => a.name.startsWith('根'));
    expect(gen?.fan).toBe(4); // 4 个杠 = 4 根
  });
});

describe('加番', () => {
  it('碰后手中保留第 4 张计 1 根', () => {
    // 碰 W1（3 张副露），手中第 4 张 W1 并入顺子 W1W2W3
    // 共 4 张 W1（3 碰 + 1 手），合法。手牌：W1W2W3 T1T2T3 B1B2B3 B9B9
    const melds: Meld[] = [{ kind: 'PONG', tile: W(1) }];
    const hand = handToCounts([W(1),W(2),W(3),T(1),T(2),T(3),B(1),B(2),B(3),B(9),B(9)]);
    const r = computeFan(hand, melds, ctx());
    // 碰的是 W1，手中 W1=1 >=1 → 计 1 根
    const gen = r.addOns.find((a) => a.name.startsWith('根'));
    expect(gen?.fan).toBe(1);
  });
  it('自摸 +1 番（用含碰的牌型隔离门清）', () => {
    // 碰 W1；暗牌 W2W3W4 T2T3T4 B5B6B7 B9B9 → 平胡（有碰，非门清）
    const melds: Meld[] = [{ kind: 'PONG', tile: W(1) }];
    const hand = handToCounts([W(2),W(3),W(4),T(2),T(3),T(4),B(5),B(6),B(7),B(9),B(9)]);
    const r = computeFan(hand, melds, ctx({ zimo: true }));
    expect(r.basePattern).toBe('平胡');
    expect(r.addOns.some((a) => a.name === '门清')).toBe(false);
    expect(r.totalFan).toBe(1); // 平胡0 + 自摸1
    expect(r.score).toBe(2);    // 1 * 2^1
  });
  it('海底（点炮也可由 haidi 标志置位）+1 番', () => {
    const melds: Meld[] = [{ kind: 'PONG', tile: W(1) }];
    const hand = handToCounts([W(2),W(3),W(4),T(2),T(3),T(4),B(5),B(6),B(7),B(9),B(9)]);
    const r = computeFan(hand, melds, ctx({ haidi: true }));
    expect(r.addOns.some((a) => a.name === '海底')).toBe(true);
    expect(r.totalFan).toBe(1);
  });
  it('完全暗手天然门清 +1（自摸暗手 = 自摸1 + 门清1）', () => {
    const hand = handToCounts([W(1),W(2),W(3),W(4),W(5),W(6),T(2),T(3),T(4),B(5),B(6),B(7),B(9),B(9)]);
    const r = computeFan(hand, [], ctx({ zimo: true }));
    expect(r.addOns.some((a) => a.name === '门清')).toBe(true);
    expect(r.totalFan).toBe(2); // 平胡0 + 自摸1 + 门清1
  });
});

describe('封顶', () => {
  it('封顶生效', () => {
    const hand = handToCounts([W(1),W(1),W(1),W(1),W(2),W(2),W(3),W(3),T(5),T(5),T(6),T(6),B(9),B(9)]);
    // 龙七对3 + 自摸1 = 4 -> 封顶3
    const r = computeFan(hand, [], ctx({ zimo: true, capFan: 3 }));
    expect(r.cappedFan).toBe(3);
    expect(r.score).toBe(8); // 1 * 2^3
  });
});
