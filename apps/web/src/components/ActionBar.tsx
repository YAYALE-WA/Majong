export function ActionBar(props: {
  canPong: boolean;
  canGang: boolean;
  canWin: boolean;
  canPass: boolean;
  onPong: () => void;
  onGang: () => void;
  onWin: () => void;
  onPass: () => void;
}) {
  return (
    <div className="action-bar">
      <button onClick={props.onPong} disabled={!props.canPong}>碰</button>
      <button onClick={props.onGang} disabled={!props.canGang}>杠</button>
      <button onClick={props.onWin} disabled={!props.canWin}>胡</button>
      <button onClick={props.onPass} disabled={!props.canPass}>过</button>
    </div>
  );
}
