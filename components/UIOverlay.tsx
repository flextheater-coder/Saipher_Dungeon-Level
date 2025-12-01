import React, { useEffect, useState, useRef } from 'react';
import { CharacterType, GameStatus } from '../types';
import { PHYSICS, TILE_SIZE, LEVEL_MAP_WIDTH, LEVEL_MAP_HEIGHT } from '../constants';
import { Skull, Trophy, Pause, Diamond, Heart, Sword, Wind, Repeat, Play, Home, ArrowRight } from 'lucide-react';

interface UIOverlayProps {
  gameStatus: GameStatus;
  setGameStatus: (status: GameStatus) => void;
  resetGame: () => void;
  playerSpeedMod: number;
  setPlayerSpeedMod: (speed: number) => void;
  onNextLevel: () => void;
  onRetryLevel: () => void;
  currentLevel: number;
}

const Joystick = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const knobRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(false);
    const startPos = useRef({ x: 0, y: 0 });
    const radius = 40;

    const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        startPos.current = { x: clientX, y: clientY };
        setActive(true);
    };

    useEffect(() => {
        const handleMove = (e: TouchEvent | MouseEvent) => {
            if (!active) return;
            const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
            
            const dx = clientX - startPos.current.x;
            const dy = clientY - startPos.current.y;
            const dist = Math.hypot(dx, dy);
            
            let nx = dx;
            let ny = dy;

            if (dist > radius) {
                const ratio = radius / dist;
                nx = dx * ratio;
                ny = dy * ratio;
            }

            if (knobRef.current) {
                knobRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
            }

            // Dispatch normalized vector
            const inputX = nx / radius;
            const inputY = ny / radius;
            
            window.dispatchEvent(new CustomEvent('game-input', {
                detail: { type: 'joystick', data: { x: inputX, y: inputY } }
            }));
        };

        const handleEnd = () => {
            if (!active) return;
            setActive(false);
            if (knobRef.current) {
                knobRef.current.style.transform = `translate(0px, 0px)`;
            }
            window.dispatchEvent(new CustomEvent('game-input', {
                detail: { type: 'joystick', data: { x: 0, y: 0 } }
            }));
        };

        if (active) {
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleEnd);
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
        }

        return () => {
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
        };
    }, [active]);

    return (
        <div 
            ref={containerRef}
            className="relative w-24 h-24 bg-slate-800/50 rounded-full border-2 border-slate-600 backdrop-blur-sm touch-none"
            onTouchStart={handleStart}
            onMouseDown={handleStart}
        >
            <div 
                ref={knobRef}
                className="absolute top-1/2 left-1/2 w-10 h-10 bg-slate-200/80 rounded-full -ml-5 -mt-5 shadow-lg pointer-events-none"
            />
        </div>
    );
};

