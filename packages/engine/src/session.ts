import {
  type GameConfig, type GameState, type PlayerState, type Seat, type Suit,
  type TileIndex, type Meld, type GangKind, type WinRecord, type WinType,
} from './types';
import { makeWall, shuffle, emptyCounts, suitOfIndex } from './tiles';
import { canWin } from './winning';
import { computeFan, type FanContext } from './fan';
import { settleWin, settleGang, settleDraw, settleTuiShui, type Delta } from './scoring';

type ResponseAction = 'PONG' | 'GANG' | 'WIN' | 'PASS';

const SEATS: Seat[] = [0, 1, 2, 3];

function emptyPlayer(seat: Seat): PlayerState {
  return {
    seat,
    hand: emptyCounts(),
    melds: [],
    discards: [],
    lackSuit: null,
    hasLeft: false,
    winRecord: null,
    gangScoreReceived: [],
    roundScore: 0,
    totalScore: 0,
  };
}

export class GameSession {
  private state: GameState;
  private rng: () => number;
  private initialDealer: Seat;

  // 回合内私有标志
  private drawnTile: TileIndex | null = null;     // 当前 turn 摸到的牌（自摸/暗杠/补杠 上下文）
  private gangFlowerPending = false;              // 当前摸牌来自杠补摸（杠上开花）
  private pendingHaidi = false;                   // 当前为最后一张牌（海底）
  private responseClaims: Map<Seat, ResponseAction> = new Map();

  constructor(config: GameConfig, opts?: { wall?: TileIndex[]; dealer?: Seat; rng?: () => number }) {
    this.rng = opts?.rng ?? Math.random;
    this.initialDealer = opts?.dealer ?? 0;
    this.state = {
      config,
      roundIndex: 0,
      dealer: this.initialDealer,
      phase: 'DEAL',
      players: SEATS.map((s) => emptyPlayer(s)),
      wall: [],
      turn: this.initialDealer,
      lastDiscard: null,
      pendingResponses: [],
    };
    this.deal(opts?.wall);
  }

  getState(): GameState {
    return this.state;
  }

  // ============ 发牌 ============
  private deal(injectedWall?: TileIndex[]): void {
    const st = this.state;
    const wall = injectedWall ? injectedWall.slice() : shuffle(makeWall(), this.rng);
    // 每家 13 张，庄家 14 张。从 wall 尾部摸（pop）。
    for (const p of st.players) {
      p.hand = emptyCounts();
      p.melds = [];
      p.discards = [];
      p.lackSuit = null;
      p.hasLeft = false;
      p.winRecord = null;
      p.gangScoreReceived = [];
      p.roundScore = 0;
    }
    for (let k = 0; k < 13; k++) {
      for (const s of SEATS) {
        const t = wall.pop()!;
        st.players[s]!.hand[t]! += 1;
      }
    }
    // 庄家多摸一张（起手 14，先打）
    const extra = wall.pop()!;
    st.players[st.dealer]!.hand[extra]! += 1;
    st.wall = wall;
    st.turn = st.dealer;
    this.drawnTile = extra;
    this.gangFlowerPending = false;
    this.pendingHaidi = wall.length === 0;
    st.lastDiscard = null;
    st.pendingResponses = [];
    this.responseClaims.clear();
    st.phase = 'CHOOSE_LACK';
  }

  // ============ 定缺 ============
  chooseLack(seat: Seat, suit: Suit): void {
    const st = this.state;
    if (st.phase !== 'CHOOSE_LACK') throw new Error('not in CHOOSE_LACK phase');
    st.players[seat]!.lackSuit = suit;
    if (st.players.every((p) => p.lackSuit !== null)) {
      st.phase = 'PLAYING';
      st.turn = st.dealer;
      // 庄家已 14 张，进入「需出牌」状态（drawnTile 已设为起手多摸的那张）
    }
  }

