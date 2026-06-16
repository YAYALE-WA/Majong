import { indexToTile } from '@majiang/engine';
import './TileView.css';

const SUIT_LABEL: Record<string, string> = { W: '万', T: '条', B: '筒' };

export function TileView(props: {
  index: number;
  selected?: boolean;
  lack?: boolean;
  onClick?: () => void;
  back?: boolean;
}) {
  if (props.back) return <div className="tile tile-back" onClick={props.onClick} />;
  const t = indexToTile(props.index);
  const cls = [
    'tile',
    `suit-${t.suit}`,
    props.selected ? 'tile-selected' : '',
    props.lack ? 'tile-lack' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls} onClick={props.onClick}>
      <span className="tile-rank">{t.rank}</span>
      <span className="tile-suit">{SUIT_LABEL[t.suit]}</span>
    </div>
  );
}
