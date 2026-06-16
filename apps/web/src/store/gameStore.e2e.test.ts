import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from './gameStore';
import type { GameConfig } from '@majiang/engine';

const cfg: GameConfig = {
  baseScore: 1, capFan: 7, totalRounds: 1,
  enableQiangGang: true, enableTuiShui: true,
};

describe('E2E 人类自动出牌跑完一局', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.setState({ session: null, state: null, selectedTile: null });
  });

  it('人类总打第一张合法牌，AI 自动，最终走到 ROUND_END 且零和', () => {
    const store = useGameStore.getState();
    store.startGame(cfg);
    store.chooseLackHuman('B');
    let guard = 0;
    while (useGameStore.getState().state!.phase === 'PLAYING' && guard++ < 4000) {
      const s = useGameStore.getState();
      const session = s.session!;
      const st = s.state!;
      if (st.pendingResponses.includes(0)) {
        s.humanRespond('PASS'); // 人类一律过
      } else if (st.turn === 0 && st.pendingResponses.length === 0 && !st.players[0]!.hasLeft) {
        const legal = session.legalDiscards(0);
        if (legal.length === 0) break;
        s.discardHuman(legal[0]!);
      } else {
        // AI 回合：跑挂起的定时器推进调度
        vi.runOnlyPendingTimers();
      }
    }
    const st = useGameStore.getState().state!;
    expect(['ROUND_END', 'GAME_END']).toContain(st.phase);
    const total = st.players.reduce((a, p) => a + p.roundScore, 0);
    expect(total).toBe(0);
  });
});
