import { SUITS, type Counts, type GameState, type Seat, type Suit, type TileIndex } from '../types';
import { suitOfIndex } from '../tiles';
import { shanten } from '../shanten';
import { canWin } from '../winning';
import { type BotStrategy } from './strategy';

export class BasicBot implements BotStrategy {
  chooseLackByHand(hand: Counts): Suit {
    const sums = [0, 0, 0];
    for (let i = 0; i < 27; i++) sums[Math.floor(i / 9)]! += hand[i]!;
    let min = 0;
    for (let k = 1; k < 3; k++) if (sums[k]! < sums[min]!) min = k;
    return SUITS[min]!;
  }

  chooseDiscardByHand(hand: Counts, lack: Suit | null, meldCount: number): TileIndex {
    // 1) 缺门牌优先（孤张先打）
    if (lack) {
      let single = -1;
      for (let i = 0; i < 27; i++) {
        if (hand[i]! > 0 && suitOfIndex(i) === lack) {
          if (single === -1 || hand[i]! < hand[single]!) single = i;
        }
      }
      if (single !== -1) return single;
    }
    // 2) 向听最小化
    let best = -1;
    let bestSh = Infinity;
    for (let i = 0; i < 27; i++) {
      if (hand[i]! === 0) continue;
      const test = hand.slice();
      test[i]! -= 1;
      const sh = shanten(test, meldCount);
      if (sh < bestSh || (sh === bestSh && best !== -1 && hand[i]! < hand[best]!)) {
        bestSh = sh; best = i;
      }
    }
    return best;
  }

  chooseLack(state: GameState, seat: Seat): Suit {
    return this.chooseLackByHand(state.players[seat]!.hand);
  }

  chooseDiscard(state: GameState, seat: Seat): TileIndex {
    const p = state.players[seat]!;
    return this.chooseDiscardByHand(p.hand, p.lackSuit, p.melds.length);
  }

  respondToDiscard(state: GameState, seat: Seat, tile: TileIndex) {
    const p = state.players[seat]!;
    if (canWin(p.hand, p.melds, p.lackSuit, tile)) return { action: 'WIN' as const };
    if (p.hand[tile]! >= 3) {
      // 直杠：杠后 shanten 不变差
      const after = p.hand.slice(); after[tile]! -= 3;
      const before = shanten(p.hand, p.melds.length);
      if (shanten(after, p.melds.length + 1) <= before) return { action: 'GANG' as const, gangTile: tile };
    }
    if (p.hand[tile]! >= 2) {
      // 碰：碰后 shanten 不变差
      const after = p.hand.slice(); after[tile]! -= 2;
      const before = shanten(p.hand, p.melds.length);
      if (shanten(after, p.melds.length + 1) <= before) return { action: 'PONG' as const };
    }
    return { action: 'PASS' as const };
  }

  respondToSelfDraw(state: GameState, seat: Seat, drawn: TileIndex) {
    const p = state.players[seat]!;
    if (canWin(p.hand, p.melds, p.lackSuit)) return { action: 'WIN' as const };
    // 暗杠：手中任意 4 张相同（不限于刚摸的牌）
    let anGangTile = -1;
    for (let i = 0; i < 27; i++) if (p.hand[i]! === 4) { anGangTile = i; break; }
    if (anGangTile !== -1) {
      return { action: 'GANG' as const, gangTile: anGangTile, kind: 'GANG_AN' as const };
    }
    // 补杠
    const buTile = p.melds.find((m) => m.kind === 'PONG' && p.hand[m.tile]! >= 1);
    if (buTile) {
      const after = p.hand.slice(); after[buTile.tile]! -= 1;
      if (shanten(after, p.melds.length) <= shanten(p.hand, p.melds.length)) {
        return { action: 'GANG' as const, gangTile: buTile.tile, kind: 'GANG_BU' as const };
      }
    }
    void drawn;
    return { action: 'DISCARD' as const, discard: this.chooseDiscard(state, seat) };
  }
}