const ActionButton = ({ icon: Icon, name, color }: { icon: any, name: string, color: string }) => {
    const handleDown = (e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('game-input', {
            detail: { type: 'button', data: { name, state: 'down' } }
        }));
    };
    const handleUp = (e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('game-input', {
            detail: { type: 'button', data: { name, state: 'up' } }
        }));
    };

    return (
        <button
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform border-2 border-white/20 touch-none select-none ${color}`}
            onTouchStart={handleDown}
            onTouchEnd={handleUp}
            onMouseDown={handleDown}
            onMouseUp={handleUp}
        >
            <Icon className="w-8 h-8 text-white" />
        </button>
    );
};

const MinimapCanvas = ({ data }: { data: any }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !data) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const { playerPos, grid, fog } = data;
        const cw = canvas.width;
        const ch = canvas.height;
        const cellW = cw / LEVEL_MAP_WIDTH;
        const cellH = ch / LEVEL_MAP_HEIGHT;
        
        ctx.clearRect(0, 0, cw, ch);
        
        // Draw grid
        for (let y = 0; y < LEVEL_MAP_HEIGHT; y++) {
            for (let x = 0; x < LEVEL_MAP_WIDTH; x++) {
                if (fog[y][x]) {
                     const tile = grid[y][x];
                     if (tile === 0) ctx.fillStyle = '#020617'; // Pit
                     else if (tile === 2) ctx.fillStyle = '#475569'; // Wall
                     else if (tile === 9) ctx.fillStyle = '#00FFFF'; // Goal
                     else ctx.fillStyle = '#334155'; // Floor
                     
                     ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
                }
            }
        }
        
        // Draw Player
        const px = (playerPos.x / (LEVEL_MAP_WIDTH * TILE_SIZE)) * cw;
        const py = (playerPos.y / (LEVEL_MAP_HEIGHT * TILE_SIZE)) * ch;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI*2);
        ctx.fill();

    }, [data]);

    return <canvas ref={canvasRef} width={150} height={100} className="w-full h-full opacity-90" />;
};

export const UIOverlay: React.FC<UIOverlayProps> = ({ 
    gameStatus, 
    setGameStatus, 
    resetGame, 
    playerSpeedMod, 
    setPlayerSpeedMod,
    onNextLevel,
    onRetryLevel,
    currentLevel
}) => {
  const [hudState, setHudState] = useState<{char: CharacterType, hp: number, maxHp: number, score: number}>({
      char: CharacterType.ONYX,
      hp: 10,
      maxHp: 10,
      score: 0
  });

  const [minimapData, setMinimapData] = useState<{playerPos: {x:number, y:number}, grid: number[][], fog: boolean[][]} | null>(null);

  useEffect(() => {
      const handleHudUpdate = (e: Event) => {
          const ce = e as CustomEvent;
          setHudState(ce.detail);
      };
      const handleMinimapUpdate = (e: Event) => {
          const ce = e as CustomEvent;
          setMinimapData(ce.detail);
      }
      window.addEventListener('hud-update', handleHudUpdate);
      window.addEventListener('minimap-update', handleMinimapUpdate);
      return () => {
          window.removeEventListener('hud-update', handleHudUpdate);
          window.removeEventListener('minimap-update', handleMinimapUpdate);
      }
  }, []);

  const renderHearts = () => {
      const hearts = [];
      const maxHearts = Math.max(5, Math.ceil(hudState.maxHp / 2));
      const isLowHealth = hudState.hp <= hudState.maxHp * 0.3;

      for (let i = 0; i < maxHearts; i++) {
          const heartValue = (i + 1) * 2;
          let fillState = 'EMPTY'; 
          if (hudState.hp >= heartValue) fillState = 'FULL';
          else if (hudState.hp >= heartValue - 1) fillState = 'HALF';

          hearts.push(
              <div key={i} className={`relative w-6 h-6 ${isLowHealth && 'animate-pulse'}`}>
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#450a0a" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="absolute inset-0 w-full h-full"
                >
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="#1f2937" stroke="none" opacity="0.5"/>
                </svg>
                
                <div className="absolute inset-0 overflow-hidden" style={{ width: fillState === 'FULL' ? '100%' : fillState === 'HALF' ? '50%' : '0%' }}>
                     <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 24 24" 
                        fill="#ef4444" 
                        stroke="#ef4444" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className="w-full h-full drop-shadow-md"
                    >
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                </div>
              </div>
          );
      }
      return hearts;
  };

  const togglePause = () => {
      if (gameStatus === GameStatus.PLAYING) setGameStatus(GameStatus.PAUSED);
      else if (gameStatus === GameStatus.PAUSED) setGameStatus(GameStatus.PLAYING);
  };

  if (gameStatus === GameStatus.MENU) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 text-white font-sans">
            <div className="text-center space-y-6 max-w-lg p-8 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl animate-in zoom-in-95 duration-300">
                <h1 className="text-5xl font-black text-yellow-400 tracking-widest drop-shadow-lg">SAIPHER</h1>
                <p className="text-slate-300 text-lg">Switch forms. Conquer the depths.</p>
                
                <div className="grid grid-cols-2 gap-4 text-left bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-yellow-400 font-bold"><Diamond size={16} /> ZAINAB (Gold)</div>
                        <p className="text-xs text-slate-400">Ranged attacks. Floaty movement. Flies over pits.</p>
                    </div>
                     <div className="space-y-2">
                        <div className="flex items-center gap-2 text-red-500 font-bold"><Sword size={16} /> ONYX (Red)</div>
                        <p className="text-xs text-slate-400">Melee attacks. Snappy movement. Charge attack (Hold Space).</p>
                    </div>
                </div>

                <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500 font-mono">
                     <span>WASD: Move</span>
                     <span>SPACE: Attack</span>
                     <span>Q: Swap</span>
                     <span>SHIFT: Dodge</span>
                </div>

                <button 
                    onClick={() => setGameStatus(GameStatus.PLAYING)}
                    className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-lg text-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg shadow-yellow-500/20"
                >
                    <Play size={28} className="fill-black" /> START GAME
                </button>
            </div>
        </div>
      );
  }

  if (gameStatus === GameStatus.GAME_OVER) {
      return (
          <div className="absolute inset-0 flex items-center justify-center bg-red-950/90 z-50 text-white animate-in fade-in duration-500">
            <div className="text-center space-y-6 p-10 bg-slate-900 border-2 border-red-600 rounded-xl shadow-2xl max-w-md w-full">
                <div className="inline-block p-4 bg-red-900/30 rounded-full mb-2">
                    <Skull className="w-16 h-16 text-red-500" />
                </div>
                <h2 className="text-5xl font-black text-red-500 tracking-tighter">DEFEAT</h2>
                <div className="bg-slate-800/50 p-4 rounded-lg">
                    <p className="text-slate-400 text-sm uppercase tracking-widest mb-1">Final Score</p>
                    <p className="text-4xl font-mono text-yellow-400">{hudState.score}</p>
                </div>
                <button 
                    onClick={onRetryLevel}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white font-bold rounded-lg text-lg transition-all flex items-center justify-center gap-2"
                >
                    <Repeat size={20} /> TRY AGAIN
                </button>
                <button onClick={resetGame} className="text-sm text-slate-500 hover:text-white">MAIN MENU</button>
            </div>
        </div>
      );
  }

  if (gameStatus === GameStatus.VICTORY) {
      return (
          <div className="absolute inset-0 flex items-center justify-center bg-yellow-950/90 z-50 text-white animate-in fade-in duration-500">
            <div className="text-center space-y-6 p-10 bg-slate-900 border-2 border-yellow-500 rounded-xl shadow-2xl max-w-md w-full">
                <div className="inline-block p-4 bg-yellow-900/30 rounded-full mb-2">
                    <Trophy className="w-16 h-16 text-yellow-400" />
                </div>
                <h2 className="text-5xl font-black text-yellow-400 tracking-tighter">VICTORY</h2>
                <p className="text-slate-300">Level {currentLevel} Complete!</p>
                 <div className="bg-slate-800/50 p-4 rounded-lg">
                    <p className="text-slate-400 text-sm uppercase tracking-widest mb-1">Total Gems</p>
                    <p className="text-4xl font-mono text-yellow-400">{hudState.score}</p>
                </div>
                <button 
                    onClick={onNextLevel}
                    className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg text-lg transition-all flex items-center justify-center gap-2"
                >
                    <ArrowRight size={20} /> NEXT LEVEL
                </button>
                <button onClick={resetGame} className="text-sm text-slate-500 hover:text-white">MAIN MENU</button>
            </div>
        </div>
      );
  }

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 md:p-4 z-40 overflow-hidden">
        {/* HUD TOP */}
        <div className="flex justify-between items-start pointer-events-auto w-full">
            <div className="flex flex-col gap-2">
                {/* Health Bar */}
                <div className="flex items-center gap-1 p-2 bg-slate-900/90 rounded-lg backdrop-blur border border-slate-700/50 shadow-lg">
                    {renderHearts()}
                </div>
                {/* Active Character */}
                <div className="flex items-center gap-2 p-2 bg-slate-900/90 rounded-lg backdrop-blur border border-slate-700/50 text-white w-fit shadow-lg transition-colors duration-300"
                     style={{ borderColor: hudState.char === CharacterType.ONYX ? '#ef4444' : '#eab308' }}>
                     <div className={`w-2 h-2 rounded-full animate-pulse ${hudState.char === CharacterType.ONYX ? 'bg-red-500' : 'bg-yellow-400'}`} />
                     <span className="font-bold font-mono text-sm">{hudState.char}</span>
                </div>
            </div>

            <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-4">
                    {/* Score */}
                    <div className="flex items-center gap-2 p-2 px-3 bg-slate-900/90 rounded-lg backdrop-blur border border-slate-700/50 text-yellow-400 shadow-lg">
                        <Diamond size={16} className="fill-yellow-400" />
                        <span className="font-bold font-mono text-xl">{hudState.score.toString().padStart(5, '0')}</span>
                    </div>
                    {/* Pause Button */}
                     <button 
                        onClick={togglePause}
                        className="p-2 bg-slate-800 rounded-full text-white border border-slate-600 hover:bg-slate-700 active:scale-95 shadow-lg"
                    >
                        <Pause size={20} />
                    </button>
                </div>
                
                {/* Minimap */}
                <div className="w-36 h-24 bg-slate-950/90 border border-slate-700 rounded overflow-hidden mt-1 hidden md:block shadow-xl">
                     <MinimapCanvas data={minimapData} />
                </div>
            </div>
        </div>

        {/* PAUSE OVERLAY */}
        {gameStatus === GameStatus.PAUSED && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto animate-in fade-in z-50">
                <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center">
                    <h2 className="text-4xl font-black mb-2 tracking-widest text-yellow-400">PAUSED</h2>
                    
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-8 mt-6">
                        <label className="flex flex-col gap-3 cursor-pointer group">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                    <Wind size={16} /> GAME SPEED
                                </span>
                                <span className="font-mono font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded text-sm">
                                    {Math.round(playerSpeedMod * 100)}%
                                </span>
                            </div>
                            <input 
                                type="range" 
                                min="0.5" 
                                max="1.5" 
                                step="0.05" 
                                value={playerSpeedMod} 
                                onChange={(e) => setPlayerSpeedMod(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 hover:accent-yellow-400"
                            />
                        </label>
                    </div>

                    <div className="space-y-3">
                        <button 
                            onClick={() => setGameStatus(GameStatus.PLAYING)}
                            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg text-lg transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20"
                        >
                            <Play size={20} className="fill-black" /> RESUME
                        </button>
                        <button 
                             onClick={() => { if(confirm("Quit to Main Menu?")) resetGame(); }}
                             className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                        >
                            <Home size={18} /> QUIT
                        </button>
                    </div>
                </div>
             </div>
        )}

        {/* MOBILE CONTROLS */}
        <div className="pointer-events-auto md:hidden flex justify-between items-end pb-6 px-2 w-full select-none">
             <div className="pl-2 pb-2">
                <Joystick />
             </div>
             
             <div className="flex gap-3 items-end pr-2 pb-2">
                 <div className="flex flex-col gap-3">
                    <ActionButton name="SWAP" icon={Repeat} color="bg-blue-600 active:bg-blue-500" />
                    <ActionButton name="DODGE" icon={Wind} color="bg-slate-600 active:bg-slate-500" />
                 </div>
                 <ActionButton name="ATTACK" icon={Sword} color="bg-red-600 active:bg-red-500 scale-110" />
             </div>
        </div>
    </div>
  );
};