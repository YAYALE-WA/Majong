import { TileView } from './TileView';
import type { TileIndex } from '@majiang/engine';

export function DiscardPool(props: {
  discards: [TileIndex[], TileIndex[], TileIndex[], TileIndex[]];
}) {
  return (
    <div className="discard-pool">
      {props.discards.map((tiles, seat) => (
        <div key={seat} className={`discard-seat discard-seat-${seat}`}>
          {tiles.map((t, i) => <TileView key={i} index={t} />)}
        </div>
      ))}
    </div>
  );
}
