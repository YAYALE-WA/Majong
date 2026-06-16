import { TileView } from './TileView';
import { MeldsView } from './MeldsView';
import type { PlayerState } from '@majiang/engine';

const SEAT_NAME = ['我', '下家', '对家', '上家'];
const SUIT_LABEL: Record<string, string> = { W: '万', T: '条', B: '筒' };

export function SeatPanel(props: {
  player: PlayerState;
  isCurrent: boolean;
  handCount: number; // 暗牌张数（AI 显示牌背）
}) {
  const p = props.player;
  return (
    <div className={`seat-panel ${props.isCurrent ? 'seat-current' : ''} ${p.hasLeft ? 'seat-left' : ''}`}>
      <div className="seat-head">
        <span className="seat-name">{SEAT_NAME[p.seat]}</span>
        {p.lackSuit && <span className="seat-lack">缺{SUIT_LABEL[p.lackSuit]}</span>}
        {p.hasLeft && <span className="seat-won">已胡</span>}
        <span className="seat-score">{p.totalScore >= 0 ? `+${p.totalScore}` : p.totalScore}</span>
      </div>
      <MeldsView melds={p.melds} />
      <div className="seat-hand-back">
        {Array.from({ length: props.handCount }).map((_, i) => (
          <TileView key={i} index={0} back />
        ))}
      </div>
    </div>
  );
}
