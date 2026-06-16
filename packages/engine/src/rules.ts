import { SUITS, type Counts, type Suit, type TileIndex } from './types';

/** 别家打出 tile，手中有 >=2 张可碰 */
export function canPong(hand: Counts, tile: TileIndex): boolean {
  return hand[tile]! >= 2;
}

/** 别家打出 tile，手中有 3 张可直杠（明杠） */
export function canGangFromDiscard(hand: Counts, tile: TileIndex): boolean {
  return hand[tile]! >= 3;
}

/** 自己手中 4 张可暗杠 */
export function canGangSelf(hand: Counts, tile: TileIndex): boolean {
  return hand[tile]! === 4;
}

/** 合法定缺花色 */
export function validLack(s: Suit): boolean {
  return (SUITS as readonly string[]).includes(s);
}
