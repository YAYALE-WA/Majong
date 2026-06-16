# 四川麻将 · 血战到底

四川麻将在线对战网站，单人对战 3 个 AI 机器人，完整实现血战到底玩法与翻番制记分。

## 快速开始

```bash
pnpm install
pnpm -C apps/web dev      # 开发服务器
pnpm -C apps/web build    # 生产构建
pnpm -r test              # 所有测试（引擎 59 + 前端 7 = 66 个）
```

## 规则说明

- **牌型**：万/条/筒各 1–9，共 108 张，无字牌
- **定缺**：每局开始前必须选定一门缺门，打完缺门才能胡牌
- **血战到底**：胡牌者下桌，剩余玩家继续，直到 3 家胡或牌摸完
- **一炮多响**：同一张弃牌可被多人同时胡，放炮者分别支付

### 主要番型

| 番型 | 番数 |
|------|------|
| 平胡 | 0 |
| 对对胡 | 1 |
| 金钩钓 | 2 |
| 清一色 / 七对 | 2 |
| 清对 / 龙七对 | 3 |
| 清金钩钓 / 清七对 / 双龙七对 | 4 |
| 十八罗汉 / 三龙七对 | 5 |
| 清十八罗汉 / 清三龙七对 | 7 |

**加番**：根（每组4张）+1、自摸 +1、杠上开花 +1、海底 +1、门清 +1、抢杠胡 +1

**记分**：`分数 = 底分 × 2^番数`，封顶可在开房时配置（5/7/10/不封顶）

### 杠分（刮风下雨）

| 杠型 | 收分（底分=1） |
|------|--------------|
| 明杠 | 放杠家付 2 |
| 暗杠 | 每家付 2 |
| 补杠 | 每家付 1 |

### 流局结算

- **查大叫**：未听牌者赔给听牌未胡者（按其最大番型分）
- **退税**：未胡且未听者退还已收杠分

## 项目结构

```
packages/engine/   # 纯 TypeScript 游戏引擎（零 UI/网络依赖）
  src/
    types.ts       # 共享类型
    tiles.ts       # 牌编码、牌堆、Counts
    winning.ts     # 胡牌判定（标准型 + 七对系列）
    shanten.ts     # 向听数
    fan.ts         # 番型识别
    scoring.ts     # 记分结算
    rules.ts       # 碰杠校验
    session.ts     # GameSession 状态机
    ai/basicBot.ts # 规则型 AI

apps/web/          # React + Vite 前端
  src/
    store/gameStore.ts  # Zustand + AI 调度器
    pages/              # LobbyPage / TablePage
    components/         # TileView / HandPanel / ActionBar 等
```

## 技术栈

- **TypeScript 全栈**（引擎共用，无需重复实现）
- React 18 + Vite + Zustand
- Vitest（TDD，零和守恒贯穿集成测试）

## 扩展计划

第二阶段可接入**真人房间制在线对战**：将 `GameSession` 平移至 Node 服务端，前端通过 WebSocket 收发 action/state，无需修改引擎代码。详见 [docs/TRD.md §9](docs/TRD.md)。

AI 机器人可接入大模型：实现 `LLMBot implements BotStrategy` 即可替换，接口见 [packages/engine/src/ai/strategy.ts](packages/engine/src/ai/strategy.ts)。
