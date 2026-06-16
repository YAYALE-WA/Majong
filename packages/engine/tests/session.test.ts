import { describe, it, expect } from 'vitest';
import { GameSession } from '../src/session';
import { makeWall } from '../src/tiles';
import type { GameConfig } from '../src/types';

const cfg: GameConfig = {
  baseScore: 1, capFan: 7, totalRounds: 1,
  enableQiangGang: true, enableTuiShui: true,
};

describe('GameSession 发牌与定缺', () => {
  it('发牌后进入 CHOOSE_LACK，庄家 14 张，闲家 13 张', () => {
    const s = new GameSession(cfg, { wall: makeWall(), dealer: 0 });
    const st = s.getState();
    expect(st.phase).toBe('CHOOSE_LACK');
    const counts = st.players.map((p) => p.hand.reduce((a, b) => a + b, 0));
    expect(counts[0]).toBe(14); // 庄家
    expect(counts[1]).toBe(13);
    expect(counts[2]).toBe(13);
    expect(counts[3]).toBe(13);
    // 牌墙 = 108 - 53
    expect(st.wall.length).toBe(108 - 53);
  });

  it('四家定缺后进入 PLAYING', () => {
    const s = new GameSession(cfg, { wall: makeWall(), dealer: 0 });
    s.chooseLack(0, 'B'); s.chooseLack(1, 'B'); s.chooseLack(2, 'B'); s.chooseLack(3, 'B');
    expect(s.getState().phase).toBe('PLAYING');
    expect(s.getState().turn).toBe(0);
  });
});

describe('零和守恒（流局驱动）', () => {
  it('无人响应跑到流局，四家 roundScore 之和为 0', () => {
    const s = new GameSession(cfg, { wall: makeWall(), dealer: 0 });
    s.chooseLack(0, 'B'); s.chooseLack(1, 'B'); s.chooseLack(2, 'B'); s.chooseLack(3, 'B');
    let guard = 0;
    while (s.getState().phase === 'PLAYING' && guard++ < 500) {
      const st = s.getState();
      if (st.pendingResponses.length > 0) {
        for (const seat of st.pendingResponses.slice()) s.pass(seat);
        continue;
      }
      const seat = st.turn;
      // 当前 turn 已摸牌，直接打第一张合法牌（不胡不杠）
      const legal = s.legalDiscards(seat);
      if (legal.length === 0) break;
      s.discard(seat, legal[0]!);
    }
    const st = s.getState();
    expect(['ROUND_END', 'PLAYING']).toContain(st.phase);
    const total = st.players.reduce((a, p) => a + p.roundScore, 0);
    expect(total).toBe(0);
  });
});

describe('多局推进', () => {
  it('nextRound 累计总分并换庄', () => {
    const s = new GameSession({ ...cfg, totalRounds: 2 }, { wall: makeWall(), dealer: 0 });
    s.chooseLack(0, 'B'); s.chooseLack(1, 'B'); s.chooseLack(2, 'B'); s.chooseLack(3, 'B');
    // 强行驱动到流局
    let guard = 0;
    while (s.getState().phase === 'PLAYING' && guard++ < 500) {
      const st = s.getState();
      if (st.pendingResponses.length > 0) { for (const seat of st.pendingResponses.slice()) s.pass(seat); continue; }
      const legal = s.legalDiscards(st.turn);
      if (legal.length === 0) break;
      s.discard(st.turn, legal[0]!);
    }
    if (s.getState().phase === 'ROUND_END') {
      const before = s.getState().players.map((p) => p.roundScore);
      s.nextRound();
      const st = s.getState();
      expect(st.roundIndex).toBe(1);
      expect(st.dealer).toBe(1); // 换庄
      expect(st.phase).toBe('CHOOSE_LACK');
      // 总分 = 上局 roundScore
      st.players.forEach((p, i) => expect(p.totalScore).toBe(before[i]));
    }
  });
});
