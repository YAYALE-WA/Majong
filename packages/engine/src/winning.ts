import { type Counts, type Meld, type Suit, type TileIndex } from './types';
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

/** 综合胡牌判定（含缺门校验）。melds 为已公开副露。
 *  winningTile: 点炮/抢杠胡时补入该张（13 张手牌 + 1 张），自摸时手牌已含 14 张不需传。
 */
export function canWin(
  hand: Counts,
  melds: Meld[],
  lackSuit: Suit | null,
  winningTile?: TileIndex,
): boolean {
  // 如有待补入的胡牌张，生成 14 张视图
  const h = winningTile !== undefined ? hand.slice() : hand;
  if (winningTile !== undefined) h[winningTile]! += 1;

  if (lackSuit) {
    for (let i = 0; i < 27; i++) {
      if (h[i]! > 0 && suitOfIndex(i) === lackSuit) return false;
    }
  }
  if (melds.length === 0 && classifyChiDui(h).isChiDui) return true;
  return canWinStandard(h, melds.length);
}
