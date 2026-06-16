import { SUITS, type Suit, type Tile, type TileIndex, type Counts } from './types';

export function tileToIndex(t: Tile): TileIndex {
  return SUITS.indexOf(t.suit) * 9 + (t.rank - 1);
}
export function indexToTile(i: TileIndex): Tile {
  const suit = SUITS[Math.floor(i / 9)] as Suit;
  const rank = ((i % 9) + 1) as Tile['rank'];
  return { suit, rank };
}
export function suitOfIndex(i: TileIndex): Suit {
  return SUITS[Math.floor(i / 9)] as Suit;
}
export function rankOfIndex(i: TileIndex): number {
  return (i % 9) + 1;
}

export function emptyCounts(): Counts {
  return new Array<number>(27).fill(0);
}
export function countsAdd(c: Counts, i: TileIndex): Counts {
  const n = c.slice();
  n[i]! += 1;
  return n;
}
export function countsRemove(c: Counts, i: TileIndex): Counts {
  const n = c.slice();
  n[i]! -= 1;
  return n;
}
export function countsTotal(c: Counts): number {
  return c.reduce((a, b) => a + b, 0);
}
export function handToCounts(indices: TileIndex[]): Counts {
  const c = emptyCounts();
  for (const i of indices) c[i]! += 1;
  return c;
}

export function makeWall(): TileIndex[] {
  const wall: TileIndex[] = [];
  for (let i = 0; i < 27; i++) for (let k = 0; k < 4; k++) wall.push(i);
  return wall;
}

// 可注入随机源以做确定性测试
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
