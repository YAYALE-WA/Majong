# 四川麻将在线对战网站 · 技术设计文档（TRD）

- 版本：v1.0
- 日期：2026-06-16
- 对应 PRD：v1.0

---

## 1. 技术栈与总体架构

### 1.1 技术选型
- **语言**：TypeScript 全栈。
- **前端**：React 18 + Vite + TypeScript；状态管理用 Zustand。
- **核心引擎**：纯 TypeScript 模块，**零 UI / 网络依赖**，前后端共用。
- **测试**：Vitest（引擎 + 集成）、React Testing Library（组件）。
- **包管理**：pnpm workspace（monorepo）。
- **后端（第二阶段，仅预留）**：Node + WebSocket，复用同一份 engine。

### 1.2 选型理由
游戏引擎是规则最密集、最易出 bug 的部分，且**两阶段都需要且必须完全一致**：第一阶段在浏览器判定，第二阶段在服务端做权威裁决。TypeScript 全栈让引擎**只写一次、两端共用**，避免逻辑双份维护导致的不一致。

### 1.3 Monorepo 结构
```
majiang/
├── package.json                 (pnpm workspace 根)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── docs/                        PRD.md / TRD.md
├── packages/
│   └── engine/                  核心引擎包 @majiang/engine
│       ├── src/
│       │   ├── types.ts             共享类型
│       │   ├── tiles.ts             牌/牌堆/发牌/counts 编码
│       │   ├── meld.ts              面子（碰/杠）表示与操作
│       │   ├── rules.ts             定缺/碰/杠/胡合法性校验
│       │   ├── winning.ts           胡牌判定（标准型 + 七对系列）
│       │   ├── shanten.ts           向听数计算
│       │   ├── fan.ts               番型识别 + 番数计算
│       │   ├── scoring.ts           记分（付分/杠分/查大叫/退税/封顶）
│       │   ├── session.ts           GameSession 状态机
│       │   ├── ai/
│       │   │   ├── strategy.ts          BotStrategy 接口
│       │   │   └── basicBot.ts          规则型基础 AI
│       │   └── index.ts             公开 API
│       └── tests/                   Vitest 测试
└── apps/
    └── web/                     前端应用
        ├── src/
        │   ├── components/          UI 组件
        │   ├── store/               Zustand store + gameLoop 调度器
        │   ├── pages/               Lobby / Table
        │   ├── App.tsx
        │   └── main.tsx
        ├── index.html
        └── vite.config.ts
```

---

## 2. 核心数据结构

### 2.1 牌的编码
```ts
type Suit = 'W' | 'T' | 'B';            // 万 / 条 / 筒
type Rank = 1|2|3|4|5|6|7|8|9;
type Tile = { suit: Suit; rank: Rank };

// 紧凑编码：index = suitIndex*9 + (rank-1)，范围 0..26
// W:0..8, T:9..17, B:18..26
type TileIndex = number;                // 0..26

// 手牌用计数数组表示（每个 index 的张数 0..4）
type Counts = number[];                  // length 27
```

### 2.2 面子（副露）
```ts
type Meld =
  | { kind: 'PONG'; tile: TileIndex }                       // 碰
  | { kind: 'GANG_MING'; tile: TileIndex; from: Seat }      // 明杠(直杠)
  | { kind: 'GANG_AN'; tile: TileIndex }                    // 暗杠
  | { kind: 'GANG_BU'; tile: TileIndex };                   // 补杠(巴杠)
```

### 2.3 玩家状态
```ts
type Seat = 0 | 1 | 2 | 3;

type PlayerState = {
  seat: Seat;
  hand: Counts;                  // 暗牌计数数组
  melds: Meld[];                 // 已公开副露
  discards: TileIndex[];         // 本局弃牌（牌河）
  lackSuit: Suit | null;         // 定缺花色
  hasLeft: boolean;              // 已胡下桌（血战：单局只胡一次）
  winRecord: WinRecord | null;   // 本局胡牌记录（单条）
  gangScoreReceived: GangScore[];// 本局已收杠分（退税用，记录付方与金额）
  roundScore: number;            // 本局净得分
  totalScore: number;            // 累计总分（跨局）
};

type GangScore = { from: Seat; amount: number; gangType: Meld['kind'] };
```

