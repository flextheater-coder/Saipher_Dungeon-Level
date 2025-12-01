import React, { useState, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { UIOverlay } from './components/UIOverlay';
import { GameStatus } from './types';
import { GAME_LEVELS } from './constants'; // Make sure we import GAME_LEVELS

export default function App() {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.MENU);
  const [playerSpeedMod, setPlayerSpeedMod] = useState<number>(1.0);
  const [levelIndex, setLevelIndex] = useState<number>(0);

  const resetGame = () => {
    setGameStatus(GameStatus.MENU);
    setLevelIndex(0);
  };

  const nextLevel = () => {
    if (levelIndex < GAME_LEVELS.length - 1) {
      setLevelIndex(prev => prev + 1);
    } else {
      // Game Complete Loop or End Screen
      setLevelIndex(0); 
    }
    // We set it to PLAYING immediately so the new canvas loads and starts
    setGameStatus(GameStatus.PLAYING);
  };

  const retryLevel = () => {
    setGameStatus(GameStatus.MENU);
    setTimeout(() => setGameStatus(GameStatus.PLAYING), 50);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none">
      <GameCanvas 
        key={levelIndex} // <--- THIS IS THE MAGIC FIX. It forces a hard reset per level.
        gameStatus={gameStatus} 
        setGameStatus={setGameStatus} 
        playerSpeedMod={playerSpeedMod}
        levelIndex={levelIndex}
      />
      <UIOverlay 
        gameStatus={gameStatus} 
        setGameStatus={setGameStatus}
        resetGame={resetGame} 
        playerSpeedMod={playerSpeedMod}
        setPlayerSpeedMod={setPlayerSpeedMod}
        onNextLevel={nextLevel}
        onRetryLevel={retryLevel}
        currentLevel={levelIndex + 1}
      />
    </div>
  );
}
