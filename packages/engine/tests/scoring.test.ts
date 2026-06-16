import { describe, it, expect } from 'vitest';
import { settleWin, settleGang, settleDraw, settleTuiShui } from '../src/scoring';
import type { FanResult } from '../src/types';

const fan = (score: number): FanResult => ({
  baseFan: 0, basePattern: 't', addOns: [], totalFan: 0, cappedFan: 0, score,
});
const active4: boolean[] = [true, true, true, true];

describe('番型付分', () => {
  it('点炮：仅放炮家付', () => {
    const d = settleWin({ winner: 0, from: 1, zimo: false, fan: fan(8), active: active4 });
    expect(d).toEqual([8, -8, 0, 0]);
    expect(d.reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('自摸：三家各付', () => {
    const d = settleWin({ winner: 0, from: null, zimo: true, fan: fan(4), active: active4 });
    expect(d).toEqual([12, -4, -4, -4]);
    expect(d.reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('自摸时已下桌者不付', () => {
    const active = [true, true, false, true]; // seat2 已下桌
    const d = settleWin({ winner: 0, from: null, zimo: true, fan: fan(4), active });
    expect(d[2]).toBe(0);
    expect(d[0]).toBe(8); // 两家各付 4
    expect(d.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('杠分', () => {
  it('明杠：放杠家付 2', () => {
    const d = settleGang({ ganger: 0, kind: 'GANG_MING', from: 2, baseScore: 1, active: active4 });
    expect(d[0]).toBe(2); expect(d[2]).toBe(-2);
    expect(d.reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('暗杠：三家各付 2', () => {
    const d = settleGang({ ganger: 0, kind: 'GANG_AN', from: null, baseScore: 1, active: active4 });
    expect(d[0]).toBe(6); expect(d[1]).toBe(-2); expect(d[2]).toBe(-2); expect(d[3]).toBe(-2);
  });
  it('补杠：三家各付 1', () => {
    const d = settleGang({ ganger: 0, kind: 'GANG_BU', from: null, baseScore: 1, active: active4 });
    expect(d[0]).toBe(3); expect(d[1]).toBe(-1);
  });
  it('暗杠时已下桌者不付', () => {
    const active = [true, true, false, true];
    const d = settleGang({ ganger: 0, kind: 'GANG_AN', from: null, baseScore: 1, active });
    expect(d[2]).toBe(0);
    expect(d[0]).toBe(4); // 两家付
    expect(d.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('流局查大叫', () => {
  it('未听赔给听牌未胡者', () => {
    const d = settleDraw({
      tingScores: [8, 4, null, null],
      hasLeft: [false, false, false, true], // seat3 已胡不参与
    });
    expect(d[2]).toBe(-12); expect(d[0]).toBe(8); expect(d[1]).toBe(4); expect(d[3]).toBe(0);
    expect(d.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('退税', () => {
  it('退还杠分', () => {
    const d = settleTuiShui([{ ganger: 0, from: 1, amount: 2 }, { ganger: 0, from: 2, amount: 2 }]);
    expect(d[0]).toBe(-4); expect(d[1]).toBe(2); expect(d[2]).toBe(2);
    expect(d.reduce((a, b) => a + b, 0)).toBe(0);
  });
});
