import { useEffect } from 'react';
import { useGameStore, HUMAN, countsToTiles } from '../store/gameStore';
import { SeatPanel } from '../components/SeatPanel';
import { DiscardPool } from '../components/DiscardPool';
import { HandPanel } from '../components/HandPanel';
import { ActionBar } from '../components/ActionBar';
import { LackModal } from '../components/LackModal';
import { RoundResultPanel } from '../components/RoundResultPanel';
import { ScoreBoard } from '../components/ScoreBoard';
import type { TileIndex } from '@majiang/engine';

export function TablePage() {
  const session = useGameStore((s) => s.session);
  const state = useGameStore((s) => s.state);
  const selectedTile = useGameStore((s) => s.selectedTile);
  const chooseLackHuman = useGameStore((s) => s.chooseLackHuman);
  const selectTile = useGameStore((s) => s.selectTile);
  const discardHuman = useGameStore((s) => s.discardHuman);
  const humanRespond = useGameStore((s) => s.humanRespond);
  const nextRound = useGameStore((s) => s.nextRound);
  const tick = useGameStore((s) => s.tick);

  // 进入 PLAYING 后启动调度（处理 AI 起手回合）
  useEffect(() => {
    if (state?.phase === 'PLAYING') tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase]);

  if (!session || !state) return null;

  const me = state.players[HUMAN]!;
  const myHand = countsToTiles(me.hand);

  // 人类是否需要定缺
  const needLack = state.phase === 'CHOOSE_LACK' && me.lackSuit === null;

  // 人类待响应（别家弃牌）
  const humanPendingResponse =
    state.phase === 'PLAYING' && state.pendingResponses.includes(HUMAN) && state.lastDiscard !== null;
  const discardTile = state.lastDiscard?.tile;
  const canPong = humanPendingResponse && discardTile !== undefined && session.canPongOn(HUMAN, discardTile);
  const canGangResp = humanPendingResponse && discardTile !== undefined && session.canGangOn(HUMAN, discardTile);
  const canWinResp = humanPendingResponse && discardTile !== undefined && session.canWinOn(HUMAN, discardTile);

  // 人类出牌回合（轮到自己且无待响应）
  const myTurnToDiscard =
    state.phase === 'PLAYING' && state.turn === HUMAN && state.pendingResponses.length === 0 && !me.hasLeft;
  // 自摸/暗杠/补杠机会
  const canZimo = myTurnToDiscard && session.canWinSelf(HUMAN);
  const anGangTiles = myTurnToDiscard ? session.canAnGang(HUMAN) : [];
  const buGangTiles = myTurnToDiscard ? session.canBuGang(HUMAN) : [];
  const canSelfGang = anGangTiles.length > 0 || buGangTiles.length > 0;

  const onSelectTile = (t: TileIndex) => {
    if (!myTurnToDiscard) return;
    if (selectedTile === t) discardHuman(t); // 再次点击同一张 = 打出
    else selectTile(t);
  };

  const onGangClick = () => {
    if (humanPendingResponse) {
      humanRespond('GANG');
    } else if (anGangTiles.length > 0) {
      session.gang(HUMAN, anGangTiles[0]!, 'GANG_AN');
      useGameStore.getState().sync();
      setTimeout(() => useGameStore.getState().tick(), 0);
    } else if (buGangTiles.length > 0) {
      session.gang(HUMAN, buGangTiles[0]!, 'GANG_BU');
      useGameStore.getState().sync();
      setTimeout(() => useGameStore.getState().tick(), 0);
    }
  };

  const onWinClick = () => {
    if (humanPendingResponse) humanRespond('WIN');
    else if (canZimo) {
      session.winSelf(HUMAN);
      useGameStore.getState().sync();
      setTimeout(() => useGameStore.getState().tick(), 0);
    }
  };

  const handCount = (seat: number) => {
    const p = state.players[seat]!;
    return p.hand.reduce((a, b) => a + b, 0);
  };

  const discards: [TileIndex[], TileIndex[], TileIndex[], TileIndex[]] = [
    state.players[0]!.discards,
    state.players[1]!.discards,
    state.players[2]!.discards,
    state.players[3]!.discards,
  ];

  const roundEnd = state.phase === 'ROUND_END' || state.phase === 'GAME_END';

  return (
    <div className="table-page">
      <ScoreBoard players={state.players} roundIndex={state.roundIndex} totalRounds={state.config.totalRounds} />

      <div className="seats-top">
        <SeatPanel player={state.players[2]!} isCurrent={state.turn === 2} handCount={handCount(2)} />
      </div>
      <div className="seats-mid">
        <SeatPanel player={state.players[3]!} isCurrent={state.turn === 3} handCount={handCount(3)} />
        <DiscardPool discards={discards} />
        <SeatPanel player={state.players[1]!} isCurrent={state.turn === 1} handCount={handCount(1)} />
      </div>

      <div className="my-area">
        <div className="my-info">
          <SeatPanel player={me} isCurrent={state.turn === 0} handCount={0} />
          <span className="wall-info">牌墙剩余 {state.wall.length}</span>
        </div>
        <HandPanel
          hand={myHand}
          lackSuit={me.lackSuit}
          selected={selectedTile}
          canDiscard={myTurnToDiscard}
          onSelect={onSelectTile}
        />
        <ActionBar
          canPong={!!canPong}
          canGang={!!canGangResp || canSelfGang}
          canWin={!!canWinResp || canZimo}
          canPass={humanPendingResponse}
          onPong={() => humanRespond('PONG')}
          onGang={onGangClick}
          onWin={onWinClick}
          onPass={() => humanRespond('PASS')}
        />
      </div>

      {needLack && <LackModal onChoose={chooseLackHuman} />}
      {roundEnd && (
        <RoundResultPanel
          players={state.players}
          isGameEnd={state.phase === 'GAME_END'}
          onNext={nextRound}
        />
      )}
    </div>
  );
}
