import { TileView } from './TileView';
import type { Meld } from '@majiang/engine';

/** 渲染一组副露（碰/杠）。暗杠用牌背 + 2 张明示表达。 */
export function MeldsView(props: { melds: Meld[] }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {props.melds.map((m, i) => {
        const count = m.kind === 'PONG' ? 3 : 4;
        const isAn = m.kind === 'GANG_AN';
        return (
          <div key={i} style={{ display: 'flex', transform: 'scale(.7)', transformOrigin: 'left' }}>
            {Array.from({ length: count }).map((_, k) => (
              <TileView key={k} index={m.tile} back={isAn && (k === 0 || k === count - 1)} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