### 2.4 胡牌记录与番型
```ts
type WinType = 'ZIMO' | 'DIANPAO';       // 自摸 / 点炮

type FanResult = {
  baseFan: number;               // 牌型基础番
  basePattern: string;           // 牌型名（如 '龙七对'）
  addOns: { name: string; fan: number }[]; // 加番项（根/自摸/杠上开花/海底/门清/抢杠胡）
  totalFan: number;              // 封顶前总番
  cappedFan: number;             // 封顶后番
  score: number;                 // 底分 × 2^cappedFan
};

type WinRecord = {
  seat: Seat;
  winType: WinType;
  from: Seat | null;             // 点炮来源（自摸为 null）
  fan: FanResult;
  payments: { from: Seat; to: Seat; amount: number }[]; // 番型分付分流水
};
```

### 2.5 游戏配置与全局状态
```ts
type GameConfig = {
  baseScore: number;             // 底分
  capFan: number | null;         // 封顶番数，null=不封顶
  totalRounds: number;           // 总局数
  enableQiangGang: boolean;      // 抢杠胡
  enableTuiShui: boolean;        // 退税
};

type Phase =
  | 'DEAL'         // 发牌
  | 'CHOOSE_LACK'  // 定缺
  | 'PLAYING'      // 对局进行
  | 'ROUND_END'    // 单局结算
  | 'GAME_END';    // 全局结束

type GameState = {
  config: GameConfig;
  roundIndex: number;            // 当前局序号 (0-based)
  dealer: Seat;                  // 庄家
  phase: Phase;
  players: PlayerState[];        // 4 个
  wall: TileIndex[];             // 牌墙（剩余可摸）
  turn: Seat;                    // 当前轮到谁
  lastDiscard: { seat: Seat; tile: TileIndex } | null;
  pendingResponses: Seat[];      // 等待响应弃牌的座位
  log: GameEvent[];              // 事件流水（驱动 UI + 回放）
};
```

---

## 3. 引擎核心算法

### 3.1 胡牌判定 `winning.ts`
入参：`hand: Counts`、`melds: Meld[]`、`lackSuit`、（可选）`winningTile`。
流程：
1. **补入胡牌张**：点炮、抢杠胡、查叫试算等 13 张手牌场景，先把 `winningTile` 加入暗牌计数，形成 14 张判定视图；自摸场景手牌已经包含摸入牌。
2. **缺门校验**：若判定视图中含 lackSuit 的牌 → 直接 false。
3. **七对系列判定**（仅当无任何副露 melds）：14 张暗牌恰好分成 7 对则成立；统计 4 张相同的组数 → 龙(1)/双龙(2)/三龙(3)。
4. **标准型判定**：枚举雀头（任一 ≥2 张的 index），移除后对**每门花色独立**递归拆解为顺子/刻子；三门均可拆完且面子总数 = 4 - 副露杠/碰折算数 → 成立。
5. 返回是否可胡 + 该胡法的结构信息（供 fan.ts 用）。

递归拆解（单门）：
```
canDecompose(counts):
  找第一张非零牌 i
  尝试作刻子(counts[i]>=3) 或 顺子(i,i+1,i+2 都>0) 递归
  全消耗完返回 true
```
记忆化 + 仅 9 格，性能极佳。

### 3.2 向听数 `shanten.ts`
- 标准型向听 = min over 雀头/搭子组合的 `(4 - 面子数)*2 - 搭子数 - 雀头`（经典公式变体）。
- 七对向听 = `6 - 对子数 + max(0, 7 - 种类数)`。
- 取两者最小。AI 出牌与流局听牌判定（向听=0 即听牌）共用。

### 3.3 番型识别 `fan.ts`
对一手可胡的牌：
1. 判定牌型类别：七对系列 / 对对胡（全刻子+杠）/ 金钩钓（对对胡且除将外全明副露单吊，暗杠不计入金钩钓的明副露）/ 平胡。
2. 判定清一色（全一门）→ 组合成最终 basePattern，查表得 baseFan。
3. 计算加番：
   - **根**：统计 4 张相同组数，包括杠、暗手 4 张、或碰牌后手中保留第 4 张；龙七对系列不计根；十八罗汉四杠额外 +4。
   - 自摸 / 杠上开花 / 海底捞月或海底炮 / 门清 / 抢杠胡：由 session 传入的上下文标志决定。
   - **门清**：无碰、无明杠、无补杠；暗杠不破门清；七对系列可加门清。
