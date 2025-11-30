
import React, { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { UIOverlay } from './components/UIOverlay';
import { GameStatus } from './types';

export default function App() {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.PLAYING);
  // Default speed 110%
  const [playerSpeedMod, setPlayerSpeedMod] = useState<number>(1.1);

  const resetGame = () => {
    setGameStatus(GameStatus.MENU);
    // Small timeout to force re-mount/re-init of canvas logic if needed, 
    // or just state toggle to PLAYING
    setTimeout(() => setGameStatus(GameStatus.PLAYING), 10);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <GameCanvas 
        gameStatus={gameStatus} 
        setGameStatus={setGameStatus} 
        playerSpeedMod={playerSpeedMod}
      />
      <UIOverlay 
        gameStatus={gameStatus} 
        setGameStatus={setGameStatus}
        resetGame={resetGame} 
        playerSpeedMod={playerSpeedMod}
        setPlayerSpeedMod={setPlayerSpeedMod}
      />
    </div>
  );
}
