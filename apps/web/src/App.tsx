import { useGameStore } from './store/gameStore';
import { LobbyPage } from './pages/LobbyPage';
import { TablePage } from './pages/TablePage';
import './App.css';

export default function App() {
  const session = useGameStore((s) => s.session);
  const startGame = useGameStore((s) => s.startGame);

  return session ? <TablePage /> : <LobbyPage onStart={startGame} />;
}