4. `totalFan = baseFan + Σ加番`，`cappedFan = min(totalFan, capFan)`，`score = baseScore × 2^cappedFan`。

> 番型番数表硬编码于 `fan.ts` 常量，与 PRD §3.7.2 一致，集中可调。

### 3.4 记分 `scoring.ts`
- **番型付分**：点炮（放炮家向每名胡牌者各付一份，支持一炮多响）/ 自摸（仍在桌的未胡玩家各付一份），生成 payments，更新 roundScore，并保证零和。
- **杠分（刮风下雨）**：明杠 2×底（放杠家付）；暗杠 2×底×仍在桌的其他未胡玩家；补杠 1×底×仍在桌的其他未胡玩家。即时结算，记入 `gangScoreReceived`（含付方，退税用）。
- **抢杠胡**：补杠被抢 → 取消补杠杠分，按点炮胡处理 +1 番；若多人可抢杠胡，按一炮多响同时结算。
- **流局查大叫**：对每个未胡玩家计算是否真听牌（无定缺花色，且至少存在一张补入后可胡的牌）+ 其所有可胡牌中的最大番型分；未听者赔给听牌未胡者。
- **退税**：enableTuiShui 时，既没胡又没听的玩家，逐条退还 `gangScoreReceived`（反向 payment）。
- 所有结算后断言 `Σ roundScore == 0`（开发期断言）。

---

## 4. 状态机 `session.ts`

### 4.1 GameSession API
```ts
class GameSession {
  constructor(config: GameConfig, opts?: { wall?: TileIndex[]; dealer?: Seat });
  // opts.wall 注入固定牌堆 → 确定性测试

  getState(): GameState;

  // 玩家/AI 动作（统一入口，内部校验）
  chooseLack(seat: Seat, suit: Suit): void;
  discard(seat: Seat, tile: TileIndex): void;
  pong(seat: Seat): void;
  gang(seat: Seat, tile: TileIndex, kind: GangKind): void;
  win(seat: Seat): void;           // 胡（自摸或点炮，内部判定来源）
  pass(seat: Seat): void;

  // 查询（UI 按钮亮灭 / AI 决策共用）
  canPong(seat: Seat): boolean;
  canGang(seat: Seat): GangOption[];
  canWin(seat: Seat): boolean;
  legalDiscards(seat: Seat): TileIndex[];

  on(event: GameEventType, cb): void;  // 事件订阅（UI/日志）
}
```

### 4.2 单局流程（状态转移）
```
DEAL → 发 13/14 张 → CHOOSE_LACK
CHOOSE_LACK → 四家定缺完成 → PLAYING（庄家先打）
PLAYING 循环:
  当前 turn 摸牌
    → 可自摸/暗杠/补杠? 触发响应
  打出一张 → 设 lastDiscard
    → 其他家按优先级响应: 胡 > 杠 > 碰 > 过
       (多家可胡: 一炮多响，所有选择胡牌者同时结算并下桌)
       (抢杠胡: 补杠时其他家可胡，优先级最高)
    → 碰/杠者成为新的 turn；无人响应则下家摸牌
  胡牌 → 胡牌玩家 hasLeft=true（可能一炮多响多人同时下桌），结算番型分
  终止条件: 3 家 hasLeft 或 wall 空 → ROUND_END
ROUND_END → 流局查大叫 + 退税 → 更新 totalScore
  → roundIndex+1 < totalRounds? 换庄 DEAL : GAME_END
```

### 4.3 响应优先级
同一张弃牌多家可响应时：**胡 > 杠 > 碰**；多家可胡不截胡，采用**一炮多响**，所有选择胡牌的未胡玩家同时胡牌并分别向放炮者收取番型分。

---

## 5. AI 模块

### 5.1 接口
```ts
interface BotStrategy {
  chooseLack(state: GameState, seat: Seat): Suit;
  chooseDiscard(state: GameState, seat: Seat): TileIndex;
  respondToDiscard(state: GameState, seat: Seat, tile: TileIndex):
    { action: 'PONG'|'GANG'|'WIN'|'PASS'; gangTile?: TileIndex };
  respondToSelfDraw(state: GameState, seat: Seat, drawn: TileIndex):
    { action: 'GANG'|'WIN'|'DISCARD'; gangTile?: TileIndex; discard?: TileIndex };
}
```

