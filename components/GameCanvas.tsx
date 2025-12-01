import React, { useEffect, useRef, useCallback } from 'react';
import { CharacterType, TileType, GameStatus, Projectile, Particle, Enemy, Vector2, Direction, Pickup, LevelTheme } from '../types';
import { PHYSICS, TILE_SIZE, LEVEL_MAP_WIDTH, LEVEL_MAP_HEIGHT, GAME_LEVELS } from '../constants';

interface GameCanvasProps {
  gameStatus: GameStatus;
  setGameStatus: (status: GameStatus | ((prev: GameStatus) => GameStatus)) => void;
  playerSpeedMod: number;
  levelIndex: number;
}

interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  velY: number;
}

interface ExtendedParticle extends Particle {
    type?: 'DEFAULT' | 'SPARK' | 'SHOCKWAVE' | 'CHARGE' | 'SLASH' | 'RING';
    rotation?: number;
}

// ... Audio context code remains the same ...
let audioCtx: AudioContext | null = null;

export const GameCanvas: React.FC<GameCanvasProps> = ({ gameStatus, setGameStatus, playerSpeedMod, levelIndex }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapCacheRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number>(0);
  const frameCount = useRef<number>(0);
  
  const gameStatusRef = useRef(gameStatus);
  const playerSpeedModRef = useRef(playerSpeedMod);
  const levelIndexRef = useRef(levelIndex);
  
  // Audio functions (initAudio, playSound) remain the same... 
  // [Insert previous audio code here or assume it persists]

  // Game State Refs
  const currentLevelData = useRef(GAME_LEVELS[0]);
  const levelGrid = useRef<number[][]>([]);
  const fogGrid = useRef<boolean[][]>([]);
  
  // ... other refs (activeChar, playerPos, etc) remain same ...
  const activeCharRef = useRef<CharacterType>(CharacterType.ONYX);
  const playerPos = useRef<Vector2>({ x: 100, y: 100 });
  const playerVel = useRef<Vector2>({ x: 0, y: 0 });
  const playerFacing = useRef<Direction>(Direction.DOWN);
  const playerHealth = useRef<number>(10);
  const playerMaxHealth = useRef<number>(10);
  const score = useRef<number>(0);
  
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const touchJoystick = useRef<Vector2>({ x: 0, y: 0 });
  
  const playerSpeedMultiplier = useRef<number>(1.0);
  const playerSlowTimer = useRef<number>(0);
  
  const projectiles = useRef<Projectile[]>([]);
  const particles = useRef<ExtendedParticle[]>([]);
  const pickups = useRef<Pickup[]>([]);
  const floatingTexts = useRef<FloatingText[]>([]);
  const enemies = useRef<Enemy[]>([]);
  const camera = useRef<Vector2>({ x: 0, y: 0 });
  const screenShake = useRef<number>(0);
  
  const attackCooldown = useRef<number>(0);
  const isAttacking = useRef<boolean>(false);
  const attackType = useRef<'NORMAL' | 'CHARGED'>('NORMAL');
  const attackFrame = useRef<number>(0); 
  const chargeTimer = useRef<number>(0);

  const isDodging = useRef<boolean>(false);
  const dodgeTimer = useRef<number>(0);
  const dodgeCooldown = useRef<number>(0);
  const playerGhostTrail = useRef<{x: number, y: number, life: number}[]>([]);

  const hitStop = useRef<number>(0);
  const noiseBuffer = useRef<AudioBuffer | null>(null);
  const invulnTimer = useRef<number>(0);

  // ... Insert initAudio and playSound functions here ...
  const initAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  };
  
  const playSound = (type: string) => { /* ... reuse previous implementation ... */ };

  // --- DYNAMIC MAP RENDERING ---
  const renderStaticMap = (theme: LevelTheme) => {
    const canvas = document.createElement('canvas');
    canvas.width = LEVEL_MAP_WIDTH * TILE_SIZE;
    canvas.height = LEVEL_MAP_HEIGHT * TILE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = theme.voidColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < LEVEL_MAP_HEIGHT; y++) {
        for (let x = 0; x < LEVEL_MAP_WIDTH; x++) {
          const tile = levelGrid.current[y][x];
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;
  
          if (tile === TileType.FLOOR || tile === TileType.HEART_CONTAINER || tile === TileType.GOAL) {
            ctx.fillStyle = theme.floorColor; 
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

            // Texture
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            if ((x + y) % 2 === 0) ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            
            // Random specks
            const seed = (x * 37 + y * 13) % 100;
            if (seed > 80) {
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(px + (seed%20), py + (seed%15), 4, 4);
            }
            
            ctx.strokeStyle = theme.wallColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
          }
        }
    }

    // Walls (2.5D Effect)
    for (let y = 0; y < LEVEL_MAP_HEIGHT; y++) {
        for (let x = 0; x < LEVEL_MAP_WIDTH; x++) {
            const tile = levelGrid.current[y][x];
            const px = x * TILE_SIZE;
            const py = y * TILE_SIZE;

            if (tile === TileType.WALL) {
                const wallFaceHeight = 20; 
                if (y < LEVEL_MAP_HEIGHT - 1 && levelGrid.current[y+1][x] !== TileType.WALL) {
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.fillRect(px, py + TILE_SIZE, TILE_SIZE, 16);
                }
                
                // Front Face
                ctx.fillStyle = theme.wallColor; 
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE - wallFaceHeight);
                
                // Top Face
                ctx.fillStyle = theme.wallTopColor;
                ctx.fillRect(px, py + TILE_SIZE - wallFaceHeight, TILE_SIZE, wallFaceHeight);

                // Lighting on walls
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.fillRect(px, py + TILE_SIZE - wallFaceHeight, TILE_SIZE, 2);
            }
        }
    }
    return canvas;
  };

  // --- INITIALIZE LEVEL ---
  const initGame = useCallback(() => {
    const lvlIdx = Math.min(levelIndex, GAME_LEVELS.length - 1);
    currentLevelData.current = GAME_LEVELS[lvlIdx];
    
    // Clone grid so we can modify it (hearts, etc)
    levelGrid.current = JSON.parse(JSON.stringify(currentLevelData.current.mapLayout));
    
    mapCacheRef.current = renderStaticMap(currentLevelData.current.theme);
    fogGrid.current = Array(LEVEL_MAP_HEIGHT).fill(null).map(() => Array(LEVEL_MAP_WIDTH).fill(false));
    
    playerPos.current = { x: 2 * TILE_SIZE, y: 2 * TILE_SIZE };
    playerVel.current = { x: 0, y: 0 };
    
    // Reset core stats if new run, otherwise keep health? For now reset health for simplicity or keep it?
    // Let's keep health between levels to make it harder, but heal slightly
    if (levelIndex === 0) {
        playerHealth.current = 10;
        playerMaxHealth.current = 10;
        score.current = 0;
        activeCharRef.current = CharacterType.ONYX;
    } else {
        playerHealth.current = Math.min(playerHealth.current + 4, playerMaxHealth.current);
    }
    
    projectiles.current = [];
    particles.current = [];
    pickups.current = [];
    floatingTexts.current = [];
    playerGhostTrail.current = [];
    
    // Procedural Enemy Spawning based on Config
    enemies.current = [];
    const spawnRate = currentLevelData.current.enemySpawnRate;
    const allowedTypes = currentLevelData.current.enemyTypes;
    
    // Basic spawning algorithm: Find empty floors, spawn enemies away from player
    let enemyCount = 5 + (levelIndex * 2);
    let attempts = 0;
    
    while (enemies.current.length < enemyCount && attempts < 100) {
        const tx = Math.floor(Math.random() * LEVEL_MAP_WIDTH);
        const ty = Math.floor(Math.random() * LEVEL_MAP_HEIGHT);
        
        // Don't spawn near start
        if (tx < 5 && ty < 5) { attempts++; continue; }
        
        if (levelGrid.current[ty][tx] === TileType.FLOOR) {
            const typeStr = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
            let eType: any = typeStr; // Cast for TS
            
            let hp = 3; 
            let w = 32, h = 32;
            if (eType === 'TANK') { hp = 15; w = 48; h = 48; }
            if (eType === 'TURRET') { hp = 5; }
            
            // Buff enemies in later levels
            hp = Math.floor(hp * spawnRate);

            enemies.current.push({
                id: `e_${attempts}`,
                pos: { x: tx * TILE_SIZE, y: ty * TILE_SIZE },
                vel: { x: 0, y: 0 },
                width: w, height: h,
                active: true,
                health: hp,
                maxHealth: hp,
                agroRange: 300 * spawnRate,
                type: eType,
                facing: Direction.DOWN,
                attackCooldown: 0
            });
        }
        attempts++;
    }
    
    // Level Start Text
    floatingTexts.current.push({
        id: 'start_txt',
        x: playerPos.current.x,
        y: playerPos.current.y - 40,
        text: currentLevelData.current.theme.name,
        color: currentLevelData.current.theme.gemColor,
        life: 180,
        velY: -0.2
    });

    window.dispatchEvent(new CustomEvent('hud-update', { 
        detail: { 
          char: activeCharRef.current, 
          hp: playerHealth.current, 
          maxHp: playerMaxHealth.current,
          score: score.current
        } 
    }));
  }, [levelIndex]);

  // ... [Keep existing useEffects for Input handling] ...

  // ... [Keep existing checkTileInteraction, but update GOAL check] ...
  const checkTileInteraction = () => {
      const cx = playerPos.current.x + 12;
      const cy = playerPos.current.y + 12;
      const tx = Math.floor(cx / TILE_SIZE);
      const ty = Math.floor(cy / TILE_SIZE);
      
      if (ty >= 0 && ty < LEVEL_MAP_HEIGHT && tx >= 0 && tx < LEVEL_MAP_WIDTH) {
          const tile = levelGrid.current[ty][tx];
          if (tile === TileType.GOAL) {
              if (levelIndexRef.current === 8) { // Finished Level 9 (Index 8)
                 setGameStatus(GameStatus.SAIPHER_PRIME); // Trigger God Mode Ending
              } else {
                 setGameStatus(GameStatus.VICTORY);
              }
              playSound('gem_collect');
          } 
          // ... existing Heart Container logic ...
      }
  };

  // ... [Keep existing updatePhysics, damageEnemy, takeDamage logic] ...

  // --- DRAW LIGHTING WITH THEME ---
  const drawLighting = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    const theme = currentLevelData.current.theme;
    
    // Global Ambient Overlay based on Theme
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = theme.ambientColor;
    ctx.fillRect(0, 0, width, height);
    
    // Vignette
    ctx.globalCompositeOperation = 'source-over';
    const screenX = playerPos.current.x - camera.current.x + 16;
    const screenY = playerPos.current.y - camera.current.y + 16;
    
    const grad = ctx.createRadialGradient(screenX, screenY, 120, screenX, screenY, 550);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  // --- DRAW SAIPHER PRIME EFFECT ---
  const drawSaipherPrime = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      const time = Date.now() / 200;
      const colors = ['#ff0000', '#ffa500', '#ffff00', '#008000', '#0000ff', '#4b0082', '#ee82ee'];
      
      for(let i=0; i<3; i++) {
          ctx.beginPath();
          ctx.arc(x + 16, y + 16, 30 + (Math.sin(time + i)*5), 0, Math.PI*2);
          ctx.strokeStyle = colors[(Math.floor(time) + i) % colors.length];
          ctx.lineWidth = 2;
          ctx.stroke();
      }
  }

  // ... [Update draw function to use drawSaipherPrime if needed] ...
  
  // Update the GOAL drawing in draw() to use gemColor
  // Inside draw():
  // ...
  // if (tile === TileType.GOAL) {
  //    ctx.fillStyle = currentLevelData.current.theme.gemColor;
  //    ...
  // }

  return (
    <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} className="block" />
  );
};