  // ============ 查询 ============
  private activeMask(): boolean[] {
    return this.state.players.map((p) => !p.hasLeft);
  }
  private otherActiveSeats(seat: Seat): Seat[] {
    return SEATS.filter((s) => s !== seat && !this.state.players[s]!.hasLeft);
  }
  private nextActiveSeat(after: Seat): Seat | null {
    for (let i = 1; i <= 4; i++) {
      const s = ((after + i) % 4) as Seat;
      if (!this.state.players[s]!.hasLeft) return s;
    }
    return null;
  }

  /** turn 座位摸牌后能否自摸胡 */
  canWinSelf(seat: Seat): boolean {
    const p = this.state.players[seat]!;
    if (p.hasLeft) return false;
    return canWin(p.hand, p.melds, p.lackSuit);
  }
  /** 别家弃牌 tile，seat 能否点炮胡 */
  canWinOn(seat: Seat, tile: TileIndex): boolean {
    const p = this.state.players[seat]!;
    if (p.hasLeft) return false;
    return canWin(p.hand, p.melds, p.lackSuit, tile);
  }
  canPongOn(seat: Seat, tile: TileIndex): boolean {
    const p = this.state.players[seat]!;
    return !p.hasLeft && p.hand[tile]! >= 2;
  }
  /** 直杠（别家弃牌，手中 3 张） */
  canGangOn(seat: Seat, tile: TileIndex): boolean {
    const p = this.state.players[seat]!;
    return !p.hasLeft && p.hand[tile]! >= 3;
  }
  /** turn 座位可暗杠的牌（手中 4 张） */
  canAnGang(seat: Seat): TileIndex[] {
    const p = this.state.players[seat]!;
    const out: TileIndex[] = [];
    for (let i = 0; i < 27; i++) if (p.hand[i]! === 4) out.push(i);
    return out;
  }
  /** turn 座位可补杠的牌（已碰且手中再有 1 张） */
  canBuGang(seat: Seat): TileIndex[] {
    const p = this.state.players[seat]!;
    const out: TileIndex[] = [];
    for (const m of p.melds) {
      if (m.kind === 'PONG' && p.hand[m.tile]! >= 1) out.push(m.tile);
    }
    return out;
  }
  /** 合法出牌：手中所有 >0 的牌（缺门牌也可打） */
  legalDiscards(seat: Seat): TileIndex[] {
    const p = this.state.players[seat]!;
    const out: TileIndex[] = [];
    for (let i = 0; i < 27; i++) if (p.hand[i]! > 0) out.push(i);
    return out;
  }

  // ============ 出牌 ============
  discard(seat: Seat, tile: TileIndex): void {
    const st = this.state;
    if (st.phase !== 'PLAYING') throw new Error('not PLAYING');
    if (st.turn !== seat) throw new Error('not your turn');
    const p = st.players[seat]!;
    if (p.hasLeft) throw new Error('player has left');
    if (p.hand[tile]! <= 0) throw new Error('no such tile');

    p.hand[tile]! -= 1;
    p.discards.push(tile);
    st.lastDiscard = { seat, tile };
    this.drawnTile = null;
    this.gangFlowerPending = false;
    // pendingHaidi 保持（本次摸的是最后一张时，弃牌点炮算海底炮）

    // 计算可响应的座位
    const responders = this.otherActiveSeats(seat).filter(
      (o) => this.canWinOn(o, tile) || this.canGangOn(o, tile) || this.canPongOn(o, tile),
    );
    this.responseClaims.clear();
    st.pendingResponses = responders;
    if (responders.length === 0) {
      this.advanceDraw(seat);
    }
  }

  // ============ 响应：碰/杠/胡/过 ============
  private recordClaim(seat: Seat, action: ResponseAction): void {
    const st = this.state;
    if (!st.pendingResponses.includes(seat)) throw new Error('seat not pending response');
    this.responseClaims.set(seat, action);
    st.pendingResponses = st.pendingResponses.filter((s) => s !== seat);
    if (st.pendingResponses.length === 0) this.resolveResponses();
  }

