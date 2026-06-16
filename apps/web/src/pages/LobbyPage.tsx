import { useState } from 'react';
import type { GameConfig } from '@majiang/engine';

export function LobbyPage(props: { onStart: (cfg: GameConfig) => void }) {
  const [baseScore, setBaseScore] = useState(1);
  const [capFan, setCapFan] = useState<number | null>(7);
  const [totalRounds, setTotalRounds] = useState(8);
  const [enableQiangGang, setQiang] = useState(true);
  const [enableTuiShui, setTui] = useState(true);

  return (
    <div className="lobby">
      <h1>四川麻将 · 血战到底</h1>
      <div className="lobby-form">
        <label>
          底分
          <select value={baseScore} onChange={(e) => setBaseScore(Number(e.target.value))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={5}>5</option>
          </select>
        </label>
        <label>
          封顶番数
          <select
            value={capFan === null ? 'none' : capFan}
            onChange={(e) => setCapFan(e.target.value === 'none' ? null : Number(e.target.value))}
          >
            <option value={5}>5 番</option>
            <option value={7}>7 番</option>
            <option value={10}>10 番</option>
            <option value="none">不封顶</option>
          </select>
        </label>
        <label>
          总局数
          <select value={totalRounds} onChange={(e) => setTotalRounds(Number(e.target.value))}>
            <option value={4}>4</option>
            <option value={8}>8</option>
            <option value={16}>16</option>
          </select>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={enableQiangGang} onChange={(e) => setQiang(e.target.checked)} />
          抢杠胡
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={enableTuiShui} onChange={(e) => setTui(e.target.checked)} />
          退税
        </label>
        <button
          className="start-btn"
          onClick={() => props.onStart({ baseScore, capFan, totalRounds, enableQiangGang, enableTuiShui })}
        >
          开始游戏
        </button>
      </div>
    </div>
  );
}
