import React, { useEffect, useState, useRef } from 'react';
import { CharacterType, GameStatus } from '../types';
import { PHYSICS, TILE_SIZE, LEVEL_MAP_WIDTH, LEVEL_MAP_HEIGHT } from '../constants';
import { Skull, Trophy, Pause, Diamond, Heart, Sword, Wind, Repeat, Play } from 'lucide-react';

interface UIOverlayProps {
  gameStatus: GameStatus;
  setGameStatus: (status: GameStatus) => void;
  resetGame: () => void;
  playerSpeedMod: number;
  setPlayerSpeedMod: (speed: number) => void;
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
                // Only draw discovered tiles (fog = true means discovered in GameCanvas logic)
                if (fog[y][x]) {
                     const tile = grid[y][x];
                     if (tile === 0) ctx.fillStyle = '#020617'; // Pit
                     else if (tile === 2) ctx.fillStyle = '#475569'; // Wall
                     else if (tile === 9) ctx.fillStyle = '#00FFFF'; // Goal
                     else ctx.fillStyle = '#334155'; // Floor
                     
                     ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
                }
            }
        }
        
        // Draw Player
        const px = (playerPos.x / (LEVEL_MAP_WIDTH * TILE_SIZE)) * cw;
        const py = (playerPos.y / (LEVEL_MAP_HEIGHT * TILE_SIZE)) * ch;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI*2);
        ctx.fill();

    }, [data]);

    return <canvas ref={canvasRef} width={120} height={80} className="w-full h-full opacity-80" />;
};

export const UIOverlay: React.FC<UIOverlayProps> = ({ gameStatus, setGameStatus, resetGame, playerSpeedMod, setPlayerSpeedMod }) => {
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
      
      for (let i = 0; i < maxHearts; i++) {
          // Each heart represents 2 HP
          const hpForThisHeart = Math.max(0, Math.min(2, hudState.hp - (i * 2)));
          
          hearts.push(
              <div key={i} className="relative w-6 h-6">
                {/* Background (Empty) */}
                <Heart className="w-6 h-6 text-slate-700 absolute inset-0" />
                
                {/* Full or Partial Fill */}
                {hpForThisHeart > 0 && (
                    <div className="absolute inset-0 overflow-hidden" style={{ width: hpForThisHeart === 2 ? '100%' : '50%' }}>
                         <Heart className="w-6 h-6 text-red-500 fill-red-500" />
                    </div>
                )}
              </div>
          );
      }
      return hearts;
  };

  const togglePause = () => {
       window.dispatchEvent(new CustomEvent('game-input', {
            detail: { type: 'button', data: { name: 'PAUSE', state: 'down' } }
       }));
  };

  if (gameStatus === GameStatus.MENU) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 text-white font-sans">
            <div className="text-center space-y-6 max-w-lg p-8 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
                <h1 className="text-4xl md:text-6xl font-black text-yellow-400 tracking-widest drop-shadow-lg">DUNGEON<br/>DUALITY</h1>
                <p className="text-slate-300 text-lg">Master two forms to conquer the depths.</p>
                
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

                <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-400">
                     <div className="bg-slate-800 px-3 py-1 rounded border border-slate-700">WASD / Arrows <span className="text-slate-500">Move</span></div>
                     <div className="bg-slate-800 px-3 py-1 rounded border border-slate-700">SPACE <span className="text-slate-500">Attack</span></div>
                     <div className="bg-slate-800 px-3 py-1 rounded border border-slate-700">Q <span className="text-slate-500">Swap</span></div>
                     <div className="bg-slate-800 px-3 py-1 rounded border border-slate-700">SHIFT <span className="text-slate-500">Dodge</span></div>
                </div>

                 <div className="flex flex-col items-center gap-2 pt-4 border-t border-slate-800">
                   <label className="flex items-center gap-4 cursor-pointer select-none group">
                      <span className="text-sm font-bold text-slate-400 group-hover:text-white transition-colors">GAME SPEED</span>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="1.5" 
                        step="0.1" 
                        value={playerSpeedMod} 
                        onChange={(e) => setPlayerSpeedMod(parseFloat(e.target.value))}
                        className="w-32 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                      />
                      <span className="w-12 text-right font-mono text-yellow-400">{Math.round(playerSpeedMod * 100)}%</span>
                   </label>
                </div>

                <button 
                    onClick={() => setGameStatus(GameStatus.PLAYING)}
                    className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-lg text-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg shadow-yellow-500/20"
                >
                    <Play size={28} className="fill-black" /> ENTER DUNGEON
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
                    onClick={resetGame}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white font-bold rounded-lg text-lg transition-all flex items-center justify-center gap-2"
                >
                    <Repeat size={20} /> TRY AGAIN
                </button>
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
                <p className="text-slate-300">You have conquered the dungeon!</p>
                 <div className="bg-slate-800/50 p-4 rounded-lg">
                    <p className="text-slate-400 text-sm uppercase tracking-widest mb-1">Final Score</p>
                    <p className="text-4xl font-mono text-yellow-400">{hudState.score}</p>
                </div>
                <button 
                    onClick={resetGame}
                    className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg text-lg transition-all flex items-center justify-center gap-2"
                >
                    <Repeat size={20} /> PLAY AGAIN
                </button>
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
                <div className="flex items-center gap-1 p-2 bg-slate-900/80 rounded-lg backdrop-blur border border-slate-700/50 shadow-lg">
                    {renderHearts()}
                </div>
                {/* Active Character */}
                <div className="flex items-center gap-2 p-2 bg-slate-900/80 rounded-lg backdrop-blur border border-slate-700/50 text-white w-fit shadow-lg transition-colors duration-300"
                     style={{ borderColor: hudState.char === CharacterType.ONYX ? '#ef4444' : '#eab308' }}>
                     <div className={`w-2 h-2 rounded-full animate-pulse ${hudState.char === CharacterType.ONYX ? 'bg-red-500' : 'bg-yellow-400'}`} />
                     <span className="font-bold font-mono text-sm">{hudState.char}</span>
                </div>
            </div>

            <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-4">
                    {/* Score */}
                    <div className="flex items-center gap-2 p-2 px-3 bg-slate-900/80 rounded-lg backdrop-blur border border-slate-700/50 text-yellow-400 shadow-lg">
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
             <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px] pointer-events-auto animate-in fade-in">
                <div className="text-white text-center">
                    <h2 className="text-4xl font-bold mb-6 tracking-widest">PAUSED</h2>
                    <button 
                        onClick={() => setGameStatus(GameStatus.PLAYING)}
                        className="px-8 py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-transform hover:scale-105"
                    >
                        RESUME
                    </button>
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
        
        {/* Desktop Hints */}
        <div className="hidden md:block text-white/30 text-xs font-mono text-center pb-1">
            WASD Move • SPACE Attack • Q Swap • SHIFT Dodge
        </div>
    </div>
  );
};
