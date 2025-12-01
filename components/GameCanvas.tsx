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

let audioCtx: AudioContext | null = null;

export const GameCanvas: React.FC<GameCanvasProps> = ({ gameStatus, setGameStatus, playerSpeedMod, levelIndex }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapCacheRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number>(0);
  const frameCount = useRef<number>(0);
  
  const gameStatusRef = useRef(gameStatus);
  const playerSpeedModRef = useRef(playerSpeedMod);
  const levelIndexRef = useRef(levelIndex);

  useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);
  useEffect(() => { playerSpeedModRef.current = playerSpeedMod; }, [playerSpeedMod]);
  useEffect(() => { levelIndexRef.current = levelIndex; }, [levelIndex]);

  // --- SAFE INITIALIZATION (Prevents Crash on Load) ---
  const currentLevelData = useRef(GAME_LEVELS[0]);
  const levelGrid = useRef<number[][]>(JSON.parse(JSON.stringify(GAME_LEVELS[0].mapLayout)));
  // Initialize Fog as fully blocked (false) to prevent undefined access during Menu
  const fogGrid = useRef<boolean[][]>(Array(LEVEL_MAP_HEIGHT).fill(false).map(() => Array(LEVEL_MAP_WIDTH).fill(false)));
  
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

  const initAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  };

  const playSound = (type: string) => {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    if (!noiseBuffer.current) {
        const bufferSize = audioCtx.sampleRate * 2; 
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noiseBuffer.current = buffer;
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    // Simple sound synthesis based on type
    if (type === 'shoot') {
        osc.type = 'square'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'swing') {
        const source = audioCtx.createBufferSource();
        source.buffer = noiseBuffer.current;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass'; filter.Q.value = 0.5; filter.frequency.setValueAtTime(800, now); filter.frequency.exponentialRampToValueAtTime(100, now + 0.12);
        const gain2 = audioCtx.createGain(); gain2.gain.setValueAtTime(0.3, now); gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        source.connect(filter); filter.connect(gain2); gain2.connect(audioCtx.destination);
        source.start(now); source.stop(now + 0.15);
    } else if (type === 'hit') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(20, now + 0.2);
        gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'gem_collect') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(1200, now); osc.frequency.exponentialRampToValueAtTime(1800, now + 0.1);
        gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'powerup') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(440, now); osc.frequency.linearRampToValueAtTime(880, now + 0.3);
        gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    }
  };

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

            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            if ((x + y) % 2 === 0) ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            
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
                
                ctx.fillStyle = theme.wallColor; 
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE - wallFaceHeight);
                ctx.fillStyle = theme.wallTopColor;
                ctx.fillRect(px, py + TILE_SIZE - wallFaceHeight, TILE_SIZE, wallFaceHeight);
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.fillRect(px, py + TILE_SIZE - wallFaceHeight, TILE_SIZE, 2);
            }
        }
    }
    return canvas;
  };

  const initGame = useCallback(() => {
    const lvlIdx = Math.min(levelIndex, GAME_LEVELS.length - 1);
    currentLevelData.current = GAME_LEVELS[lvlIdx];
    
    levelGrid.current = JSON.parse(JSON.stringify(currentLevelData.current.mapLayout));
    mapCacheRef.current = renderStaticMap(currentLevelData.current.theme);
    fogGrid.current = Array(LEVEL_MAP_HEIGHT).fill(null).map(() => Array(LEVEL_MAP_WIDTH).fill(false));
    
    playerPos.current = { x: 2 * TILE_SIZE, y: 2 * TILE_SIZE };
    playerVel.current = { x: 0, y: 0 };
    
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
    
    enemies.current = [];
    const spawnRate = currentLevelData.current.enemySpawnRate;
    const allowedTypes = currentLevelData.current.enemyTypes;
    
    let enemyCount = 5 + (levelIndex * 2);
    let attempts = 0;
    
    while (enemies.current.length < enemyCount && attempts < 100) {
        const tx = Math.floor(Math.random() * LEVEL_MAP_WIDTH);
        const ty = Math.floor(Math.random() * LEVEL_MAP_HEIGHT);
        
        if (tx < 5 && ty < 5) { attempts++; continue; }
        
        if (levelGrid.current[ty][tx] === TileType.FLOOR) {
            const typeStr = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
            let eType: any = typeStr; 
            
            let hp = 3; 
            let w = 32, h = 32;
            if (eType === 'TANK') { hp = 15; w = 48; h = 48; }
            if (eType === 'TURRET') { hp = 5; }
            
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

  const hasInitialized = useRef(false);
  useEffect(() => {
      if (gameStatus === GameStatus.PLAYING && !hasInitialized.current) {
          initGame();
          hasInitialized.current = true;
      }
      if (gameStatus === GameStatus.MENU) {
          hasInitialized.current = false;
          // Force render initial map for Menu BG if desired, but kept simple here
      }
  }, [gameStatus, levelIndex, initGame]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
      }
      keysPressed.current[e.code] = true;
      initAudio(); 

      if (gameStatusRef.current === GameStatus.PLAYING) {
        if (e.code === 'KeyQ') swapCharacter();
        if (e.code === 'Space') {
            if (activeCharRef.current === CharacterType.ZAINAB) {
                triggerAttack(false);
            }
        }
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') triggerDodge();
        if (e.code === 'KeyP') setGameStatus(GameStatus.PAUSED);
      } else if (gameStatusRef.current === GameStatus.PAUSED) {
        if (e.code === 'KeyP') setGameStatus(GameStatus.PLAYING);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
      
      if (gameStatusRef.current === GameStatus.PLAYING && e.code === 'Space') {
          if (activeCharRef.current === CharacterType.ONYX) {
              const isCharged = chargeTimer.current > 30; 
              triggerAttack(isCharged);
              chargeTimer.current = 0;
          }
      }
    };
    
    const handleGameInput = (e: Event) => {
        const ce = e as CustomEvent;
        const { type, data } = ce.detail;
        initAudio(); 

        if (type === 'joystick') {
             touchJoystick.current = { x: data.x, y: data.y };
        } else if (type === 'button') {
             const { name, state } = data;
             if (name === 'ATTACK') {
                 if (state === 'down') {
                    keysPressed.current['Space'] = true;
                    if (activeCharRef.current === CharacterType.ZAINAB) triggerAttack(false);
                 } else {
                    keysPressed.current['Space'] = false;
                    if (activeCharRef.current === CharacterType.ONYX) {
                        const isCharged = chargeTimer.current > 30;
                        triggerAttack(isCharged);
                        chargeTimer.current = 0;
                    }
                 }
             }
             if (name === 'DODGE') {
                 if (state === 'down') triggerDodge();
             }
             if (name === 'SWAP') {
                 if (state === 'down') swapCharacter();
             }
             if (name === 'PAUSE') {
                 if (state === 'down') setGameStatus(prev => prev === GameStatus.PLAYING ? GameStatus.PAUSED : GameStatus.PLAYING);
             }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('game-input', handleGameInput);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('game-input', handleGameInput);
    };
  }, [setGameStatus]);

  const swapCharacter = () => {
    if (isDodging.current) return; 
    activeCharRef.current = activeCharRef.current === CharacterType.ONYX ? CharacterType.ZAINAB : CharacterType.ONYX;
    chargeTimer.current = 0; 
    screenShake.current = 5;
    playSound('powerup');
    window.dispatchEvent(new CustomEvent('hud-update', { 
        detail: { 
          char: activeCharRef.current, 
          hp: playerHealth.current, 
          maxHp: playerMaxHealth.current,
          score: score.current
        } 
    }));
  };

  const triggerAttack = (isCharged: boolean) => {
    if (attackCooldown.current > 0 || isDodging.current) return;

    const charConfig = PHYSICS[activeCharRef.current];
    isAttacking.current = true;
    
    attackType.current = isCharged ? 'CHARGED' : 'NORMAL';
    attackFrame.current = Math.floor(charConfig.attackDuration * (isCharged ? 1.5 : 1.0));
    attackCooldown.current = Math.floor(charConfig.attackCooldown * (isCharged ? 1.5 : 1.0));

    if (activeCharRef.current === CharacterType.ZAINAB) {
      playSound('shoot');
      const vel = { x: 0, y: 0 };
      const speed = 8 * playerSpeedModRef.current; 
      if (playerFacing.current === Direction.UP) vel.y = -speed;
      if (playerFacing.current === Direction.DOWN) vel.y = speed;
      if (playerFacing.current === Direction.LEFT) vel.x = -speed;
      if (playerFacing.current === Direction.RIGHT) vel.x = speed;

      projectiles.current.push({
        id: Math.random().toString(),
        pos: { x: playerPos.current.x + 10, y: playerPos.current.y + 10 },
        vel: vel,
        width: 10, height: 10, active: true, life: 60, owner: 'PLAYER', damage: charConfig.damage,
        facing: playerFacing.current, color: '#FFD700'
      });
    } else {
      if (isCharged) {
          screenShake.current = 15;
          playSound('powerup');
      } else {
          playSound('swing');
      }
    }
  };

  const triggerDodge = () => {
    if (dodgeCooldown.current > 0 || isDodging.current) return;
    isDodging.current = true;
    dodgeTimer.current = 15; 
    dodgeCooldown.current = 60;
    chargeTimer.current = 0; 
    const dodgeSpeed = 10 * playerSpeedModRef.current;
    const dir = getDirectionOffset(playerFacing.current, 1);
    playerVel.current = { x: dir.x * dodgeSpeed, y: dir.y * dodgeSpeed };
    playSound('powerup');
  };

  const getDirectionOffset = (dir: Direction, dist: number) => {
    if (dir === Direction.UP) return { x: 0, y: -dist };
    if (dir === Direction.DOWN) return { x: 0, y: dist };
    if (dir === Direction.LEFT) return { x: -dist, y: 0 };
    if (dir === Direction.RIGHT) return { x: dist, y: 0 };
    return { x: 0, y: 0 };
  };

  const checkWallCollision = (x: number, y: number, size: number) => {
      const points = [{ x: x, y: y }, { x: x + size, y: y }, { x: x, y: y + size }, { x: x + size, y: y + size }];
      for (const p of points) {
        const tx = Math.floor(p.x / TILE_SIZE);
        const ty = Math.floor(p.y / TILE_SIZE);
        if (ty < 0 || ty >= LEVEL_MAP_HEIGHT || tx < 0 || tx >= LEVEL_MAP_WIDTH) return true;
        const tile = levelGrid.current[ty][tx];
        if (activeCharRef.current === CharacterType.ZAINAB && tile === TileType.EMPTY) continue;
        if (tile === TileType.WALL || tile === TileType.EMPTY) return true;
      }
      return false;
  };

  const rectIntersect = (x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number) => {
    return x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1;
  };

  const updateCamera = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const targetX = playerPos.current.x - canvas.width / 2 + 12;
      const targetY = playerPos.current.y - canvas.height / 2 + 12;
      camera.current.x += (targetX - camera.current.x) * 0.1;
      camera.current.y += (targetY - camera.current.y) * 0.1;
      
      const maxX = Math.max(0, LEVEL_MAP_WIDTH * TILE_SIZE - canvas.width);
      const maxY = Math.max(0, LEVEL_MAP_HEIGHT * TILE_SIZE - canvas.height);
      camera.current.x = Math.max(0, Math.min(camera.current.x, maxX));
      camera.current.y = Math.max(0, Math.min(camera.current.y, maxY));
  };

  const checkTileInteraction = () => {
      const cx = playerPos.current.x + 12;
      const cy = playerPos.current.y + 12;
      const tx = Math.floor(cx / TILE_SIZE);
      const ty = Math.floor(cy / TILE_SIZE);
      
      if (ty >= 0 && ty < LEVEL_MAP_HEIGHT && tx >= 0 && tx < LEVEL_MAP_WIDTH) {
          const tile = levelGrid.current[ty][tx];
          if (tile === TileType.GOAL) {
              if (levelIndexRef.current === 8) { 
                 setGameStatus(GameStatus.SAIPHER_PRIME); 
              } else {
                 setGameStatus(GameStatus.VICTORY);
              }
              playSound('gem_collect');
          } else if (tile === TileType.HEART_CONTAINER) {
               levelGrid.current[ty][tx] = TileType.FLOOR;
               mapCacheRef.current = renderStaticMap(currentLevelData.current.theme);
               playerMaxHealth.current += 2;
               playerHealth.current = playerMaxHealth.current;
               playSound('powerup');
               window.dispatchEvent(new CustomEvent('hud-update', { 
                detail: { char: activeCharRef.current, hp: playerHealth.current, maxHp: playerMaxHealth.current, score: score.current } 
              }));
          }
      }
  };

  const takeDamage = (amount: number) => {
    if (isDodging.current || invulnTimer.current > 0 || gameStatusRef.current !== GameStatus.PLAYING) return;
    playerHealth.current = Math.max(0, playerHealth.current - amount);
    invulnTimer.current = 60; 
    screenShake.current = 5;
    playSound('hit');
    if (playerHealth.current <= 0) {
        setGameStatus(GameStatus.GAME_OVER);
    }
    window.dispatchEvent(new CustomEvent('hud-update', { 
        detail: { char: activeCharRef.current, hp: playerHealth.current, maxHp: playerMaxHealth.current, score: score.current } 
    }));
  };

  const updateFog = () => {
      const cx = Math.floor((playerPos.current.x + 12) / TILE_SIZE);
      const cy = Math.floor((playerPos.current.y + 12) / TILE_SIZE);
      const radius = 6;
      for (let y = cy - radius; y <= cy + radius; y++) {
          for (let x = cx - radius; x <= cx + radius; x++) {
              if (y >= 0 && y < LEVEL_MAP_HEIGHT && x >= 0 && x < LEVEL_MAP_WIDTH) {
                  if ((x-cx)**2 + (y-cy)**2 <= radius**2) {
                      fogGrid.current[y][x] = true;
                  }
              }
          }
      }
  };

  const updatePhysics = () => {
      if (gameStatusRef.current !== GameStatus.PLAYING) return;
      
      if (invulnTimer.current > 0) invulnTimer.current--;
      if (hitStop.current > 0) { hitStop.current--; return; }
      if (screenShake.current > 0) screenShake.current *= 0.8;

      let dx = 0, dy = 0;
      if (keysPressed.current['ArrowUp'] || keysPressed.current['KeyW']) dy = -1;
      if (keysPressed.current['ArrowDown'] || keysPressed.current['KeyS']) dy = 1;
      if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) dx = -1;
      if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) dx = 1;

      if (touchJoystick.current.x !== 0 || touchJoystick.current.y !== 0) {
          dx = touchJoystick.current.x; dy = touchJoystick.current.y;
      } else if (dx !== 0 || dy !== 0) {
          const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      }

      const stats = PHYSICS[activeCharRef.current];
      const targetSpeed = stats.maxSpeed * playerSpeedModRef.current;
      const accel = stats.moveSpeed;

      if (isDodging.current) {
          dodgeTimer.current--;
          if (dodgeTimer.current <= 0) { isDodging.current = false; playerVel.current = {x: 0, y: 0}; }
          if (frameCount.current % 3 === 0) playerGhostTrail.current.push({ x: playerPos.current.x, y: playerPos.current.y, life: 10 });
      } else {
          if (dx === 0 && dy === 0) {
              playerVel.current.x *= stats.friction; playerVel.current.y *= stats.friction;
          } else {
              playerVel.current.x += (dx * targetSpeed - playerVel.current.x) * accel;
              playerVel.current.y += (dy * targetSpeed - playerVel.current.y) * accel;
          }
      }

      const nextX = playerPos.current.x + playerVel.current.x;
      if (!checkWallCollision(nextX, playerPos.current.y, 24)) playerPos.current.x = nextX;
      else playerVel.current.x = 0;
      
      const nextY = playerPos.current.y + playerVel.current.y;
      if (!checkWallCollision(playerPos.current.x, nextY, 24)) playerPos.current.y = nextY;
      else playerVel.current.y = 0;

      if (!isDodging.current && (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1)) {
          if (Math.abs(dx) > Math.abs(dy)) playerFacing.current = dx > 0 ? Direction.RIGHT : Direction.LEFT;
          else playerFacing.current = dy > 0 ? Direction.DOWN : Direction.UP;
      }

      if (attackCooldown.current > 0) attackCooldown.current--;
      if (dodgeCooldown.current > 0) dodgeCooldown.current--;
      
      if (keysPressed.current['Space'] && activeCharRef.current === CharacterType.ONYX && !isAttacking.current && !isDodging.current) {
          chargeTimer.current++;
          if (chargeTimer.current === 30) playSound('powerup');
      } else if (!keysPressed.current['Space'] && !isAttacking.current) {
          chargeTimer.current = 0;
      }

      if (isAttacking.current) {
          attackFrame.current--;
          if (attackFrame.current <= 0) isAttacking.current = false;
          
          if (activeCharRef.current === CharacterType.ONYX) {
              const range = attackType.current === 'CHARGED' ? 60 : 40;
              const cx = playerPos.current.x + 12;
              const cy = playerPos.current.y + 12;
              
              enemies.current.forEach(e => {
                  if (!e.active || (e.hitFlash && e.hitFlash > 0)) return;
                  let hit = false;
                  if (attackType.current === 'CHARGED') {
                       if (Math.hypot((e.pos.x + e.width/2) - cx, (e.pos.y + e.height/2) - cy) < range + e.width/2) hit = true;
                  } else {
                       const ex = e.pos.x + e.width/2;
                       const ey = e.pos.y + e.height/2;
                       let rx = cx, ry = cy, rw = 0, rh = 0;
                       if (playerFacing.current === Direction.UP) { rx = cx - 20; ry = cy - range; rw = 40; rh = range; }
                       if (playerFacing.current === Direction.DOWN) { rx = cx - 20; ry = cy; rw = 40; rh = range; }
                       if (playerFacing.current === Direction.LEFT) { rx = cx - range; ry = cy - 20; rw = range; rh = 40; }
                       if (playerFacing.current === Direction.RIGHT) { rx = cx; ry = cy - 20; rw = range; rh = 40; }
                       if (rectIntersect(rx, ry, rw, rh, e.pos.x, e.pos.y, e.width, e.height)) hit = true;
                  }
                  
                  if (hit) {
                      e.health -= stats.damage * (attackType.current === 'CHARGED' ? 2 : 1);
                      e.hitFlash = 10;
                      hitStop.current = 4;
                      playSound('hit');
                      if (e.health <= 0) {
                          e.active = false;
                          score.current += 50;
                      }
                  }
              });
          }
      }

      for (let i = projectiles.current.length - 1; i >= 0; i--) {
          const p = projectiles.current[i];
          p.pos.x += p.vel.x; p.pos.y += p.vel.y; p.life--;
          if (!p.trail) p.trail = []; p.trail.push({x: p.pos.x, y: p.pos.y});
          
          if (checkWallCollision(p.pos.x, p.pos.y, p.width) || p.life <= 0) {
               p.active = false;
          } else {
              if (p.owner === 'PLAYER') {
                  for (const e of enemies.current) {
                      if (e.active && rectIntersect(p.pos.x - p.width/2, p.pos.y - p.height/2, p.width, p.height, e.pos.x, e.pos.y, e.width, e.height)) {
                          e.health -= p.damage; e.hitFlash = 10;
                          playSound('hit');
                          if (e.health <= 0) { e.active = false; score.current += 50; }
                          p.active = false; break;
                      }
                  }
              } else {
                  if (rectIntersect(p.pos.x - p.width/2, p.pos.y - p.height/2, p.width, p.height, playerPos.current.x, playerPos.current.y, 24, 24)) {
                      takeDamage(p.damage); p.active = false;
                  }
              }
          }
          if (!p.active) projectiles.current.splice(i, 1);
      }
      
      enemies.current.forEach(e => {
          if (!e.active) return;
          if (e.hitFlash && e.hitFlash > 0) e.hitFlash--;
          
          const dist = Math.hypot((playerPos.current.x) - e.pos.x, (playerPos.current.y) - e.pos.y);
          if (dist < e.agroRange) {
              if (e.type === 'TURRET') {
                  if (e.attackCooldown <= 0 && dist < 300) {
                      const ang = Math.atan2(playerPos.current.y - e.pos.y, playerPos.current.x - e.pos.x);
                      projectiles.current.push({
                          id: Math.random().toString(), pos: {x: e.pos.x + e.width/2, y: e.pos.y + e.height/2},
                          vel: {x: Math.cos(ang)*3, y: Math.sin(ang)*3}, width: 8, height: 8, active: true, life: 100, owner: 'ENEMY', damage: 1, color: '#ef4444', facing: Direction.DOWN
                      });
                      e.attackCooldown = 90;
                  }
                  if (e.attackCooldown > 0) e.attackCooldown--;
              } else {
                  const ang = Math.atan2(playerPos.current.y - e.pos.y, playerPos.current.x - e.pos.x);
                  const spd = e.type === 'DASHER' ? 2 : 1.2;
                  e.vel.x = Math.cos(ang) * spd; e.vel.y = Math.sin(ang) * spd;
                  
                  const nx = e.pos.x + e.vel.x;
                  if (!checkWallCollision(nx, e.pos.y, e.width)) e.pos.x = nx;
                  const ny = e.pos.y + e.vel.y;
                  if (!checkWallCollision(e.pos.x, ny, e.height)) e.pos.y = ny;
                  
                  if (rectIntersect(e.pos.x, e.pos.y, e.width, e.height, playerPos.current.x, playerPos.current.y, 24, 24)) takeDamage(1);
              }
          }
      });
      
      updateFog();
      updateCamera();
      checkTileInteraction();
  };

  const drawLighting = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    const theme = currentLevelData.current.theme;
    
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = theme.ambientColor;
    ctx.fillRect(0, 0, width, height);
    
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

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Safety check to prevent crash if data isn't ready
    if (!levelGrid.current || !fogGrid.current || levelGrid.current.length === 0) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0,0, canvas.width, canvas.height);
        return;
    }

    frameCount.current++;

    if (mapCacheRef.current) {
        const shakeX = (Math.random() - 0.5) * screenShake.current;
        const shakeY = (Math.random() - 0.5) * screenShake.current;
        
        ctx.fillStyle = currentLevelData.current.theme.voidColor;
        ctx.fillRect(0,0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(-camera.current.x + shakeX, -camera.current.y + shakeY);
        ctx.drawImage(mapCacheRef.current, 0, 0);
    } else {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.save();
    }

    for (let y = 0; y < LEVEL_MAP_HEIGHT; y++) {
        for (let x = 0; x < LEVEL_MAP_WIDTH; x++) {
            const tile = levelGrid.current[y][x];
            const px = x * TILE_SIZE;
            const py = y * TILE_SIZE;
            
            if (tile === TileType.GOAL) {
                if (gameStatusRef.current === GameStatus.SAIPHER_PRIME) {
                    drawSaipherPrime(ctx, px, py);
                } else {
                    const pulse = Math.sin(Date.now() / 200) * 5;
                    ctx.fillStyle = currentLevelData.current.theme.gemColor;
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = currentLevelData.current.theme.gemColor;
                    ctx.beginPath();
                    ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, 10 + pulse, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            } else if (tile === TileType.HEART_CONTAINER) {
                const t = Date.now() / 200;
                const scale = 1 + Math.sin(t) * 0.1;
                const cx = px + TILE_SIZE / 2;
                const cy = py + TILE_SIZE / 2 + 2;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.scale(scale, scale);
                ctx.fillStyle = '#ef4444';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ef4444';
                ctx.beginPath();
                const size = 8;
                ctx.moveTo(0, size); 
                ctx.bezierCurveTo(-size, 0, -size * 1.5, -size * 0.5, 0, -size * 1.2);
                ctx.bezierCurveTo(size * 1.5, -size * 0.5, size, 0, 0, size);
                ctx.fill();
                ctx.restore();
            }
        }
    }

    enemies.current.forEach(e => {
      if (!e.active) return;
      const cx = e.pos.x + e.width/2;
      const cy = e.pos.y + e.height/2;
      ctx.save();
      ctx.translate(cx, cy);
      if (e.hitFlash && e.hitFlash > 0) ctx.fillStyle = '#fff';
      else {
          if (e.type === 'CHASER') ctx.fillStyle = '#16a34a';
          if (e.type === 'TURRET') ctx.fillStyle = '#ea580c';
          if (e.type === 'DASHER') ctx.fillStyle = '#9333ea';
          if (e.type === 'SLIMER') ctx.fillStyle = '#84cc16';
          if (e.type === 'TANK') ctx.fillStyle = '#be123c';
      }
      ctx.fillRect(-e.width/2, -e.height/2, e.width, e.height);
      ctx.restore();
    });

    playerGhostTrail.current.forEach(g => {
        ctx.globalAlpha = 0.3 * (g.life / 10);
        ctx.fillStyle = PHYSICS[activeCharRef.current].color;
        ctx.beginPath(); ctx.arc(g.x + 12, g.y + 12, 12, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    const pX = playerPos.current.x;
    const pY = playerPos.current.y;
    
    ctx.fillStyle = PHYSICS[activeCharRef.current].color;
    ctx.beginPath();
    ctx.arc(pX + 12, pY + 12, 12, 0, Math.PI*2);
    ctx.fill();

    if (playerSlowTimer.current > 0) {
        ctx.strokeStyle = '#00FF00'; ctx.lineWidth = 2;
        ctx.strokeRect(pX - 4, pY - 4, 32, 32);
    }
    
    projectiles.current.forEach(p => {
      if (!p.active) return;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.width/2, 0, Math.PI * 2); ctx.fill();
    });

    floatingTexts.current.forEach(t => {
        ctx.fillStyle = t.color;
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText(t.text, t.x, t.y);
    });

    // Fog Rendering
    ctx.fillStyle = '#000000';
    for (let y = 0; y < LEVEL_MAP_HEIGHT; y++) {
        for (let x = 0; x < LEVEL_MAP_WIDTH; x++) {
            if (!fogGrid.current[y][x]) {
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE + 1, TILE_SIZE + 1);
            }
        }
    }

    ctx.restore();
    drawLighting(ctx, canvas.width, canvas.height);
    
    if (frameCount.current % 10 === 0) {
        window.dispatchEvent(new CustomEvent('minimap-update', {
            detail: {
                playerPos: playerPos.current,
                grid: levelGrid.current,
                fog: fogGrid.current
            }
        }));
    }
  };

  const tick = useCallback(() => {
    updatePhysics();
    draw();
    requestRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(tick);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [tick]);

  return (
    <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} className="block" />
  );
};
