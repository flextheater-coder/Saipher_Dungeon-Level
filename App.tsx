
import React, { useState, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { UIOverlay } from './components/UIOverlay';
import { GameStatus } from './types';
import { LEVELS } from './constants';

export default function App() {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.MENU); // Start at MENU
  const [playerSpeedMod, setPlayerSpeedMod] = useState<number>(1.0);
  const [levelIndex, setLevelIndex] = useState<number>(0);

  const resetGame = () => {
    setGameStatus(GameStatus.MENU);
    setLevelIndex(0);
  };

  const nextLevel = () => {
    if (levelIndex < LEVELS.length - 1) {
      setLevelIndex(prev => prev + 1);
    } else {
      setLevelIndex(0); // Loop back or handle end game
    }
    setGameStatus(GameStatus.PLAYING);
  };

  const retryLevel = () => {
    setGameStatus(GameStatus.MENU);
    // Short timeout to ensure full reset of canvas state
    setTimeout(() => setGameStatus(GameStatus.PLAYING), 50);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none">
      <GameCanvas 
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
