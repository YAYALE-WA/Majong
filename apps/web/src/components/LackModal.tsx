import type { Suit } from '@majiang/engine';

const SUITS: { suit: Suit; label: string }[] = [
  { suit: 'W', label: '万' },
  { suit: 'T', label: '条' },
  { suit: 'B', label: '筒' },
];

export function LackModal(props: { onChoose: (suit: Suit) => void }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>请定缺</h3>
        <p>选择一门花色作为缺门（必须打完才能胡）</p>
        <div className="lack-buttons">
          {SUITS.map(({ suit, label }) => (
            <button key={suit} className={`lack-btn suit-${suit}`} onClick={() => props.onChoose(suit)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