  pong(seat: Seat): void {
    if (!this.canPongOn(seat, this.state.lastDiscard!.tile)) throw new Error('cannot pong');
    this.recordClaim(seat, 'PONG');
  }
  /** 响应别家弃牌的直杠 */
  gangFromDiscard(seat: Seat): void {
    if (!this.canGangOn(seat, this.state.lastDiscard!.tile)) throw new Error('cannot gang');
    this.recordClaim(seat, 'GANG');
  }
  /** 响应胡（点炮） */
  winFromDiscard(seat: Seat): void {
    if (!this.canWinOn(seat, this.state.lastDiscard!.tile)) throw new Error('cannot win');
    this.recordClaim(seat, 'WIN');
  }
  pass(seat: Seat): void {
    this.recordClaim(seat, 'PASS');
  }

  private resolveResponses(): void {
    const st = this.state;
    const discarder = st.lastDiscard!.seat;
    const tile = st.lastDiscard!.tile;
    const claims = this.responseClaims;
    const winners = [...claims.entries()].filter(([, a]) => a === 'WIN').map(([s]) => s);

    if (winners.length > 0) {
      // 一炮多响：所有胡牌者同时胡，放炮者分别支付
      for (const w of winners) {
        this.applyWin(w, { from: discarder, zimo: false, tile, haidi: this.pendingHaidi, qiangGang: false, gangFlower: false });
      }
      st.pendingResponses = [];
      this.responseClaims.clear();
      if (this.checkRoundEnd()) return;
      this.advanceDraw(discarder);
      return;
    }
    const gangers = [...claims.entries()].filter(([, a]) => a === 'GANG').map(([s]) => s);
    if (gangers.length > 0) {
      this.applyMingGang(gangers[0]!, tile, discarder);
      st.pendingResponses = [];
      this.responseClaims.clear();
      return;
    }
    const pongers = [...claims.entries()].filter(([, a]) => a === 'PONG').map(([s]) => s);
    if (pongers.length > 0) {
      this.applyPong(pongers[0]!, tile);
      st.pendingResponses = [];
      this.responseClaims.clear();
      return;
    }
    // 全部过
    st.pendingResponses = [];
    this.responseClaims.clear();
    this.advanceDraw(discarder);
  }

  // ============ 自摸阶段动作 ============
  /** turn 座位自摸胡 */
  winSelf(seat: Seat): void {
    if (this.state.turn !== seat) throw new Error('not your turn');
    if (!this.canWinSelf(seat)) throw new Error('cannot zimo');
    this.applyWin(seat, {
      from: null, zimo: true, tile: null,
      haidi: this.pendingHaidi, qiangGang: false, gangFlower: this.gangFlowerPending,
    });
    if (this.checkRoundEnd()) return;
    this.advanceDraw(seat);
  }

  /** turn 座位杠（暗杠 GANG_AN 或 补杠 GANG_BU） */
  gang(seat: Seat, tile: TileIndex, kind: GangKind): void {
    const st = this.state;
    if (st.turn !== seat) throw new Error('not your turn');
    const p = st.players[seat]!;
    if (kind === 'GANG_AN') {
      if (p.hand[tile]! !== 4) throw new Error('cannot an-gang');
      p.hand[tile]! -= 4;
      p.melds.push({ kind: 'GANG_AN', tile });
      this.applyGangScore(seat, 'GANG_AN', null, tile);
      this.drawReplacement(seat);
      return;
    }
    if (kind === 'GANG_BU') {
      const meld = p.melds.find((m) => m.kind === 'PONG' && m.tile === tile);
      if (!meld || p.hand[tile]! < 1) throw new Error('cannot bu-gang');
      // 抢杠胡判定
      if (st.config.enableQiangGang) {
        const robbers = this.otherActiveSeats(seat).filter((o) => this.canWinOn(o, tile));
        if (robbers.length > 0) {
          for (const r of robbers) {
            this.applyWin(r, { from: seat, zimo: false, tile, haidi: this.pendingHaidi, qiangGang: true, gangFlower: false });
          }
          p.hand[tile]! -= 1; // 被抢的那张离开补杠者手牌
          if (this.checkRoundEnd()) return;
          this.advanceDraw(seat);
          return;
        }
      }
      // 补杠成功
      p.hand[tile]! -= 1;
      const idx = p.melds.indexOf(meld);
      p.melds[idx] = { kind: 'GANG_BU', tile };
      this.applyGangScore(seat, 'GANG_BU', null, tile);
      this.drawReplacement(seat);
      return;
    }
    throw new Error('GANG_MING must come from discard');
  }

