import type { PlayerState } from '@majiang/engine';

const SEAT_NAME = ['我', '下家', '对家', '上家'];

export function ScoreBoard(props: {
  players: PlayerState[];
  roundIndex: number;
  totalRounds: number;
}) {
  return (
    <div className="scoreboard">
      <span className="round-info">第 {props.roundIndex + 1} / {props.totalRounds} 局</span>
      {props.players.map((p) => (
        <span key={p.seat} className="score-item">
          {SEAT_NAME[p.seat]}: <b>{p.totalScore >= 0 ? `+${p.totalScore}` : p.totalScore}</b>
        </span>
      ))}
    </div>
  );
}
