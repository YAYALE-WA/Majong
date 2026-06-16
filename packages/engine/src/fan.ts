import { type Counts, type Meld, type FanResult } from './types';
import { suitOfIndex } from './tiles';
import { classifyChiDui } from './winning';
import { isGang, isExposed } from './meld';

export type FanContext = {
  zimo: boolean;        // 自摸
  gangFlower: boolean;  // 杠上开花
  haidi: boolean;       // 海底（自摸最后一张 / 海底炮 由 session 统一置位）
  qiangGang: boolean;   // 抢杠胡
  baseScore: number;
  capFan: number | null;
};

/** 合并暗牌 + 副露成「完整 14 张视图」（清一色等需要） */
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

/** 对对胡：暗牌部分能拆成「刻子*k + 将」，且副露全是碰/杠（本项目无吃，副露必为刻形） */
function isPengPeng(hand: Counts, melds: Meld[]): boolean {
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

/** 金钩钓：4 副露 + 单吊将，且所有副露均为明副露（暗杠不计入金钩钓的明副露） */
function isJinGouDiao(hand: Counts, melds: Meld[]): boolean {
  const total = hand.reduce((a, b) => a + b, 0);
  return melds.length === 4 && total === 2 && melds.every(isExposed);
}

/** 十八罗汉：4 个杠 + 将 */
function isShiBaLuoHan(melds: Meld[]): boolean {
  return melds.length === 4 && melds.every(isGang);
}

/** 统计「根」：4 张相同的组数。
 *  包括：每个杠；暗手中 4 张相同；已碰 3 张后手中保留第 4 张。
 *  七对系列单独处理（不计根），不调用本函数。 */
function countGen(hand: Counts, melds: Meld[]): number {
  let gen = 0;
  for (const m of melds) {
    if (isGang(m)) gen += 1;
    else if (m.kind === 'PONG' && hand[m.tile]! >= 1) gen += 1; // 碰后手中留第 4 张
  }
  for (let i = 0; i < 27; i++) if (hand[i]! === 4) gen += 1; // 暗手 4 张
  return gen;
}

export function computeFan(hand: Counts, melds: Meld[], ctx: FanContext): FanResult {
  const full = fullCounts(hand, melds);
  const qing = isQingYiSe(full);
  const chidui = melds.length === 0 ? classifyChiDui(hand) : { isChiDui: false, longs: 0 };

  let baseFan = 0;
  let basePattern = '平胡';

  if (chidui.isChiDui) {
    // 七对系列：base = 2 + longs，清一色再 +2
    const names: Record<number, string> = { 0: '七对', 1: '龙七对', 2: '双龙七对', 3: '三龙七对' };
    const name = names[chidui.longs] ?? '七对';
    basePattern = qing ? `清${name}` : name;
    baseFan = (qing ? 2 : 0) + (2 + chidui.longs);
  } else if (isShiBaLuoHan(melds)) {
    basePattern = qing ? '清十八罗汉' : '十八罗汉';
    baseFan = (qing ? 2 : 0) + 5;
  } else if (isJinGouDiao(hand, melds)) {
    basePattern = qing ? '清金钩钓' : '金钩钓';
    baseFan = (qing ? 2 : 0) + 2;
  } else if (isPengPeng(hand, melds)) {
    basePattern = qing ? '清对' : '对对胡';
    baseFan = (qing ? 2 : 0) + 1;
  } else {
    basePattern = qing ? '清一色' : '平胡';
    baseFan = qing ? 2 : 0;
  }

  const addOns: { name: string; fan: number }[] = [];

  // 根（七对系列不计根，十八罗汉的 4 杠由 countGen 自然计为 4 根）
  if (!chidui.isChiDui) {
    const gen = countGen(hand, melds);
    if (gen > 0) addOns.push({ name: `根x${gen}`, fan: gen });
  }
  if (ctx.zimo) addOns.push({ name: '自摸', fan: 1 });
  if (ctx.gangFlower) addOns.push({ name: '杠上开花', fan: 1 });
  if (ctx.haidi) addOns.push({ name: '海底', fan: 1 });
  if (ctx.qiangGang) addOns.push({ name: '抢杠胡', fan: 1 });

  // 门清：无碰、无明杠、无补杠（暗杠不破门清）；七对系列（无副露）天然门清
  const menqing = melds.every((m) => m.kind === 'GANG_AN');
  if (menqing) addOns.push({ name: '门清', fan: 1 });

  const addFan = addOns.reduce((s, a) => s + a.fan, 0);
  const totalFan = baseFan + addFan;
  const cappedFan = ctx.capFan == null ? totalFan : Math.min(totalFan, ctx.capFan);
  const score = ctx.baseScore * Math.pow(2, cappedFan);

  return { baseFan, basePattern, addOns, totalFan, cappedFan, score };
}
