import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, countsToTiles, HUMAN } from './gameStore';
import { emptyCounts } from '@majiang/engine';
import type { GameConfig } from '@majiang/engine';

const cfg: GameConfig = {
  baseScore: 1, capFan: 7, totalRounds: 1,
  enableQiangGang: true, enableTuiShui: true,
};

describe('countsToTiles', () => {
  it('展开 Counts 为升序 tile 数组', () => {
    const c = emptyCounts();
    c[4] = 2; c[9] = 1;
    expect(countsToTiles(c)).toEqual([4, 4, 9]);
  });
});

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.setState({ session: null, state: null, selectedTile: null });
  });

  it('startGame 后进入 CHOOSE_LACK，AI 已定缺，人类待定缺', () => {
    useGameStore.getState().startGame(cfg);
    const st = useGameStore.getState().state!;
    expect(st.phase).toBe('CHOOSE_LACK');
    expect(st.players[1]!.lackSuit).not.toBeNull(); // AI 已定缺
    expect(st.players[2]!.lackSuit).not.toBeNull();
    expect(st.players[3]!.lackSuit).not.toBeNull();
    expect(st.players[HUMAN]!.lackSuit).toBeNull(); // 人类待定缺
  });

  it('人类定缺后进入 PLAYING', () => {
    useGameStore.getState().startGame(cfg);
    useGameStore.getState().chooseLackHuman('B');
    expect(useGameStore.getState().state!.phase).toBe('PLAYING');
  });
});
