import { type Seat, type FanResult, type GangKind } from './types';

export type Delta = [number, number, number, number];
const zero = (): Delta => [0, 0, 0, 0];

/** 番型付分：active[i]=true 表示该座位仍在桌（未胡下桌者不参与付分） */
export function settleWin(p: {
  winner: Seat;
  from: Seat | null;
  zimo: boolean;
  fan: FanResult;
  active: boolean[]; // length 4
}): Delta {
  const d = zero();
  const s = p.fan.score;
  if (p.zimo) {
    for (let i = 0; i < 4; i++) {
      if (i === p.winner || !p.active[i]) continue;
      d[i]! -= s;
      d[p.winner]! += s;
    }
  } else {
    d[p.from!]! -= s;
    d[p.winner]! += s;
  }
  return d;
}

/** 杠分（刮风下雨）：active[i]=true 表示仍在桌 */
export function settleGang(p: {
  ganger: Seat;
  kind: GangKind;
  from: Seat | null;
  baseScore: number;
  active: boolean[];
}): Delta {
  const d = zero();
  if (p.kind === 'GANG_MING') {
    const amt = 2 * p.baseScore;
    d[p.from!]! -= amt;
    d[p.ganger]! += amt;
  } else if (p.kind === 'GANG_AN') {
    const amt = 2 * p.baseScore;
    for (let i = 0; i < 4; i++) {
      if (i === p.ganger || !p.active[i]) continue;
      d[i]! -= amt;
      d[p.ganger]! += amt;
    }
  } else {
    // GANG_BU
    const amt = 1 * p.baseScore;
    for (let i = 0; i < 4; i++) {
      if (i === p.ganger || !p.active[i]) continue;
      d[i]! -= amt;
      d[p.ganger]! += amt;
    }
  }
  return d;
}

/** 流局查大叫：
 *  tingScores[i] = 该家听牌时的最大番型分（未听为 null）。
 *  已胡下桌者 hasLeft[i]=true，不参与流局补偿。
 */
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
      d[n]! -= score;
      d[t]! += score;
    }
  }
  return d;
}

/** 退税：只向「未胡且未听」的玩家收回其已获得的杠分 */
export function settleTuiShui(
  entries: { ganger: Seat; from: Seat; amount: number }[],
): Delta {
  const d = zero();
  for (const e of entries) {
    d[e.ganger]! -= e.amount;
    d[e.from]! += e.amount;
  }
  return d;
}
