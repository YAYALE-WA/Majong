export const SUITS = ['W', 'T', 'B'] as const;
export type Suit = (typeof SUITS)[number];
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Tile = { suit: Suit; rank: Rank };
export type TileIndex = number; // 0..26
export type Counts = number[];  // length 27
export type Seat = 0 | 1 | 2 | 3;

export type Meld =
  | { kind: 'PONG'; tile: TileIndex }
  | { kind: 'GANG_MING'; tile: TileIndex; from: Seat }
  | { kind: 'GANG_AN'; tile: TileIndex }
  | { kind: 'GANG_BU'; tile: TileIndex };

export type GangKind = 'GANG_MING' | 'GANG_AN' | 'GANG_BU';

export type GangScore = { from: Seat; amount: number; gangType: GangKind };

export type WinType = 'ZIMO' | 'DIANPAO';

export type FanResult = {
  baseFan: number;
  basePattern: string;
  addOns: { name: string; fan: number }[];
  totalFan: number;
  cappedFan: number;
  score: number;
};

export type WinRecord = {
  seat: Seat;
  winType: WinType;
  from: Seat | null;
  fan: FanResult;
  payments: { from: Seat; to: Seat; amount: number }[];
};

export type PlayerState = {
  seat: Seat;
  hand: Counts;
  melds: Meld[];
  discards: TileIndex[];
  lackSuit: Suit | null;
  hasLeft: boolean;
  winRecord: WinRecord | null;
  gangScoreReceived: GangScore[];
  roundScore: number;
  totalScore: number;
};

export type GameConfig = {
  baseScore: number;
  capFan: number | null;
  totalRounds: number;
  enableQiangGang: boolean;
  enableTuiShui: boolean;
};

export type Phase = 'DEAL' | 'CHOOSE_LACK' | 'PLAYING' | 'ROUND_END' | 'GAME_END';

export type GameState = {
  config: GameConfig;
  roundIndex: number;
  dealer: Seat;
  phase: Phase;
  players: PlayerState[];
  wall: TileIndex[];
  turn: Seat;
  lastDiscard: { seat: Seat; tile: TileIndex } | null;
  pendingResponses: Seat[];
};
