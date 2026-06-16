import { type Counts } from './types';

// 单门递归：返回最优 {面子数, 搭子数}
// pairs 涵盖将与搭子（两张未成面子的组合）；hasPair 标记该拆解中是否存在一个
// 真正的对子（count>=2 的刻形对），可作为将。
function bestMelds(c: number[], i: number): { melds: number; pairs: number; hasPair: boolean } {
  while (i < 9 && c[i] === 0) i++;
  if (i >= 9) return { melds: 0, pairs: 0, hasPair: false };
  let best = { melds: 0, pairs: 0, hasPair: false };
  // 评分：优先面子，其次搭子；同分时优先含真对子（可作将）的拆解。
  const consider = (r: { melds: number; pairs: number; hasPair: boolean }) => {
    const rs = r.melds * 2 + r.pairs;
    const bs = best.melds * 2 + best.pairs;
    if (rs > bs || (rs === bs && r.hasPair && !best.hasPair)) best = r;
  };
  { const a = c.slice(); a[i]!--; const r = bestMelds(a, i); consider(r); }
  if (c[i]! >= 3) { const a = c.slice(); a[i]! -= 3; const r = bestMelds(a, i); consider({ melds: r.melds + 1, pairs: r.pairs, hasPair: r.hasPair }); }
  if (i <= 6 && c[i + 1]! > 0 && c[i + 2]! > 0) { const a = c.slice(); a[i]!--; a[i + 1]!--; a[i + 2]!--; const r = bestMelds(a, i); consider({ melds: r.melds + 1, pairs: r.pairs, hasPair: r.hasPair }); }
  if (c[i]! >= 2) { const a = c.slice(); a[i]! -= 2; const r = bestMelds(a, i); consider({ melds: r.melds, pairs: r.pairs + 1, hasPair: true }); }
  if (i <= 7 && c[i + 1]! > 0) { const a = c.slice(); a[i]!--; a[i + 1]!--; const r = bestMelds(a, i); consider({ melds: r.melds, pairs: r.pairs + 1, hasPair: r.hasPair }); }
  if (i <= 6 && c[i + 2]! > 0) { const a = c.slice(); a[i]!--; a[i + 2]!--; const r = bestMelds(a, i); consider({ melds: r.melds, pairs: r.pairs + 1, hasPair: r.hasPair }); }
  return best;
}

function standardShanten(hand: Counts, meldCount: number): number {
  const suits = [hand.slice(0, 9), hand.slice(9, 18), hand.slice(18, 27)];

  // 评估一组拆解（每门一个候选）得到的向听数。
  // reservedPair 表示是否已有某门预留了真正的将。
  const evalDecomp = (
    decomps: { melds: number; pairs: number; hasPair: boolean }[],
    reservedPair: boolean,
  ): number => {
    let totalMelds = meldCount;
    let totalPairs = 0;
    for (const r of decomps) {
      totalMelds += r.melds;
      totalPairs += r.pairs;
    }
    // 标准型目标 = 4 面子 + 1 将，共 5 个"块"。面子封顶 4，块数封顶 5。
    const melds = Math.min(totalMelds, 4);
    const blocks = Math.min(melds + totalPairs, 5);
    const partials = blocks - melds;
    let s = 8 - 2 * melds - partials;
    // 将校正：凑满 5 块但没有任何真正的将时，无法成型，向听 +1。
    if (melds + partials === 5 && !reservedPair) s += 1;
    return s;
  };

  // 候选 A：不强制预留将，直接按各门最优拆解。其中是否含真对子由拆解自身决定。
  const baseDecomps = suits.map((seg) => bestMelds(seg, 0));
  const baseHasPair = baseDecomps.some((r) => r.hasPair);
  let best = evalDecomp(baseDecomps, baseHasPair);

  // 候选 B：在某一门强制预留一个真对子作为将（含已存在对子的情况），
  // 余下牌再做最优面子/搭子拆解。这能覆盖"为成将而牺牲一个面子/搭子"更优的局面。
  for (let s = 0; s < 3; s++) {
    const seg = suits[s]!;
    for (let i = 0; i < 9; i++) {
      if (seg[i]! < 2) continue;
      const reduced = seg.slice();
      reduced[i]! -= 2;
      const decomps = suits.map((sg, k) => (k === s ? bestMelds(reduced, 0) : bestMelds(sg, 0)));
      // 预留的将额外占一个块（pairs+1），且 reservedPair=true。
      const withPair = decomps.map((r, k) =>
        k === s ? { melds: r.melds, pairs: r.pairs + 1, hasPair: true } : r,
      );
      const v = evalDecomp(withPair, true);
      if (v < best) best = v;
    }
  }

  return best;
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