  // ============ 内部：碰/杠/胡 应用 ============
  private applyPong(seat: Seat, tile: TileIndex): void {
    const st = this.state;
    const p = st.players[seat]!;
    p.hand[tile]! -= 2;
    p.melds.push({ kind: 'PONG', tile });
    st.turn = seat;
    this.drawnTile = null;
    this.gangFlowerPending = false;
    // 碰后该家出牌（不摸牌）
  }

  private applyMingGang(seat: Seat, tile: TileIndex, from: Seat): void {
    const st = this.state;
    const p = st.players[seat]!;
    p.hand[tile]! -= 3;
    p.melds.push({ kind: 'GANG_MING', tile, from });
    this.applyGangScore(seat, 'GANG_MING', from, tile);
    this.drawReplacement(seat);
  }

  private applyGangScore(seat: Seat, kind: GangKind, from: Seat | null, _tile: TileIndex): void {
    const st = this.state;
    const base = st.config.baseScore;
    const delta = settleGang({ ganger: seat, kind, from, baseScore: base, active: this.activeMask() });
    this.applyDelta(delta);
    // 记录收到的杠分（退税用）：记录每个付方
    for (const s of SEATS) {
      if (delta[s] < 0) {
        st.players[seat]!.gangScoreReceived.push({ from: s, amount: -delta[s], gangType: kind });
      }
    }
  }

  private applyWin(
    seat: Seat,
    o: { from: Seat | null; zimo: boolean; tile: TileIndex | null; haidi: boolean; qiangGang: boolean; gangFlower: boolean },
  ): void {
    const st = this.state;
    const p = st.players[seat]!;
    // 构造判定用的「含胡牌张」暗牌视图
    const concealed = p.hand.slice();
    if (!o.zimo && o.tile !== null) concealed[o.tile]! += 1;
    const ctx: FanContext = {
      zimo: o.zimo,
      gangFlower: o.gangFlower,
      haidi: o.haidi,
      qiangGang: o.qiangGang,
      baseScore: st.config.baseScore,
      capFan: st.config.capFan,
    };
    const fan = computeFan(concealed, p.melds, ctx);
    const delta = settleWin({ winner: seat, from: o.zimo ? null : o.from, zimo: o.zimo, fan, active: this.activeMask() });
    this.applyDelta(delta);
    const winType: WinType = o.zimo ? 'ZIMO' : 'DIANPAO';
    const payments: WinRecord['payments'] = [];
    for (const s of SEATS) {
      if (delta[s] < 0) payments.push({ from: s, to: seat, amount: -delta[s] });
    }
    p.winRecord = { seat, winType, from: o.zimo ? null : o.from, fan, payments };
    p.hasLeft = true;
  }

  private applyDelta(delta: Delta): void {
    for (const s of SEATS) this.state.players[s]!.roundScore += delta[s];
  }

  // ============ 摸牌推进 ============
  private advanceDraw(after: Seat): void {
    const st = this.state;
    if (st.wall.length === 0) {
      this.endRoundDraw();
      return;
    }
    const next = this.nextActiveSeat(after);
    if (next === null) {
      this.endRound();
      return;
    }
    const tile = st.wall.pop()!;
    st.players[next]!.hand[tile]! += 1;
    st.turn = next;
    this.drawnTile = tile;
    this.gangFlowerPending = false;
    this.pendingHaidi = st.wall.length === 0;
    st.lastDiscard = null;
    // next 需要行动：自摸胡 / 暗杠 / 补杠 / 出牌
  }

