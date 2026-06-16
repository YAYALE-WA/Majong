import { describe, it, expect } from 'vitest';
import { GameSession } from '../src/session';
import { BasicBot } from '../src/ai/basicBot';
import { makeWall, shuffle } from '../src/tiles';
import type { GameConfig, Seat } from '../src/types';

// 确定性 RNG（线性同余），按种子复现
function seededRng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const cfg: GameConfig = {
  baseScore: 1, capFan: 7, totalRounds: 1,
  enableQiangGang: true, enableTuiShui: true,
};

/** 用 4 个 BasicBot 把一局打到结束，返回 session */
function playGame(seed: number): GameSession {
  const bot = new BasicBot();
  const rng = seededRng(seed);
  const s = new GameSession(cfg, { wall: shuffle(makeWall(), rng), dealer: 0 });
  // 定缺
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    s.chooseLack(seat, bot.chooseLack(s.getState(), seat));
  }
  let guard = 0;
  while (s.getState().phase === 'PLAYING' && guard++ < 2000) {
    const st = s.getState();
    // 处理待响应（一炮多响：所有可胡者都胡）
    if (st.pendingResponses.length > 0) {
      for (const seat of st.pendingResponses.slice()) {
        const r = bot.respondToDiscard(st, seat, st.lastDiscard!.tile);
        if (r.action === 'WIN') s.winFromDiscard(seat);
        else if (r.action === 'GANG') s.gangFromDiscard(seat);
        else if (r.action === 'PONG') s.pong(seat);
        else s.pass(seat);
      }
      continue;
    }
    // turn 座位自摸阶段
    const seat = st.turn;
    const p = st.players[seat]!;
    if (p.hasLeft) break;
    const drawn = st.players[seat]!; // drawn 牌已在手牌中
    const r = bot.respondToSelfDraw(st, seat, 0);
    if (r.action === 'WIN') {
      s.winSelf(seat);
    } else if (r.action === 'GANG') {
      s.gang(seat, r.gangTile!, r.kind!);
    } else {
      s.discard(seat, r.discard!);
    }
    void drawn;
  }
  return s;
}

describe('AI 互打：零和守恒总闸', () => {
  it('30 副不同牌局，每局四家 roundScore 之和恒为 0，无异常', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = playGame(seed);
      const st = s.getState();
      expect(['ROUND_END', 'PLAYING']).toContain(st.phase);
      const total = st.players.reduce((a, p) => a + p.roundScore, 0);
      expect(total, `seed=${seed} 分数不守恒`).toBe(0);
    }
  });

  it('整局结束后大多数能走到 ROUND_END（不卡死）', () => {
    let ended = 0;
    for (let seed = 1; seed <= 30; seed++) {
      if (playGame(seed).getState().phase === 'ROUND_END') ended++;
    }
    expect(ended).toBeGreaterThanOrEqual(25);
  });

  it('血战事件真实发生（多副内出现胡牌与杠/副露）', () => {
    let totalWins = 0;
    let totalMelds = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const st = playGame(seed).getState();
      totalWins += st.players.filter((p) => p.winRecord !== null).length;
      totalMelds += st.players.reduce((a, p) => a + p.melds.length, 0);
    }
    // 30 副里应有相当数量的胡牌和副露（碰/杠），证明不是每局都空流局
    expect(totalWins).toBeGreaterThan(0);
    expect(totalMelds).toBeGreaterThan(0);
  });
});
