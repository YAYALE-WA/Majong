import type { PlayerState } from '@majiang/engine';

const SEAT_NAME = ['我', '下家', '对家', '上家'];

export function RoundResultPanel(props: {
  players: PlayerState[];
  isGameEnd: boolean;
  onNext: () => void;
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-box result-box">
        <h3>{props.isGameEnd ? '全局结束 · 总排名' : '本局结算'}</h3>
        <table className="result-table">
          <thead>
            <tr><th>玩家</th><th>胡牌</th><th>本局得分</th><th>累计</th></tr>
          </thead>
          <tbody>
            {props.players.map((p) => (
              <tr key={p.seat}>
                <td>{SEAT_NAME[p.seat]}</td>
                <td>{p.winRecord ? p.winRecord.fan.basePattern : (p.hasLeft ? '胡' : '—')}</td>
                <td className={p.roundScore >= 0 ? 'pos' : 'neg'}>
                  {p.roundScore >= 0 ? `+${p.roundScore}` : p.roundScore}
                </td>
                <td>{p.totalScore + p.roundScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="next-btn" onClick={props.onNext}>
          {props.isGameEnd ? '查看' : '下一局'}
        </button>
      </div>
    </div>
  );
}
