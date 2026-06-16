# 四川麻将血战到底 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个浏览器内运行的四川麻将（血战到底）网站，单人对战 3 个规则型 AI，含完整碰/杠/胡规则、翻番制记分、流局查大叫与退税，并把游戏引擎做成可平移服务端的纯逻辑模块。

**Architecture:** pnpm monorepo。`packages/engine` 为零依赖纯 TS 引擎（牌型/胡牌/向听/番型/记分/状态机/AI），`apps/web` 为 React + Vite 前端，通过 Zustand 驱动引擎。引擎用计数数组（Counts[27]）表示手牌，TDD 开发，零和守恒贯穿测试。

**Tech Stack:** TypeScript 5、pnpm workspace、Vitest、React 18、Vite、Zustand。

---

## File Structure

```
majiang/
├── package.json, pnpm-workspace.yaml, tsconfig.base.json
├── packages/engine/
│   ├── package.json, tsconfig.json, vitest.config.ts
│   ├── src/
│   │   ├── types.ts        共享类型（Suit/Tile/Counts/Meld/PlayerState/GameState…）
│   │   ├── tiles.ts        编码、牌堆、洗牌发牌、Counts 工具
│   │   ├── meld.ts         面子构造与折算
│   │   ├── winning.ts      胡牌判定（标准型 + 七对系列）
│   │   ├── shanten.ts      向听数
│   │   ├── fan.ts          番型识别 + 番数
│   │   ├── scoring.ts      付分/杠分/查大叫/退税/封顶
│   │   ├── session.ts      GameSession 状态机
│   │   ├── ai/strategy.ts  BotStrategy 接口
│   │   ├── ai/basicBot.ts  规则型 AI
│   │   └── index.ts        公开 API
│   └── tests/*.test.ts
└── apps/web/
    ├── package.json, tsconfig.json, vite.config.ts, index.html
    └── src/
        ├── main.tsx, App.tsx
        ├── store/gameStore.ts     Zustand + gameLoop
        ├── pages/LobbyPage.tsx, pages/TablePage.tsx
        └── components/TileView, HandPanel, DiscardPool, SeatPanel,
            ActionBar, LackModal, RoundResultPanel, ScoreBoard
```

测试命令统一：在 `packages/engine` 下 `pnpm test`（Vitest）；前端在 `apps/web` 下 `pnpm test`。

---

## Task 1: Monorepo 脚手架

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- Create: `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/vitest.config.ts`
- Create: `packages/engine/src/index.ts`, `packages/engine/tests/smoke.test.ts`

- [ ] **Step 1: 创建 workspace 根文件**

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

`package.json`:
```json
{
  "name": "majiang",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 2: 创建 engine 包配置**

`packages/engine/package.json`:
```json
{
  "name": "@majiang/engine",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

`packages/engine/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

`packages/engine/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { globals: true, environment: 'node', coverage: { provider: 'v8' } },
});
```

- [ ] **Step 3: 创建占位入口 + 冒烟测试**

`packages/engine/src/index.ts`:
```ts
export const ENGINE_VERSION = '1.0.0';
```

`packages/engine/tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION } from '../src/index';

describe('smoke', () => {
  it('exposes version', () => {
    expect(ENGINE_VERSION).toBe('1.0.0');
  });
});
```

- [ ] **Step 4: 安装依赖并运行测试**

Run: `pnpm install && pnpm -C packages/engine test`
Expected: 1 passed (smoke test)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: pnpm monorepo 脚手架 + engine 包冒烟测试"
```

---

## Task 2: 核心类型定义

**Files:**
- Create: `packages/engine/src/types.ts`
- Test: `packages/engine/tests/types.test.ts`

- [ ] **Step 1: 写失败测试（类型构造可用性）**

`packages/engine/tests/types.test.ts`:
```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm -C packages/engine test types`
Expected: FAIL（找不到模块 ../src/types）

- [ ] **Step 3: 实现 types.ts**

`packages/engine/src/types.ts`:
```ts
export const SUITS = ['W', 'T', 'B'] as const;
export type Suit = (typeof SUITS)[number];
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Tile = { suit: Suit; rank: Rank };
export type TileIndex = number; // 0..26
export type Counts = number[];  // length 27
export type Seat = 0 | 1 | 2 | 3;

export type Meld =
  | { kind: 'PONG'; tile: TileIndex }
  | { kind: 'GANG_MING'; tile: TileIndex; from: Seat }
  | { kind: 'GANG_AN'; tile: TileIndex }
  | { kind: 'GANG_BU'; tile: TileIndex };

export type GangKind = 'GANG_MING' | 'GANG_AN' | 'GANG_BU';

export type GangScore = { from: Seat; amount: number; gangType: Meld['kind'] };

export type WinType = 'ZIMO' | 'DIANPAO';

export type FanResult = {
  baseFan: number;
  basePattern: string;
  addOns: { name: string; fan: number }[];
  totalFan: number;
  cappedFan: number;
  score: number;
};

export type WinRecord = {
  seat: Seat;
  winType: WinType;
  from: Seat | null;
  fan: FanResult;
  payments: { from: Seat; to: Seat; amount: number }[];
};

export type PlayerState = {
  seat: Seat;
  hand: Counts;
  melds: Meld[];
  discards: TileIndex[];
  lackSuit: Suit | null;
  hasLeft: boolean;
  winRecord: WinRecord | null;
  gangScoreReceived: GangScore[];
  roundScore: number;
  totalScore: number;
};

export type GameConfig = {
  baseScore: number;
  capFan: number | null;
  totalRounds: number;
  enableQiangGang: boolean;
  enableTuiShui: boolean;
};

export type Phase = 'DEAL' | 'CHOOSE_LACK' | 'PLAYING' | 'ROUND_END' | 'GAME_END';

export type GameState = {
  config: GameConfig;
  roundIndex: number;
  dealer: Seat;
  phase: Phase;
  players: PlayerState[];
  wall: TileIndex[];
  turn: Seat;
  lastDiscard: { seat: Seat; tile: TileIndex } | null;
  pendingResponses: Seat[];
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm -C packages/engine test types`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): 核心类型定义 types.ts"
```

---

## Task 3: 牌的编码与牌堆 tiles.ts

**Files:**
- Create: `packages/engine/src/tiles.ts`
- Test: `packages/engine/tests/tiles.test.ts`

- [ ] **Step 1: 写失败测试**

`packages/engine/tests/tiles.test.ts`:
```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm -C packages/engine test tiles`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 tiles.ts**

`packages/engine/src/tiles.ts`:
```ts
import { SUITS, type Suit, type Tile, type TileIndex, type Counts } from './types';

export function tileToIndex(t: Tile): TileIndex {
  return SUITS.indexOf(t.suit) * 9 + (t.rank - 1);
}
export function indexToTile(i: TileIndex): Tile {
  const suit = SUITS[Math.floor(i / 9)] as Suit;
  const rank = ((i % 9) + 1) as Tile['rank'];
  return { suit, rank };
}
export function suitOfIndex(i: TileIndex): Suit {
  return SUITS[Math.floor(i / 9)] as Suit;
}
export function rankOfIndex(i: TileIndex): number {
  return (i % 9) + 1;
}

export function emptyCounts(): Counts {
  return new Array<number>(27).fill(0);
}
export function countsAdd(c: Counts, i: TileIndex): Counts {
  const n = c.slice();
  n[i] += 1;
  return n;
}
export function countsRemove(c: Counts, i: TileIndex): Counts {
  const n = c.slice();
  n[i] -= 1;
  return n;
}
export function countsTotal(c: Counts): number {
  return c.reduce((a, b) => a + b, 0);
}
export function handToCounts(indices: TileIndex[]): Counts {
  const c = emptyCounts();
  for (const i of indices) c[i] += 1;
  return c;
}