### 5.2 BasicBot 实现要点
- `chooseLack`：选三门中张数最少的一门。
- `chooseDiscard`：缺门牌优先（孤张序）→ 否则遍历可打牌，选打出后 shanten 最小者；并列时打孤张/边张。
- `respondToDiscard`：能胡则胡；可杠且不增大 shanten 则杠；可碰且碰后 shanten 不变差（或利于对对胡）则碰；否则过。
- `respondToSelfDraw`：能胡则胡；可暗杠/补杠且不破坏听牌则杠；否则进入出牌。
- 所有决策调用 session 的 `canXxx` 校验，不重复实现规则。

### 5.3 扩展点
未来 `LLMBot implements BotStrategy`：序列化 GameState 为 prompt，调用大模型，解析其决策；引擎与流程零改动。

---

## 6. 前端设计

### 6.1 状态管理
- Zustand store 持有 `GameSession` 实例与派生的 `GameState`。
- `gameLoop` 调度器：推进 AI 回合，用 `setTimeout` 加思考延迟；玩家回合等待 UI 输入。
- UI 订阅 state 重渲染；用户操作 → 调 session 方法 → 新 state。

### 6.2 组件清单
| 组件 | 职责 |
|---|---|
| `TileView` | CSS 绘制单张牌（数字+花色色块） |
| `HandPanel` | 自己手牌横排、选中/出牌、缺门高亮 |
| `DiscardPool` | 中央牌河，按序排列四家弃牌 |
| `SeatPanel` | AI 座位：牌背张数、副露、定缺标记、已胡状态 |
| `ActionBar` | 碰/杠/胡/过/定缺按钮，按 `canXxx` 亮灭 |
| `LackModal` | 定缺弹窗 |
| `RoundResultPanel` | 单局结算明细（番型/杠分/查大叫/退税/净分） |
| `ScoreBoard` | 累计总分 + 局数；全局结束总排名 |

### 6.3 页面
- `LobbyPage`：规则配置表单 → 创建 session。
- `TablePage`：牌桌主界面，组合上述组件。

---

## 7. 测试设计

### 7.1 引擎单元测试（Vitest，覆盖率 ≥ 90%）
- 胡牌判定：各番型正例/反例、含缺门反例、边界。
- 番型识别：每番型 ≥2 例，验证番数（含加根/自摸/杠上开花/海底/门清/抢杠胡叠加）。
- 记分：点炮/自摸付分、封顶、刮风下雨杠分、抢杠胡、查大叫、退税。
- 向听数：已知手牌断言值。
- 合法性：canPong/canGang 边界。

### 7.2 集成测试
- 固定牌堆注入 → 确定性整局 → 断言最终分数。
- 血战流程：下桌、3 家胡提前结束、流局查大叫+退税。
- 多局换庄、累计分。

### 7.3 AI 冒烟测试
- 4 个 BasicBot 互打 N 局，无崩溃、无非法操作、**每局四家分数总和 = 0**（零和守恒，记分总闸）。

### 7.4 前端组件测试
- React Testing Library：ActionBar 亮灭、RoundResultPanel 渲染。

---

## 8. 开发交付顺序
| 步 | 内容 | 交付物 |
|---|---|---|
| 0 | PRD + TRD | 文档（本阶段） |
| 1 | 脚手架 + monorepo + 类型 | 可 build/test 空壳 |
| 2 | tiles + 牌堆 + 测试 | `tiles.ts` |
| 3 | winning + shanten + 测试 | 判定模块 |
| 4 | fan + scoring（全规则）+ 测试 | 记分模块 |
| 5 | session 状态机 + 集成测试 | `session.ts` |
| 6 | basicBot + AI 互打冒烟 | `ai/` |
| 7 | 前端 UI | `apps/web` |
| 8 | 联调 + 组件测试 + 跑通 | 可玩网站 |
| 9 | 第二阶段真人房间设计（仅文档） | 预留设计 |

---

## 9. 第二阶段预留（不实现）
- `GameSession` 移至 Node 服务端做权威裁决，前端经 WebSocket 收发 action/state。
- 房间制：创建房间 → 分享房号 → 玩家加入，不做匹配。
- AI 可在服务端为空位补位。
- 引擎代码零改动复用，仅新增 server 传输层与房间管理。
