import { TileView } from './TileView';
import { indexToTile, type TileIndex, type Suit } from '@majiang/engine';
import './HandPanel.css';

export function HandPanel(props: {
  hand: TileIndex[];
  lackSuit: Suit | null;
  selected: TileIndex | null;
  canDiscard: boolean;
  onSelect: (tile: TileIndex) => void;
}) {
  return (
    <div className="hand-panel">
      {props.hand.map((tile, i) => (
        <TileView
          key={i}
          index={tile}
          selected={props.selected === tile}
          lack={indexToTile(tile).suit === props.lackSuit}
          onClick={props.canDiscard ? () => props.onSelect(tile) : undefined}
        />
      ))}
    </div>
  );
}