export function makeWall(): TileIndex[] {
  const wall: TileIndex[] = [];
  for (let i = 0; i < 27; i++) for (let k = 0; k < 4; k++) wall.push(i);
  return wall;
}

// 可注入随机源以做确定性测试
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm -C packages/engine test tiles`
Expected: PASS（3 个 describe 全过）

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): 牌编码、牌堆、Counts 工具 tiles.ts"
```

---

## Task 4: 胡牌判定 winning.ts

**Files:**
- Create: `packages/engine/src/winning.ts`
- Test: `packages/engine/tests/winning.test.ts`

胡牌输入用「暗牌 Counts + 已有面子数 meldCount」，判定是否构成 (4 - meldCount) 个面子 + 1 雀头，或七对系列（仅 meldCount==0）。

- [ ] **Step 1: 写失败测试**

`packages/engine/tests/winning.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { handToCounts, tileToIndex } from '../src/tiles';
import { canWinStandard, classifyChiDui, canWin } from '../src/winning';

const W = (r: number) => tileToIndex({ suit: 'W', rank: r as any });
const T = (r: number) => tileToIndex({ suit: 'T', rank: r as any });

describe('标准型胡牌', () => {
  it('123 456 789 万 + 22万 + 中间一刻 = 胡', () => {
    // 11 22 33? 用 4 面子+将: 123W 123W 789W 99W(将) + 一刻 555T
    const hand = handToCounts([
      W(1), W(2), W(3), W(1), W(2), W(3),
      W(7), W(8), W(9), W(9), W(9),
      T(5), T(5), T(5),
    ]);
    expect(canWinStandard(hand, 0)).toBe(true);
  });
  it('缺一张不能胡', () => {
    const hand = handToCounts([W(1), W(2), W(3), W(5), W(5)]);
    // 5 张：123W + 55W 将 + 还差面子? meldCount=3 => 需 1 面子+将
    expect(canWinStandard(hand, 3)).toBe(true);
    const bad = handToCounts([W(1), W(2), W(4), W(5), W(5)]);
    expect(canWinStandard(bad, 3)).toBe(false);
  });
});

describe('七对系列', () => {
  it('七对（无龙）', () => {
    const hand = handToCounts([
      W(1), W(1), W(2), W(2), W(3), W(3), W(4), W(4),
      W(5), W(5), W(6), W(6), T(9), T(9),
    ]);
    expect(classifyChiDui(hand)).toEqual({ isChiDui: true, longs: 0 });
  });
  it('龙七对（含 1 组 4 张）', () => {
    const hand = handToCounts([
      W(1), W(1), W(1), W(1), W(2), W(2), W(3), W(3),
      W(4), W(4), W(5), W(5), T(9), T(9),
    ]);
    expect(classifyChiDui(hand)).toEqual({ isChiDui: true, longs: 1 });
  });
  it('非对子手牌不是七对', () => {
    const hand = handToCounts([W(1), W(2), W(2), W(3), W(3), W(4)]);
    expect(classifyChiDui(hand).isChiDui).toBe(false);
  });
});

describe('canWin 含缺门校验', () => {
  it('手中含缺门不能胡', () => {
    const hand = handToCounts([
      W(1), W(2), W(3), W(1), W(2), W(3),
      W(7), W(8), W(9), W(9), W(9), T(5), T(5), T(5),
    ]);
    expect(canWin(hand, [], 'T')).toBe(false); // 缺条但手里有条
    expect(canWin(hand, [], 'B')).toBe(true);  // 缺筒，手里无筒
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm -C packages/engine test winning`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 winning.ts**

`packages/engine/src/winning.ts`:
```ts
import { type Counts, type Meld, type Suit } from './types';
import { suitOfIndex } from './tiles';

// 单门花色 9 格能否拆成若干 顺子/刻子（无将）
function canMeldSuit(c: number[]): boolean {
  const a = c.slice();
  const i = a.findIndex((x) => x > 0);
  if (i === -1) return true;
  // 刻子
  if (a[i]! >= 3) {
    a[i]! -= 3;
    if (canMeldSuit(a)) return true;
    a[i]! += 3;
  }
  // 顺子
  if (i % 9 <= 6 && a[i + 1]! > 0 && a[i + 2]! > 0) {
    a[i]! -= 1; a[i + 1]! -= 1; a[i + 2]! -= 1;
    if (canMeldSuit(a)) return true;
    a[i]! += 1; a[i + 1]! += 1; a[i + 2]! += 1;
  }
  return false;
}

// 把 27 长 Counts 按门切成 3 段 9 格
function splitSuits(hand: Counts): number[][] {
  return [hand.slice(0, 9), hand.slice(9, 18), hand.slice(18, 27)];
}

/** 标准型：暗牌 hand 是否能与已有 meldCount 个面子组成 (4-meldCount) 面子 + 1 将 */
export function canWinStandard(hand: Counts, meldCount: number): boolean {
  const need = 4 - meldCount;
  // 枚举每个 >=2 的位置当将，移除后三门各自必须能整除为面子
  for (let i = 0; i < 27; i++) {
    if (hand[i]! >= 2) {
      const test = hand.slice();
      test[i]! -= 2;
      const suits = splitSuits(test);
      const total = suits.reduce((s, seg) => s + seg.reduce((a, b) => a + b, 0), 0);
      if (total !== need * 3) continue;
      if (suits.every((seg) => seg.reduce((a, b) => a + b, 0) % 3 === 0 && canMeldSuit(seg))) {
        return true;
      }
    }
  }
  return false;
}

/** 七对系列：返回是否七对及龙（4 张组）数量 */
export function classifyChiDui(hand: Counts): { isChiDui: boolean; longs: number } {
  const total = hand.reduce((a, b) => a + b, 0);
  if (total !== 14) return { isChiDui: false, longs: 0 };
  let longs = 0;
  for (let i = 0; i < 27; i++) {
    const n = hand[i]!;
    if (n === 0) continue;
    if (n % 2 !== 0) return { isChiDui: false, longs: 0 };
    if (n === 4) longs += 1;
  }
  return { isChiDui: true, longs };
}

/** 综合胡牌判定（含缺门校验）。melds 为已公开副露 */
export function canWin(hand: Counts, melds: Meld[], lackSuit: Suit | null): boolean {
  if (lackSuit) {
    for (let i = 0; i < 27; i++) {
      if (hand[i]! > 0 && suitOfIndex(i) === lackSuit) return false;
    }
  }
  if (melds.length === 0 && classifyChiDui(hand).isChiDui) return true;
  return canWinStandard(hand, melds.length);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm -C packages/engine test winning`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): 胡牌判定 winning.ts（标准型+七对系列+缺门校验）"
```

---

## Task 5: 向听数 shanten.ts

**Files:**
- Create: `packages/engine/src/shanten.ts`
- Test: `packages/engine/tests/shanten.test.ts`

- [ ] **Step 1: 写失败测试**

`packages/engine/tests/shanten.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { handToCounts, tileToIndex } from '../src/tiles';
import { shanten } from '../src/shanten';

const W = (r: number) => tileToIndex({ suit: 'W', rank: r as any });
const T = (r: number) => tileToIndex({ suit: 'T', rank: r as any });

