import { type Counts } from './types';

// 单门递归：返回最优 {面子数, 搭子数}
function bestMelds(c: number[], i: number): { melds: number; pairs: number } {
  while (i < 9 && c[i] === 0) i++;
  if (i >= 9) return { melds: 0, pairs: 0 };
  let best = { melds: 0, pairs: 0 };
  const consider = (r: { melds: number; pairs: number }) => {
    if (r.melds * 2 + r.pairs > best.melds * 2 + best.pairs) best = r;
  };
  { const a = c.slice(); a[i]!--; const r = bestMelds(a, i); consider(r); }
  if (c[i]! >= 3) { const a = c.slice(); a[i]! -= 3; const r = bestMelds(a, i); consider({ melds: r.melds + 1, pairs: r.pairs }); }
  if (i <= 6 && c[i + 1]! > 0 && c[i + 2]! > 0) { const a = c.slice(); a[i]!--; a[i + 1]!--; a[i + 2]!--; const r = bestMelds(a, i); consider({ melds: r.melds + 1, pairs: r.pairs }); }
  if (c[i]! >= 2) { const a = c.slice(); a[i]! -= 2; const r = bestMelds(a, i); consider({ melds: r.melds, pairs: r.pairs + 1 }); }
  if (i <= 7 && c[i + 1]! > 0) { const a = c.slice(); a[i]!--; a[i + 1]!--; const r = bestMelds(a, i); consider({ melds: r.melds, pairs: r.pairs + 1 }); }
  if (i <= 6 && c[i + 2]! > 0) { const a = c.slice(); a[i]!--; a[i + 2]!--; const r = bestMelds(a, i); consider({ melds: r.melds, pairs: r.pairs + 1 }); }
  return best;
}

function standardShanten(hand: Counts, meldCount: number): number {
  const suits = [hand.slice(0, 9), hand.slice(9, 18), hand.slice(18, 27)];
  let totalMelds = meldCount;
  let totalPairs = 0; // bestMelds 的 pairs 同时涵盖将与搭子（两张未成面子的组合）
  for (const seg of suits) {
    const r = bestMelds(seg, 0);
    totalMelds += r.melds;
    totalPairs += r.pairs;
  }
  // 标准型目标 = 4 面子 + 1 将，共 5 个"块"。
  // 块数（面子 + 搭子/将）封顶 5，面子封顶 4。
  const melds = Math.min(totalMelds, 4);
  const blocks = Math.min(melds + totalPairs, 5);
  const partials = blocks - melds;
  // 向听公式：8 - 2*面子 - 搭子。完整 4 面子 + 将（melds=4,partials=1）→ -1；听牌 → 0。
  return 8 - 2 * melds - partials;
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

/** 向听数：-1 表示已和牌，0 表示听牌 */
export function shanten(hand: Counts, meldCount: number): number {
  const std = standardShanten(hand, meldCount);
  const total = hand.reduce((a, b) => a + b, 0);
  if (meldCount === 0 && (total === 13 || total === 14)) {
    return Math.min(std, chiDuiShanten(hand));
  }
  return std;
}
