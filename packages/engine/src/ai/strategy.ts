import { type GameState, type Seat, type Suit, type TileIndex } from '../types';

export interface BotStrategy {
  chooseLack(state: GameState, seat: Seat): Suit;
  chooseDiscard(state: GameState, seat: Seat): TileIndex;
  respondToDiscard(
    state: GameState,
    seat: Seat,
    tile: TileIndex,
  ): { action: 'PONG' | 'GANG' | 'WIN' | 'PASS'; gangTile?: TileIndex };
  respondToSelfDraw(
    state: GameState,
    seat: Seat,
    drawn: TileIndex,
  ): { action: 'GANG' | 'WIN' | 'DISCARD'; gangTile?: TileIndex; kind?: 'GANG_AN' | 'GANG_BU'; discard?: TileIndex };
}
