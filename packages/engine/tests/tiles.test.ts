import { describe, it, expect } from 'vitest';
import {
  tileToIndex, indexToTile, suitOfIndex, makeWall,
  emptyCounts, countsAdd, countsRemove, handToCounts, countsTotal,
} from '../src/tiles';

describe('tiles 编码', () => {
  it('五万 <-> index 4', () => {
    expect(tileToIndex({ suit: 'W', rank: 5 })).toBe(4);
    expect(indexToTile(4)).toEqual({ suit: 'W', rank: 5 });
  });
  it('一条 = 9, 九筒 = 26', () => {
    expect(tileToIndex({ suit: 'T', rank: 1 })).toBe(9);
    expect(tileToIndex({ suit: 'B', rank: 9 })).toBe(26);
  });
  it('suitOfIndex', () => {
    expect(suitOfIndex(0)).toBe('W');
    expect(suitOfIndex(9)).toBe('T');
    expect(suitOfIndex(18)).toBe('B');
  });
});

describe('牌堆', () => {
  it('makeWall 共 108 张，每种 4 张', () => {
    const wall = makeWall();
    expect(wall.length).toBe(108);
    const counts = emptyCounts();
    for (const t of wall) counts[t] += 1;
    expect(counts.every((c) => c === 4)).toBe(true);
  });
});

describe('Counts 工具', () => {
  it('add/remove/total/handToCounts', () => {
    let c = emptyCounts();
    c = countsAdd(c, 4);
    c = countsAdd(c, 4);
    expect(countsTotal(c)).toBe(2);
    c = countsRemove(c, 4);
    expect(c[4]).toBe(1);
    const h = handToCounts([0, 0, 9]);
    expect(h[0]).toBe(2);
    expect(h[9]).toBe(1);
  });
});