  private drawReplacement(seat: Seat): void {
    const st = this.state;
    if (st.wall.length === 0) {
      this.endRoundDraw();
      return;
    }
    const tile = st.wall.pop()!;
    st.players[seat]!.hand[tile]! += 1;
    st.turn = seat;
    this.drawnTile = tile;
    this.gangFlowerPending = true; // 杠上补摸
    this.pendingHaidi = st.wall.length === 0;
    st.lastDiscard = null;
  }

  // ============ 终局判定与结算 ============
  private checkRoundEnd(): boolean {
    const leftCount = this.state.players.filter((p) => p.hasLeft).length;
    if (leftCount >= 3) {
      this.endRound();
      return true;
    }
    return false;
  }

  /** 3 家胡提前结束：不查叫不退税 */
  private endRound(): void {
    this.state.phase = 'ROUND_END';
    this.state.pendingResponses = [];
  }

  /** 流局：查大叫 + 退税 */
  private endRoundDraw(): void {
    const st = this.state;
    // 计算每个未胡玩家的听牌最大番分
    const tingScores: (number | null)[] = [null, null, null, null];
    for (const p of st.players) {
      if (p.hasLeft) continue;
      tingScores[p.seat] = this.maxTingScore(p);
    }
    const hasLeft = st.players.map((p) => p.hasLeft);
    const drawDelta = settleDraw({ tingScores, hasLeft });
    this.applyDelta(drawDelta);

    // 退税：未胡 且 未听 的玩家，退还已收杠分
    if (st.config.enableTuiShui) {
      const entries: { ganger: Seat; from: Seat; amount: number }[] = [];
      for (const p of st.players) {
        if (p.hasLeft) continue;
        if (tingScores[p.seat] !== null) continue; // 听牌不退
        for (const g of p.gangScoreReceived) {
          entries.push({ ganger: p.seat, from: g.from, amount: g.amount });
        }
      }
      if (entries.length > 0) this.applyDelta(settleTuiShui(entries));
    }

    st.phase = 'ROUND_END';
    st.pendingResponses = [];
  }

  /** 真听牌判定 + 最大番分：无缺门 且 存在补入后可胡的牌；返回最高番分，未听返回 null */
  private maxTingScore(p: PlayerState): number | null {
    // 含缺门牌则未听
    for (let i = 0; i < 27; i++) {
      if (p.hand[i]! > 0 && suitOfIndex(i) === p.lackSuit) return null;
    }
    let best: number | null = null;
    for (let t = 0; t < 27; t++) {
      if (suitOfIndex(t) === p.lackSuit) continue; // 补缺门的牌不算
      if (!canWin(p.hand, p.melds, p.lackSuit, t)) continue;
      const concealed = p.hand.slice();
      concealed[t]! += 1;
      const ctx: FanContext = {
        zimo: false, gangFlower: false, haidi: false, qiangGang: false,
        baseScore: this.state.config.baseScore, capFan: this.state.config.capFan,
      };
      const fan = computeFan(concealed, p.melds, ctx);
      if (best === null || fan.score > best) best = fan.score;
    }
    return best;
  }

  // ============ 多局推进 ============
  nextRound(): void {
    const st = this.state;
    if (st.phase !== 'ROUND_END') throw new Error('round not ended');
    // 累计总分
    for (const p of st.players) {
      p.totalScore += p.roundScore;
    }
    if (st.roundIndex + 1 >= st.config.totalRounds) {
      st.phase = 'GAME_END';
      return;
    }
    st.roundIndex += 1;
    st.dealer = ((st.dealer + 1) % 4) as Seat;
    this.deal();
  }
}