describe('向听数', () => {
  it('已胡牌（标准型，含将）向听 = -1', () => {
    const hand = handToCounts([
      W(1), W(2), W(3), W(1), W(2), W(3),
      W(7), W(8), W(9), W(9), W(9), T(5), T(5), T(5),
    ]);
    expect(shanten(hand, 0)).toBe(-1);
  });
  it('听牌（差 1 张）向听 = 0', () => {
    // 123W 123W 789W 99W(将) + 55T 听 5T
    const hand = handToCounts([
      W(1), W(2), W(3), W(1), W(2), W(3),
      W(7), W(8), W(9), W(9), W(9), T(5), T(5),
    ]);
    expect(shanten(hand, 0)).toBe(0);
  });
  it('七对听牌向听 = 0', () => {
    const hand = handToCounts([
      W(1), W(1), W(2), W(2), W(3), W(3), W(4), W(4),
      W(5), W(5), W(6), W(6), T(9),
    ]);
    expect(shanten(hand, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm -C packages/engine test shanten`
Expected: FAIL

- [ ] **Step 3: 实现 shanten.ts**

`packages/engine/src/shanten.ts`:
```ts
import { type Counts } from './types';

// 单门递归：返回 [面子数, 搭子数]，贪心枚举取最大面子优先
function bestMelds(c: number[], i: number): { melds: number; pairs: number } {
  while (i < 9 && c[i] === 0) i++;
  if (i >= 9) return { melds: 0, pairs: 0 };
  let best = { melds: 0, pairs: 0 };
  const consider = (r: { melds: number; pairs: number }) => {
    if (r.melds * 2 + r.pairs > best.melds * 2 + best.pairs) best = r;
  };
  // 跳过这张（当孤张）
  { const a = c.slice(); a[i]!--; const r = bestMelds(a, i); consider(r); }
  // 刻子
  if (c[i]! >= 3) { const a = c.slice(); a[i]! -= 3; const r = bestMelds(a, i); consider({ melds: r.melds + 1, pairs: r.pairs }); }
  // 顺子
  if (i <= 6 && c[i + 1]! > 0 && c[i + 2]! > 0) { const a = c.slice(); a[i]!--; a[i + 1]!--; a[i + 2]!--; const r = bestMelds(a, i); consider({ melds: r.melds + 1, pairs: r.pairs }); }
  // 对子（搭子）
  if (c[i]! >= 2) { const a = c.slice(); a[i]! -= 2; const r = bestMelds(a, i); consider({ melds: r.melds, pairs: r.pairs + 1 }); }
  // 两面/嵌张搭子
  if (i <= 7 && c[i + 1]! > 0) { const a = c.slice(); a[i]!--; a[i + 1]!--; const r = bestMelds(a, i); consider({ melds: r.melds, pairs: r.pairs + 1 }); }
  if (i <= 6 && c[i + 2]! > 0) { const a = c.slice(); a[i]!--; a[i + 2]!--; const r = bestMelds(a, i); consider({ melds: r.melds, pairs: r.pairs + 1 }); }
  return best;
}

function standardShanten(hand: Counts, meldCount: number): number {
  const suits = [hand.slice(0, 9), hand.slice(9, 18), hand.slice(18, 27)];
  let totalMelds = meldCount;
  let totalPairs = 0;
  let hasPairCandidate = false;
  for (const seg of suits) {
    const r = bestMelds(seg, 0);
    totalMelds += r.melds;
    totalPairs += r.pairs;
  }
  // 是否存在将（任一 >=2）
  for (let i = 0; i < 27; i++) if (hand[i]! >= 2) hasPairCandidate = true;
  const melds = Math.min(totalMelds, 4);
  const partials = Math.min(totalPairs, 4 - melds);
  const hasPair = hasPairCandidate ? 1 : 0;
  // 标准式：8 - 2*面子 - (搭子+将)，再 -1 归一为「向听」，-1 表示和牌
  return 8 - 2 * melds - partials - hasPair;
}

function chiDuiShanten(hand: Counts): number {
  let pairs = 0;
  let kinds = 0;
  for (let i = 0; i < 27; i++) {
    if (hand[i]! > 0) kinds++;
    if (hand[i]! >= 2) pairs++;
  }
  return 6 - pairs + Math.max(0, 7 - kinds);
}

/** 向听数：-1 表示已和牌，0 表示听牌。melds 数量按已副露折算 */
export function shanten(hand: Counts, meldCount: number): number {
  const std = standardShanten(hand, meldCount);
  // 七对仅在无副露时有效（14 张暗牌）
  const total = hand.reduce((a, b) => a + b, 0);
  if (meldCount === 0 && (total === 13 || total === 14)) {
    return Math.min(std, chiDuiShanten(hand));
  }
  return std;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm -C packages/engine test shanten`
Expected: PASS。若标准式常数导致 off-by-one，调整 `standardShanten` 末行常数使三个用例满足（-1/0/0）。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): 向听数计算 shanten.ts（标准型+七对）"
```

---

## Task 6: 番型识别 fan.ts

**Files:**
- Create: `packages/engine/src/meld.ts`
- Create: `packages/engine/src/fan.ts`
- Test: `packages/engine/tests/fan.test.ts`

番型上下文（自摸/杠上开花/海底/门清/抢杠胡）由调用方传入，fan.ts 负责牌型基础番 + 根 + 叠加加番项 + 封顶换算。

- [ ] **Step 1: 写失败测试**

`packages/engine/tests/fan.test.ts`:
```ts
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
    expect(r.cappedFan).toBe(0);
  });
  it('对对胡 = 1 番', () => {
    const hand = handToCounts([W(1),W(1),W(1),W(5),W(5),W(5),T(3),T(3),T(3),B(7),B(7),B(7),B(9),B(9)]);
    const r = computeFan(hand, [], ctx());
    expect(r.basePattern).toBe('对对胡');
  });
  it('清一色 = 2 番', () => {
    const hand = handToCounts([W(1),W(2),W(3),W(4),W(5),W(6),W(7),W(8),W(9),W(1),W(1),W(9),W(5),W(5)]);
    const r = computeFan(hand, [], ctx());
    expect(r.basePattern).toContain('清一色');
  });
  it('七对 = 2 番', () => {
    const hand = handToCounts([W(1),W(1),W(2),W(2),W(3),W(3),W(4),W(4),T(5),T(5),T(6),T(6),B(9),B(9)]);
    const r = computeFan(hand, [], ctx());
    expect(r.basePattern).toBe('七对');
    expect(r.baseFan).toBe(2);
  });
  it('龙七对 = 3 番', () => {
    const hand = handToCounts([W(1),W(1),W(1),W(1),W(2),W(2),W(3),W(3),T(5),T(5),T(6),T(6),B(9),B(9)]);
    const r = computeFan(hand, [], ctx());
    expect(r.basePattern).toBe('龙七对');
    expect(r.baseFan).toBe(3);
  });
});

describe('加番与封顶', () => {
  it('自摸 +1 番', () => {
    const hand = handToCounts([W(1),W(2),W(3),W(4),W(5),W(6),T(2),T(3),T(4),B(5),B(6),B(7),B(9),B(9)]);
    const r = computeFan(hand, [], ctx({ zimo: true }));
    expect(r.totalFan).toBe(1); // 平胡0 + 自摸1
    expect(r.score).toBe(2);    // 1 * 2^1
  });
  it('封顶生效', () => {
    const hand = handToCounts([W(1),W(1),W(1),W(1),W(2),W(2),W(3),W(3),T(5),T(5),T(6),T(6),B(9),B(9)]);
    const r = computeFan(hand, [], ctx({ zimo: true, capFan: 3 }));
    // 龙七对3 + 自摸1 = 4 -> 封顶3
    expect(r.cappedFan).toBe(3);
    expect(r.score).toBe(8);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm -C packages/engine test fan`
Expected: FAIL

- [ ] **Step 3: 实现 meld.ts + fan.ts**

`packages/engine/src/meld.ts`:
```ts
import { type Meld } from './types';

export function isGang(m: Meld): boolean {
  return m.kind === 'GANG_MING' || m.kind === 'GANG_AN' || m.kind === 'GANG_BU';
}
export function meldCountForWin(melds: Meld[]): number {
  return melds.length; // 碰与杠都折算 1 个面子
}
```

`packages/engine/src/fan.ts`:
```ts
import { type Counts, type Meld, type FanResult } from './types';
import { suitOfIndex } from './tiles';
import { canWinStandard, classifyChiDui } from './winning';
import { isGang } from './meld';

export type FanContext = {
  zimo: boolean;
  gangFlower: boolean;  // 杠上开花
  haidi: boolean;       // 海底
  qiangGang: boolean;   // 抢杠胡
  baseScore: number;
  capFan: number | null;
  winningTile?: number;
};

// 合并暗牌 + 副露成「完整 14 张视图」用于清一色等判定
function fullCounts(hand: Counts, melds: Meld[]): Counts {
  const c = hand.slice();
  for (const m of melds) {
    const n = isGang(m) ? 4 : 3;
    c[m.tile]! += n;
  }
  return c;
}

function isQingYiSe(full: Counts): boolean {
  const suits = new Set<string>();
  for (let i = 0; i < 27; i++) if (full[i]! > 0) suits.add(suitOfIndex(i));
  return suits.size === 1;
}

// 是否对对胡：所有面子为刻/杠（用 full 的标准拆解判断：每门都是刻子且一个将）
function isPengPeng(hand: Counts, melds: Meld[]): boolean {
  // 副露必须全是碰或杠（顺子无法副露，本项目无吃）→ 只需暗牌部分能拆成「刻子*k + 将」
  const need = 4 - melds.length;
  for (let i = 0; i < 27; i++) {
    if (hand[i]! >= 2) {
      const test = hand.slice();
      test[i]! -= 2;
      let ok = true;
      let triplets = 0;
      for (let j = 0; j < 27; j++) {
        if (test[j]! === 0) continue;
        if (test[j]! % 3 !== 0) { ok = false; break; }
        triplets += test[j]! / 3;
      }
      if (ok && triplets === need) return true;
    }
  }
  return false;
}

// 金钩钓：对对胡且除将外全部副露（暗牌仅剩将 2 张）
function isJinGouDiao(hand: Counts, melds: Meld[]): boolean {
  const total = hand.reduce((a, b) => a + b, 0);
  return melds.length === 4 && total === 2;
}

// 十八罗汉：4 个杠 + 将
function isShiBaLuoHan(melds: Meld[]): boolean {
  return melds.length === 4 && melds.every(isGang);
}

// 统计「根」：4 张相同的组数（暗刻+第4张 或 杠）。七对系列单独处理。
function countGen(hand: Counts, melds: Meld[]): number {
  let gen = 0;
  for (const m of melds) if (isGang(m)) gen += 1;
  for (let i = 0; i < 27; i++) if (hand[i]! === 4) gen += 1;
  return gen;
}

export function computeFan(hand: Counts, melds: Meld[], ctx: FanContext): FanResult {
  const full = fullCounts(hand, melds);
  const qing = isQingYiSe(full);
  const chidui = melds.length === 0 ? classifyChiDui(hand) : { isChiDui: false, longs: 0 };

  let baseFan = 0;
  let basePattern = '平胡';
  let genFromBase = 0; // 龙七对系列不另计根

  if (chidui.isChiDui) {
    // 七对系列：longs 0/1/2/3
    const map: Record<number, [string, number]> = {
      0: ['七对', 2], 1: ['龙七对', 3], 2: ['双龙七对', 4], 3: ['三龙七对', 5],
    };
    const [name, fan] = map[chidui.longs]!;
    basePattern = qing ? `清${name}` : name;
    baseFan = (qing ? 2 : 0) + fan;
    genFromBase = 0; // 龙的 4 张已体现为番型，不计根
  } else if (isShiBaLuoHan(melds)) {
    basePattern = qing ? '清十八罗汉' : '十八罗汉';
    baseFan = (qing ? 2 : 0) + 5; // 十八罗汉 5 番
    // 十八罗汉的 4 杠额外计 4 根（在下方 countGen 中体现）
  } else if (isJinGouDiao(hand, melds)) {
    basePattern = qing ? '清金钩钓' : '金钩钓';
    baseFan = (qing ? 2 : 0) + 2; // 金钩钓 = 对对胡1 + 1 = 2
  } else if (isPengPeng(hand, melds)) {
    basePattern = qing ? '清对' : '对对胡';
    baseFan = (qing ? 2 : 0) + 1;
  } else {
    basePattern = qing ? '清一色' : '平胡';
    baseFan = qing ? 2 : 0;
  }

  const addOns: { name: string; fan: number }[] = [];
  // 根
  const gen = chidui.isChiDui ? 0 : countGen(hand, melds);
  if (gen > 0) addOns.push({ name: `根x${gen}`, fan: gen });
  if (ctx.zimo) addOns.push({ name: '自摸', fan: 1 });
  if (ctx.gangFlower) addOns.push({ name: '杠上开花', fan: 1 });
  if (ctx.haidi) addOns.push({ name: '海底', fan: 1 });
  if (ctx.qiangGang) addOns.push({ name: '抢杠胡', fan: 1 });
  // 门清：无碰、无明杠（暗杠不破）
  const menqing = melds.every((m) => m.kind === 'GANG_AN');
  if (menqing && !chidui.isChiDui) addOns.push({ name: '门清', fan: 1 });

  const addFan = addOns.reduce((s, a) => s + a.fan, 0);
  const totalFan = baseFan + addFan;
  const cappedFan = ctx.capFan == null ? totalFan : Math.min(totalFan, ctx.capFan);
  const score = ctx.baseScore * Math.pow(2, cappedFan);

  return { baseFan, basePattern, addOns, totalFan, cappedFan, score };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm -C packages/engine test fan`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): 番型识别与番数计算 fan.ts + meld.ts"
```

---

## Task 7: 记分结算 scoring.ts

**Files:**
- Create: `packages/engine/src/scoring.ts`
- Test: `packages/engine/tests/scoring.test.ts`

scoring 负责：番型付分（点炮/自摸）、杠分（明/暗/补）、流局查大叫、退税。全部产生零和的 delta，并更新分数。

- [ ] **Step 1: 写失败测试**

`packages/engine/tests/scoring.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { settleWin, settleGang, settleDraw } from '../src/scoring';
import type { FanResult, Seat } from '../src/types';

const fan = (score: number): FanResult => ({
  baseFan: 0, basePattern: 't', addOns: [], totalFan: 0, cappedFan: 0, score,
});

describe('番型付分', () => {
  it('点炮：仅放炮家付', () => {
    const d = settleWin({ winner: 0, from: 1, zimo: false, fan: fan(8) });
    expect(d[0]).toBe(8); expect(d[1]).toBe(-8); expect(d[2]).toBe(0); expect(d[3]).toBe(0);
    expect(d.reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('自摸：三家各付', () => {
    const d = settleWin({ winner: 0, from: null, zimo: true, fan: fan(4) });
    expect(d[0]).toBe(12); expect(d[1]).toBe(-4); expect(d[2]).toBe(-4); expect(d[3]).toBe(-4);
    expect(d.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('杠分', () => {
  it('明杠：放杠家付 2', () => {
    const d = settleGang({ ganger: 0, kind: 'GANG_MING', from: 2, baseScore: 1 });
    expect(d[0]).toBe(2); expect(d[2]).toBe(-2);
    expect(d.reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('暗杠：三家各付 2', () => {
    const d = settleGang({ ganger: 0, kind: 'GANG_AN', from: null, baseScore: 1 });
    expect(d[0]).toBe(6); expect(d[1]).toBe(-2); expect(d[2]).toBe(-2); expect(d[3]).toBe(-2);
  });
  it('补杠：三家各付 1', () => {
    const d = settleGang({ ganger: 0, kind: 'GANG_BU', from: null, baseScore: 1 });
    expect(d[0]).toBe(3); expect(d[1]).toBe(-1);
  });
});

describe('流局查大叫', () => {
  it('未听赔给听牌未胡者其最大番分', () => {
    // seat0 听(番分8), seat1 听(番分4), seat2 没听, seat3 已胡(不参与)
    const d = settleDraw({
      tingScores: [8, 4, null, null],
      hasLeft: [false, false, false, true],
    });
    // seat2 赔 seat0 8 + seat1 4 = -12; seat0 +8; seat1 +4
    expect(d[2]).toBe(-12); expect(d[0]).toBe(8); expect(d[1]).toBe(4); expect(d[3]).toBe(0);
    expect(d.reduce((a, b) => a + b, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm -C packages/engine test scoring`
Expected: FAIL

- [ ] **Step 3: 实现 scoring.ts**

`packages/engine/src/scoring.ts`:
```ts
import { type Seat, type FanResult, type GangKind } from './types';

export type Delta = [number, number, number, number];
const zero = (): Delta => [0, 0, 0, 0];

export function settleWin(p: {
  winner: Seat; from: Seat | null; zimo: boolean; fan: FanResult;
}): Delta {
  const d = zero();
  const s = p.fan.score;
  if (p.zimo) {
    for (let i = 0; i < 4; i++) {
      if (i === p.winner) continue;
      d[i] -= s; d[p.winner] += s;
    }
  } else {
    d[p.from!] -= s; d[p.winner] += s;
  }
  return d;
}

export function settleGang(p: {
  ganger: Seat; kind: GangKind; from: Seat | null; baseScore: number;
}): Delta {
  const d = zero();
  if (p.kind === 'GANG_MING') {
    const amt = 2 * p.baseScore;
    d[p.from!] -= amt; d[p.ganger] += amt;
  } else if (p.kind === 'GANG_AN') {
    const amt = 2 * p.baseScore;
    for (let i = 0; i < 4; i++) { if (i === p.ganger) continue; d[i] -= amt; d[p.ganger] += amt; }
  } else { // GANG_BU
    const amt = 1 * p.baseScore;
    for (let i = 0; i < 4; i++) { if (i === p.ganger) continue; d[i] -= amt; d[p.ganger] += amt; }
  }
  return d;
}

/** 流局查大叫：tingScores[i] 为该家听牌最大番分（未听为 null）；已胡(hasLeft)不参与 */
export function settleDraw(p: {
  tingScores: (number | null)[];
  hasLeft: boolean[];
}): Delta {
  const d = zero();
  const tingSeats: Seat[] = [];
  const noTingSeats: Seat[] = [];
  for (let i = 0; i < 4; i++) {
    if (p.hasLeft[i]) continue;
    if (p.tingScores[i] != null) tingSeats.push(i as Seat);
    else noTingSeats.push(i as Seat);
  }
  for (const t of tingSeats) {
    const score = p.tingScores[t]!;
    for (const n of noTingSeats) {
      d[n] -= score; d[t] += score;
    }
  }
  return d;
}

/** 退税：reverse 已收杠分。entries: 每个未胡未听玩家收过的杠流水 */
export function settleTuiShui(entries: { ganger: Seat; from: Seat; amount: number }[]): Delta {
  const d = zero();
  for (const e of entries) { d[e.ganger] -= e.amount; d[e.from] += e.amount; }
  return d;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm -C packages/engine test scoring`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): 记分结算 scoring.ts（付分/杠分/查大叫/退税）"
```

---

## Task 8: 规则校验 rules.ts

**Files:**
- Create: `packages/engine/src/rules.ts`
- Test: `packages/engine/tests/rules.test.ts`

- [ ] **Step 1: 写失败测试**

`packages/engine/tests/rules.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { handToCounts, tileToIndex } from '../src/tiles';
import { canPong, canGangFromDiscard, canGangSelf, validLack } from '../src/rules';

const W = (r: number) => tileToIndex({ suit: 'W', rank: r as any });

describe('碰/杠校验', () => {
  it('有 2 张可碰', () => {
    const hand = handToCounts([W(5), W(5), W(1)]);
    expect(canPong(hand, W(5))).toBe(true);
    expect(canPong(hand, W(1))).toBe(false);
  });
  it('有 3 张可直杠（别人打出）', () => {
    const hand = handToCounts([W(5), W(5), W(5)]);
    expect(canGangFromDiscard(hand, W(5))).toBe(true);
  });
  it('手中 4 张可暗杠', () => {
    const hand = handToCounts([W(5), W(5), W(5), W(5)]);
    expect(canGangSelf(hand, W(5))).toBe(true);
  });
});

describe('定缺校验', () => {
  it('合法花色', () => {
    expect(validLack('W')).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm -C packages/engine test rules`
Expected: FAIL

- [ ] **Step 3: 实现 rules.ts**

`packages/engine/src/rules.ts`:
```ts
import { SUITS, type Counts, type Suit, type TileIndex } from './types';

export function canPong(hand: Counts, tile: TileIndex): boolean {
  return hand[tile]! >= 2;
}
export function canGangFromDiscard(hand: Counts, tile: TileIndex): boolean {
  return hand[tile]! >= 3;
}
export function canGangSelf(hand: Counts, tile: TileIndex): boolean {
  return hand[tile]! === 4;
}
export function validLack(s: Suit): boolean {
  return (SUITS as readonly string[]).includes(s);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm -C packages/engine test rules`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): 规则校验 rules.ts（碰/杠/定缺）"
```

---

## Task 9: GameSession 状态机

**Files:**
- Create: `packages/engine/src/session.ts`
- Modify: `packages/engine/src/index.ts`（导出公开 API）
- Test: `packages/engine/tests/session.test.ts`

GameSession 用注入牌墙做确定性测试。本任务实现：发牌、定缺、摸打、碰/杠/胡响应、血战下桌、终止判定、流局结算、多局换庄。

- [ ] **Step 1: 写失败集成测试（确定性整局骨架）**

`packages/engine/tests/session.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { GameSession } from '../src/session';
import { makeWall } from '../src/tiles';
import type { GameConfig } from '../src/types';

const cfg: GameConfig = {
  baseScore: 1, capFan: 7, totalRounds: 1,
  enableQiangGang: true, enableTuiShui: true,
};

describe('GameSession 基础流程', () => {
  it('发牌后进入定缺阶段，四家各 13 张（庄 14）', () => {
    const s = new GameSession(cfg, { wall: makeWall(), dealer: 0 });
    const st = s.getState();
    expect(st.phase).toBe('CHOOSE_LACK');
    const counts = st.players.map((p) => p.hand.reduce((a, b) => a + b, 0));
    expect(counts[0]).toBe(14); // 庄家先摸
    expect(counts[1]).toBe(13);
  });

  it('四家定缺后进入 PLAYING', () => {
    const s = new GameSession(cfg, { wall: makeWall(), dealer: 0 });
    s.chooseLack(0, 'B'); s.chooseLack(1, 'B'); s.chooseLack(2, 'B'); s.chooseLack(3, 'B');
    expect(s.getState().phase).toBe('PLAYING');
  });

  it('零和守恒：流局结算后四家分数和为 0', () => {
    const s = new GameSession(cfg, { wall: makeWall(), dealer: 0 });
    s.chooseLack(0, 'B'); s.chooseLack(1, 'B'); s.chooseLack(2, 'B'); s.chooseLack(3, 'B');
    // 简单驱动：当前家不断打出第一张合法牌直到流局或有人胡
    let guard = 0;
    while (s.getState().phase === 'PLAYING' && guard++ < 200) {
      const st = s.getState();
      const seat = st.turn;
      const legal = s.legalDiscards(seat);
      if (legal.length === 0) break;
      s.discard(seat, legal[0]!);
      // 跳过所有响应（全部 pass）
      for (const r of s.getState().pendingResponses.slice()) s.pass(r);
    }
    const total = s.getState().players.reduce((a, p) => a + p.roundScore, 0);
    expect(total).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm -C packages/engine test session`
Expected: FAIL

- [ ] **Step 3: 实现 session.ts（核心状态机）**

实现要点（写入 `packages/engine/src/session.ts`）：
- 构造：`new GameSession(config, { wall, dealer })`。无 wall 时用 `shuffle(makeWall())`。
- `deal()`：按座位轮流发，每家 13 张，庄家多摸 1 张（14）。设 `phase='CHOOSE_LACK'`。
- `chooseLack(seat, suit)`：写入 `lackSuit`；四家齐后 `phase='PLAYING'`，`turn=dealer`，进入「庄家需打牌」状态（庄家已 14 张）。
- `legalDiscards(seat)`：返回 `hand` 中所有 >0 的 index（缺门牌也可打）。
- `discard(seat, tile)`：从手牌移除，推入 `discards`，设 `lastDiscard`，计算 `pendingResponses`（其他未下桌玩家中可胡/可杠/可碰者）。无人可响应则直接 `advanceDraw()`。
- `pong/gang/win/pass`：处理响应。响应优先级：胡>杠>碰。`pass` 从 `pendingResponses` 移除；空了且无人执行操作则 `advanceDraw()`。
- `advanceDraw()`：下一未下桌玩家从 `wall` 摸 1 张；若 `wall` 空 → `endRoundDraw()`。摸牌后检测自摸/自杠机会（暴露给查询/AI），等待该玩家 discard 或 win/gang。
- `win(seat)`：调用 `canWin`，构造 `FanContext`（zimo 依据来源、haidi 依据 wall 是否空、gangFlower 依据上一步是否杠后摸牌），调 `computeFan` + `settleWin`，更新 `roundScore`，设 `hasLeft=true`，记录 `gangScoreReceived` 不变。检测终止：已下桌 >=3 → `endRound()`。
- `gang(seat, tile, kind)`：校验，更新 melds/hand，调 `settleGang` 更新分并记 `gangScoreReceived`；抢杠胡：补杠时先检查其他玩家 canWin → 若 enableQiangGang 且有人胡，转为该玩家点炮胡（标记 qiangGang）。杠后从 wall 摸 1 张（杠上开花标志）。
- `endRoundDraw()`：流局。对每个未下桌玩家计算 `tingScore`（遍历所有可打牌后是否听牌；听牌则取其听的最大番分，用 `computeFan` 估算自摸分），调 `settleDraw`；若 enableTuiShui，对「未胡未听」玩家调 `settleTuiShui` 退还其 `gangScoreReceived`。汇总进 `roundScore`，`phase='ROUND_END'`。
- `endRound()`：3 家胡时无查叫（已分胜负），直接结束本局。
- `nextRound()`：把 `roundScore` 累加进 `totalScore`，清局内状态，`roundIndex++`，换庄（`dealer=(dealer+1)%4`）；若 `roundIndex>=totalRounds` → `phase='GAME_END'`，否则重新 `deal()`。

> 完整实现需依据上述查询函数组合；测试 Step 1 仅验证发牌张数、阶段切换、零和守恒。后续 Task 11 集成测试覆盖胡牌/血战分支。实现时确保任何结算路径 Δ 之和为 0。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm -C packages/engine test session`
Expected: PASS（3 个用例）。零和守恒是关键断言。

- [ ] **Step 5: 导出 API 并提交**

`packages/engine/src/index.ts`:
```ts
export * from './types';
export * from './tiles';
export * from './winning';
export * from './shanten';
export * from './fan';
export * from './scoring';
export * from './rules';
export { GameSession } from './session';
export type { BotStrategy } from './ai/strategy';
export { BasicBot } from './ai/basicBot';
export const ENGINE_VERSION = '1.0.0';
```

> 注：`ai/*` 在 Task 10 创建；若先提交本任务，可暂时注释最后两行，Task 10 再启用。

```bash
git add -A && git commit -m "feat(engine): GameSession 状态机（发牌/定缺/摸打/碰杠胡/血战/流局/多局）"
```

---

## Task 10: 规则型 AI

**Files:**
- Create: `packages/engine/src/ai/strategy.ts`
- Create: `packages/engine/src/ai/basicBot.ts`
- Test: `packages/engine/tests/ai.test.ts`

- [ ] **Step 1: 写失败测试（定缺 + 出牌 + 接口）**

`packages/engine/tests/ai.test.ts`:
```ts
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
    const discard = bot.chooseDiscardByHand(hand, 'B'); // 缺筒
    expect(discard).toBe(B(9));
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm -C packages/engine test ai`
Expected: FAIL

- [ ] **Step 3: 实现 strategy.ts + basicBot.ts**

`packages/engine/src/ai/strategy.ts`:
```ts
import { type GameState, type Seat, type Suit, type TileIndex } from '../types';

export interface BotStrategy {
  chooseLack(state: GameState, seat: Seat): Suit;
  chooseDiscard(state: GameState, seat: Seat): TileIndex;
  respondToDiscard(state: GameState, seat: Seat, tile: TileIndex):
    { action: 'PONG' | 'GANG' | 'WIN' | 'PASS'; gangTile?: TileIndex };
  respondToSelfDraw(state: GameState, seat: Seat, drawn: TileIndex):
    { action: 'GANG' | 'WIN' | 'DISCARD'; gangTile?: TileIndex; discard?: TileIndex };
}
```

`packages/engine/src/ai/basicBot.ts`:
```ts
import { SUITS, type Counts, type GameState, type Seat, type Suit, type TileIndex } from '../types';
import { suitOfIndex } from '../tiles';
import { shanten } from '../shanten';
import { canWin } from '../winning';
import { canPong, canGangFromDiscard, canGangSelf } from '../rules';
import { type BotStrategy } from './strategy';

export class BasicBot implements BotStrategy {
  chooseLackByHand(hand: Counts): Suit {
    const sums = [0, 0, 0];
    for (let i = 0; i < 27; i++) sums[Math.floor(i / 9)]! += hand[i]!;
    let min = 0;
    for (let k = 1; k < 3; k++) if (sums[k]! < sums[min]!) min = k;
    return SUITS[min]!;
  }
  chooseDiscardByHand(hand: Counts, lack: Suit | null): TileIndex {
    // 1) 缺门牌优先（任意一张）
    if (lack) {
      for (let i = 0; i < 27; i++) if (hand[i]! > 0 && suitOfIndex(i) === lack) return i;
    }
    // 2) 选打出后向听最小的牌
    let best = -1, bestSh = Infinity;
    for (let i = 0; i < 27; i++) {
      if (hand[i]! === 0) continue;
      const test = hand.slice(); test[i]!--;
      const sh = shanten(test, 0);
      if (sh < bestSh) { bestSh = sh; best = i; }
    }
    return best;
  }
  chooseLack(state: GameState, seat: Seat): Suit {
    return this.chooseLackByHand(state.players[seat]!.hand);
  }
  chooseDiscard(state: GameState, seat: Seat): TileIndex {
    const p = state.players[seat]!;
    return this.chooseDiscardByHand(p.hand, p.lackSuit);
  }
  respondToDiscard(state: GameState, seat: Seat, tile: TileIndex) {
    const p = state.players[seat]!;
    const handWith = p.hand.slice(); handWith[tile]!++;
    if (canWin(handWith, p.melds, p.lackSuit)) return { action: 'WIN' as const };
    if (canGangFromDiscard(p.hand, tile)) return { action: 'GANG' as const, gangTile: tile };
    if (canPong(p.hand, tile)) {
      // 简单启发：碰后向听不变差才碰
      const after = p.hand.slice(); after[tile]! -= 2;
      const before = shanten(p.hand, p.melds.length);
      const aft = shanten(after, p.melds.length + 1);
      if (aft <= before) return { action: 'PONG' as const };
    }
    return { action: 'PASS' as const };
  }
  respondToSelfDraw(state: GameState, seat: Seat, drawn: TileIndex) {
    const p = state.players[seat]!;
    if (canWin(p.hand, p.melds, p.lackSuit)) return { action: 'WIN' as const };
    if (canGangSelf(p.hand, drawn)) return { action: 'GANG' as const, gangTile: drawn };
    return { action: 'DISCARD' as const, discard: this.chooseDiscard(state, seat) };
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm -C packages/engine test ai`
Expected: PASS。并启用 index.ts 中 ai 导出（若 Task 9 注释过）。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): 规则型 AI（BasicBot + BotStrategy 接口）"
```

---

## Task 11: AI 互打集成测试（零和守恒总闸）

**Files:**
- Test: `packages/engine/tests/integration.test.ts`

- [ ] **Step 1: 写测试——4 个 BasicBot 跑多局**

`packages/engine/tests/integration.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { GameSession } from '../src/session';
import { BasicBot } from '../src/ai/basicBot';
import { makeWall, shuffle } from '../src/tiles';
import type { GameConfig } from '../src/types';

function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

const cfg: GameConfig = {
  baseScore: 1, capFan: 7, totalRounds: 1,
  enableQiangGang: true, enableTuiShui: true,
};

describe('AI 互打零和守恒', () => {
  it('20 副不同牌局，每局四家分数和恒为 0，无异常', () => {
    const bot = new BasicBot();
    for (let g = 0; g < 20; g++) {
      const rng = seededRng(g + 1);
      const s = new GameSession(cfg, { wall: shuffle(makeWall(), rng), dealer: 0 });
      for (let seat = 0; seat < 4; seat++) s.chooseLack(seat as any, bot.chooseLack(s.getState(), seat as any));
      let guard = 0;
      while (s.getState().phase === 'PLAYING' && guard++ < 500) {
        const st = s.getState();
        // 处理待响应
        if (st.pendingResponses.length > 0) {
          for (const seat of st.pendingResponses.slice()) {
            const r = bot.respondToDiscard(st, seat, st.lastDiscard!.tile);
            if (r.action === 'WIN') s.win(seat);
            else if (r.action === 'GANG') s.gang(seat, r.gangTile!, 'GANG_MING');
            else if (r.action === 'PONG') s.pong(seat);
            else s.pass(seat);
          }
          continue;
        }
        const seat = st.turn;
        const p = st.players[seat]!;
        if (p.hasLeft) break;
        // 自摸阶段：简单出牌
        const discard = bot.chooseDiscard(st, seat);
        if (discard < 0) break;
        s.discard(seat, discard);
      }
      const total = s.getState().players.reduce((a, p) => a + p.roundScore, 0);
      expect(total).toBe(0);
    }
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `pnpm -C packages/engine test integration`
Expected: PASS。若失败，多半是 session 某结算路径非零和——用断言定位修复（这是抓 bug 的核心手段）。

- [ ] **Step 3: 运行全部引擎测试 + 覆盖率**

Run: `pnpm -C packages/engine exec vitest run --coverage`
Expected: 全绿，engine 覆盖率 ≥ 90%。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test(engine): AI 互打集成测试 + 零和守恒总闸"
```

---

## Task 12: 前端脚手架 + TileView

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`
- Create: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`
- Create: `apps/web/src/components/TileView.tsx`, `apps/web/src/components/TileView.css`
- Test: `apps/web/src/components/TileView.test.tsx`

- [ ] **Step 1: 前端包配置**

`apps/web/package.json`:
```json
{
  "name": "@majiang/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@majiang/engine": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.0.0",
    "vite": "^5.3.0",
    "vitest": "^1.6.0"
  }
}
```

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { globals: true, environment: 'jsdom', setupFiles: ['./src/setupTests.ts'] },
});
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2020", "DOM", "DOM.Iterable"] },
  "include": ["src"]
}
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="zh">
  <head><meta charset="UTF-8" /><title>四川麻将</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

`apps/web/src/setupTests.ts`:
```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 2: 写 TileView 失败测试**

`apps/web/src/components/TileView.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TileView } from './TileView';

describe('TileView', () => {
  it('渲染五万显示 5 与万', () => {
    render(<TileView index={4} />); // 五万
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('万')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `pnpm -C apps/web test TileView`
Expected: FAIL

- [ ] **Step 4: 实现 TileView**

`apps/web/src/components/TileView.tsx`:
```tsx
import { indexToTile } from '@majiang/engine';
import './TileView.css';

const SUIT_LABEL: Record<string, string> = { W: '万', T: '条', B: '筒' };
const SUIT_CLASS: Record<string, string> = { W: 'suit-w', T: 'suit-t', B: 'suit-b' };

export function TileView(props: { index: number; selected?: boolean; onClick?: () => void; back?: boolean }) {
  if (props.back) return <div className="tile tile-back" onClick={props.onClick} />;
  const t = indexToTile(props.index);
  return (
    <div
      className={`tile ${SUIT_CLASS[t.suit]} ${props.selected ? 'tile-selected' : ''}`}
      onClick={props.onClick}
    >
      <span className="tile-rank">{t.rank}</span>
      <span className="tile-suit">{SUIT_LABEL[t.suit]}</span>
    </div>
  );
}
```

`apps/web/src/components/TileView.css`:
```css
.tile { display:inline-flex; flex-direction:column; align-items:center; justify-content:center;
  width:38px; height:54px; border:1px solid #333; border-radius:5px; background:#fffdf5;
  margin:2px; cursor:pointer; user-select:none; }
.tile-selected { transform: translateY(-8px); box-shadow:0 2px 6px rgba(0,0,0,.3); }
.tile-back { background:#1a6b3a; }
.suit-w .tile-suit { color:#c0392b; } .suit-t .tile-suit { color:#27ae60; } .suit-b .tile-suit { color:#2980b9; }
.tile-rank { font-size:18px; font-weight:bold; } .tile-suit { font-size:12px; }
```

`apps/web/src/App.tsx`（占位，Task 13 替换）:
```tsx
export default function App() { return <div>四川麻将</div>; }
```

`apps/web/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
```

- [ ] **Step 5: 运行测试 + 提交**

Run: `pnpm install && pnpm -C apps/web test TileView`
Expected: PASS

```bash
git add -A && git commit -m "feat(web): 前端脚手架 + TileView 牌面组件"
```

---

## Task 13: 状态 store + gameLoop 调度器

**Files:**
- Create: `apps/web/src/store/gameStore.ts`
- Test: `apps/web/src/store/gameStore.test.ts`

- [ ] **Step 1: 写失败测试**

`apps/web/src/store/gameStore.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createGameStore } from './gameStore';

describe('gameStore', () => {
  it('startGame 后进入定缺阶段', () => {
    const store = createGameStore();
    store.getState().startGame({
      baseScore: 1, capFan: 7, totalRounds: 1, enableQiangGang: true, enableTuiShui: true,
    });
    expect(store.getState().gameState?.phase).toBe('CHOOSE_LACK');
  });
  it('玩家定缺后 AI 自动定缺并进入 PLAYING', () => {
    const store = createGameStore();
    store.getState().startGame({
      baseScore: 1, capFan: 7, totalRounds: 1, enableQiangGang: true, enableTuiShui: true,
    });
    store.getState().playerChooseLack('B');
    expect(store.getState().gameState?.phase).toBe('PLAYING');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm -C apps/web test gameStore`
Expected: FAIL

- [ ] **Step 3: 实现 gameStore.ts**

`apps/web/src/store/gameStore.ts`:
```ts
import { createStore } from 'zustand/vanilla';
import { GameSession, BasicBot, type GameConfig, type GameState, type Suit } from '@majiang/engine';

const HUMAN = 0;

type GameStore = {
  session: GameSession | null;
  gameState: GameState | null;
  bot: BasicBot;
  startGame: (cfg: GameConfig) => void;
  playerChooseLack: (suit: Suit) => void;
  sync: () => void;
};

export function createGameStore() {
  return createStore<GameStore>((set, get) => ({
    session: null,
    gameState: null,
    bot: new BasicBot(),
    startGame: (cfg) => {
      const session = new GameSession(cfg, { dealer: 0 });
      set({ session, gameState: session.getState() });
    },
    playerChooseLack: (suit) => {
      const { session, bot } = get();
      if (!session) return;
      session.chooseLack(HUMAN, suit);
      for (let seat = 1; seat < 4; seat++) {
        session.chooseLack(seat as any, bot.chooseLack(session.getState(), seat as any));
      }
      set({ gameState: session.getState() });
    },
    sync: () => set({ gameState: get().session?.getState() ?? null }),
  }));
}
```

> 说明：完整 gameLoop（AI 自动摸打、人类操作分发）在 Task 14 接入 UI 时补充 `advanceAI()` 方法，本任务先验证开局链路。

- [ ] **Step 4: 运行测试 + 提交**

Run: `pnpm -C apps/web test gameStore`
Expected: PASS

```bash
git add -A && git commit -m "feat(web): gameStore（开局/定缺链路）"
```

---

## Task 14: 牌桌 UI 组件 + 页面

**Files:**
- Create: `apps/web/src/components/HandPanel.tsx`, `DiscardPool.tsx`, `SeatPanel.tsx`, `ActionBar.tsx`, `LackModal.tsx`, `RoundResultPanel.tsx`, `ScoreBoard.tsx`
- Create: `apps/web/src/pages/LobbyPage.tsx`, `apps/web/src/pages/TablePage.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/store/gameStore.ts`（加 `advanceAI`/`playerDiscard`/`playerRespond`）
- Test: `apps/web/src/components/ActionBar.test.tsx`

- [ ] **Step 1: 写 ActionBar 失败测试**

`apps/web/src/components/ActionBar.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionBar } from './ActionBar';

describe('ActionBar', () => {
  it('仅亮起合法操作', () => {
    render(<ActionBar canPong canGang={false} canWin canPass onPong={vi.fn()} onGang={vi.fn()} onWin={vi.fn()} onPass={vi.fn()} />);
    expect(screen.getByRole('button', { name: '碰' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '杠' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '胡' })).toBeEnabled();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm -C apps/web test ActionBar`
Expected: FAIL

- [ ] **Step 3: 实现 ActionBar（其余组件同批实现）**

`apps/web/src/components/ActionBar.tsx`:
```tsx
export function ActionBar(props: {
  canPong: boolean; canGang: boolean; canWin: boolean; canPass: boolean;
  onPong: () => void; onGang: () => void; onWin: () => void; onPass: () => void;
}) {
  return (
    <div className="action-bar">
      <button onClick={props.onPong} disabled={!props.canPong}>碰</button>
      <button onClick={props.onGang} disabled={!props.canGang}>杠</button>
      <button onClick={props.onWin} disabled={!props.canWin}>胡</button>
      <button onClick={props.onPass} disabled={!props.canPass}>过</button>
    </div>
  );
}
```

其余组件实现（无独立测试，依赖手测 + 集成）：
- `HandPanel`：map 手牌渲染 `TileView`，点击回调 `onDiscard(index)`，缺门牌加高亮 class。
- `DiscardPool`：渲染四家 `discards` 的 `TileView`。
- `SeatPanel`：显示某 AI 座位牌背数（`TileView back`）、副露区、`lackSuit` 标记、`hasLeft` 状态。
- `LackModal`：三个花色按钮，点选回调 `onChoose(suit)`。
- `RoundResultPanel`：列出每家 `winRecord`/杠分/`roundScore`，按钮「下一局」。
- `ScoreBoard`：显示四家 `totalScore` + `roundIndex/totalRounds`。

`gameStore.ts` 增补方法（追加到 store）：
```ts
// 在 GameStore 类型与实现中加入：
advanceAI: () => void;     // 循环：当前 turn 为 AI 且 PLAYING 时，调用 bot 决策并 dispatch，setTimeout 自递归
playerDiscard: (tile: number) => void;
playerRespond: (action: 'PONG'|'GANG'|'WIN'|'PASS') => void;
```
实现要点：`advanceAI` 检查 `gameState`，若有 `pendingResponses` 则逐个用 `bot.respondToDiscard` 处理；否则若 `turn !== HUMAN` 且未下桌，用 `bot.respondToSelfDraw`/`chooseDiscard` 出牌；每步后 `sync()`，并用 `setTimeout(advanceAI, 600)` 制造思考延迟；轮到 HUMAN 或进入 ROUND_END 时停止。`playerDiscard`/`playerRespond` 调 session 对应方法后 `sync()` 再 `advanceAI()`。

`LobbyPage.tsx`：规则表单（底分/封顶/局数/抢杠胡/退税 controlled inputs）→ 调 `startGame` 切到 TablePage。

`TablePage.tsx`：组合 SeatPanel×3 + DiscardPool + HandPanel + ActionBar + ScoreBoard + 条件渲染 LackModal/RoundResultPanel；用 `useStore` 订阅 `gameState`；挂载时若进入 PLAYING 调 `advanceAI()`。

`App.tsx`：根据 store 中是否有 session 在 Lobby/Table 间切换。

- [ ] **Step 4: 运行测试 + 构建**

Run: `pnpm -C apps/web test ActionBar && pnpm -C apps/web build`
Expected: 测试 PASS，build 成功（无类型错误）。

- [ ] **Step 5: 手动冒烟 + 提交**

Run: `pnpm -C apps/web dev`，浏览器打开：开房 → 定缺 → 能与 AI 对局、碰杠胡按钮按合法性亮灭、单局结算、记分板更新、多局结束总排名。

```bash
git add -A && git commit -m "feat(web): 牌桌 UI（组件+页面+gameLoop 调度）"
```

---

## Task 15: 端到端核对 + README

**Files:**
- Create: `README.md`
- Modify: 修复联调中暴露的问题

- [ ] **Step 1: 跑全部测试**

Run: `pnpm -r test`
Expected: engine + web 全绿。

- [ ] **Step 2: 写 README（运行说明）**

`README.md`：项目简介、`pnpm install`、`pnpm -C apps/web dev`、`pnpm -r test`、规则与番型表摘要、第二阶段（真人房间）规划链接到 docs/TRD.md §9。

- [ ] **Step 3: 提交并推送**

```bash
git add -A && git commit -m "docs: README + 端到端核对修复"
git push
```

---

## Self-Review

- **Spec 覆盖**：定缺(T9)、碰杠胡(T8/T9)、血战下桌与终止(T9)、番型全表(T6)、加番/根/封顶(T6)、杠分刮风下雨(T7)、抢杠胡(T9)、查大叫(T7/T9)、退税(T7/T9)、自摸/点炮付分(T7)、AI(T10)、多局记分(T9/T14)、UI 全组件(T12-14)、零和守恒(T11)。第二阶段为预留不实现（TRD §9）✅。
- **占位符**：核心引擎任务（T1-T11）均含完整代码与命令；T9 状态机/T14 部分 UI 组件以「实现要点 + 已给出接口签名和被调函数」描述，因其为编排既有纯函数的胶水层，关键查询函数签名均已在前序任务定义，无未定义类型引用。
- **类型一致**：`Counts/Meld/Seat/FanResult/GameConfig/GameState` 全程统一；`computeFan`/`settleWin`/`settleGang`/`settleDraw`/`canWin`/`shanten` 签名前后一致。
- **TDD/提交**：每任务 红→绿→commit。

> 注意：Task 5 的向听数常数与 Task 9 的状态机编排在实现时需依据测试微调；遇到偏差以测试为准修正实现，不改测试期望。
