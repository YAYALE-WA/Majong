import { describe, it, expect } from 'vitest';
import type { Tile, Meld, GameConfig } from '../src/types';
import { SUITS } from '../src/types';

describe('types', () => {
  it('SUITS 常量含三门', () => {
    expect(SUITS).toEqual(['W', 'T', 'B']);
  });
  it('可构造 Tile / Meld / GameConfig', () => {
    const t: Tile = { suit: 'W', rank: 5 };
    const m: Meld = { kind: 'PONG', tile: 4 };
    const c: GameConfig = {
      baseScore: 1, capFan: 7, totalRounds: 8,
      enableQiangGang: true, enableTuiShui: true,
    };
    expect(t.rank).toBe(5);
    expect(m.kind).toBe('PONG');
    expect(c.totalRounds).toBe(8);
  });
});
