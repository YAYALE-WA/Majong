import { create } from 'zustand';
import {
  GameSession, BasicBot,
  type GameConfig, type GameState, type Suit, type TileIndex, type Counts,
} from '@majiang/engine';

export const HUMAN: 0 = 0;
const AI_DELAY = 600; // AI 思考延迟(ms)

/** Counts(27) → 升序展开的 tile 数组（供 UI 渲染手牌） */
export function countsToTiles(c: Counts): TileIndex[] {
  const out: TileIndex[] = [];
  for (let i = 0; i < 27; i++) for (let k = 0; k < c[i]!; k++) out.push(i);
  return out;
}

type GameStore = {
  session: GameSession | null;
  state: GameState | null;
  bot: BasicBot;
  selectedTile: TileIndex | null;
  // 派生：当前轮到人类且需出牌
  startGame: (cfg: GameConfig) => void;
  chooseLackHuman: (suit: Suit) => void;
  selectTile: (t: TileIndex) => void;
  discardHuman: (t: TileIndex) => void;
  humanRespond: (action: 'PONG' | 'GANG' | 'WIN' | 'PASS') => void;
  nextRound: () => void;
  sync: () => void;
  tick: () => void; // 推进 AI / 自动流程
};

export const useGameStore = create<GameStore>((set, get) => {
  // 调度：在非人类回合自动推进，带延迟
  function schedule() {
    setTimeout(() => get().tick(), AI_DELAY);
  }

  return {
    session: null,
    state: null,
    bot: new BasicBot(),
    selectedTile: null,

    startGame: (cfg) => {
      const session = new GameSession(cfg, { dealer: HUMAN });
      const bot = get().bot;
      // AI（座位1-3）自动定缺
      for (let s = 1; s < 4; s++) {
        session.chooseLack(s as 1 | 2 | 3, bot.chooseLack(session.getState(), s as 1 | 2 | 3));
      }
      set({ session, state: session.getState(), selectedTile: null });
      // 人类定缺由 LackModal 驱动
    },

    chooseLackHuman: (suit) => {
      const { session } = get();
      if (!session) return;
      session.chooseLack(HUMAN, suit);
      set({ state: session.getState() });
      schedule();
    },

    selectTile: (t) => set({ selectedTile: t }),

    discardHuman: (t) => {
      const { session } = get();
      if (!session) return;
      session.discard(HUMAN, t);
      set({ state: session.getState(), selectedTile: null });
      schedule();
    },

    humanRespond: (action) => {
      const { session } = get();
      if (!session) return;
      const st = session.getState();
      const tile = st.lastDiscard?.tile;
      if (action === 'WIN') session.winFromDiscard(HUMAN);
      else if (action === 'GANG' && tile !== undefined) session.gangFromDiscard(HUMAN);
      else if (action === 'PONG') session.pong(HUMAN);
      else session.pass(HUMAN);
      set({ state: session.getState(), selectedTile: null });
      schedule();
    },

    nextRound: () => {
      const { session } = get();
      if (!session) return;
      session.nextRound();
      const st = session.getState();
      // 新局 AI 自动定缺
      if (st.phase === 'CHOOSE_LACK') {
        const bot = get().bot;
        for (let s = 1; s < 4; s++) {
          session.chooseLack(s as 1 | 2 | 3, bot.chooseLack(session.getState(), s as 1 | 2 | 3));
        }
      }
      set({ state: session.getState(), selectedTile: null });
    },

    sync: () => set({ state: get().session?.getState() ?? null }),

    tick: () => {
      const { session, bot } = get();
      if (!session) return;
      const st = session.getState();
      if (st.phase !== 'PLAYING') { set({ state: st }); return; }

      // 1) 有待响应：先处理 AI 响应者；人类响应者等待 UI
      if (st.pendingResponses.length > 0) {
        const aiResponders = st.pendingResponses.filter((s) => s !== HUMAN);
        const humanPending = st.pendingResponses.includes(HUMAN);
        for (const seat of aiResponders.slice()) {
          const r = bot.respondToDiscard(session.getState(), seat, st.lastDiscard!.tile);
          if (r.action === 'WIN') session.winFromDiscard(seat);
          else if (r.action === 'GANG') session.gangFromDiscard(seat);
          else if (r.action === 'PONG') session.pong(seat);
          else session.pass(seat);
        }
        set({ state: session.getState() });
        if (!humanPending && session.getState().phase === 'PLAYING') schedule();
        return;
      }

      // 2) 轮到某家出牌阶段
      const seat = st.turn;
      if (seat === HUMAN) { set({ state: st }); return; } // 等待人类操作

      // AI 自摸阶段决策
      const r = bot.respondToSelfDraw(session.getState(), seat, 0);
      if (r.action === 'WIN') session.winSelf(seat);
      else if (r.action === 'GANG') session.gang(seat, r.gangTile!, r.kind!);
      else session.discard(seat, r.discard!);
      set({ state: session.getState() });
      if (session.getState().phase === 'PLAYING') schedule();
    },
  };
});
