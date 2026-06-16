import { type Meld } from './types';

/** 是否为杠（明杠/暗杠/补杠） */
export function isGang(m: Meld): boolean {
  return m.kind === 'GANG_MING' || m.kind === 'GANG_AN' || m.kind === 'GANG_BU';
}

/** 是否为明副露（碰/明杠/补杠）。暗杠不算明副露（用于金钩钓与门清判定）。 */
export function isExposed(m: Meld): boolean {
  return m.kind === 'PONG' || m.kind === 'GANG_MING' || m.kind === 'GANG_BU';
}

/** 每个副露（碰或杠）在胡牌判定中折算为 1 个面子 */
export function meldCountForWin(melds: Meld[]): number {
  return melds.length;
}
