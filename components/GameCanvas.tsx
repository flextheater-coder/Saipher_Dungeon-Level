import React, { useEffect, useRef, useCallback } from 'react';
import { CharacterType, TileType, GameStatus, Projectile, Particle, Enemy, Vector2, Direction, Pickup } from '../types';
import { PHYSICS, TILE_SIZE, LEVEL_MAP_WIDTH, LEVEL_MAP_HEIGHT, LEVEL_DATA } from '../constants';

interface GameCanvasProps {
  gameStatus: GameStatus;
  setGameStatus: (status: GameStatus | ((prev: GameStatus) => GameStatus)) => void;
  playerSpeedMod: number;
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

// Extended Particle Interface for internal use
interface ExtendedParticle extends Particle {
    type?: 'DEFAULT' | 'SPARK' | 'SHOCKWAVE' | 'CHARGE' | 'SLASH' | 'RING';
    rotation?: number;
    scale?: number;
}

// Audio Context (Singleton pattern for the component life)
let audioCtx: AudioContext | null = null;

export const GameCanvas: React.FC<GameCanvasProps> = ({ gameStatus, setGameStatus, playerSpeedMod }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapCacheRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number>(0);
  const frameCount = useRef<number>(0);
  
  // Refs for props to avoid stale closures in game loop
  const gameStatusRef = useRef(gameStatus);
  const playerSpeedModRef = useRef(playerSpeedMod);

  useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);
  useEffect(() => { playerSpeedModRef.current = playerSpeedMod; }, [playerSpeedMod]);

  // Game State Refs
  const levelGrid = useRef<number[][]>(JSON.parse(JSON.stringify(LEVEL_DATA)));
  const fogGrid = useRef<boolean[][]>(Array(LEVEL_MAP_HEIGHT).fill(null).map(() => Array(LEVEL_MAP_WIDTH).fill(false)));
  
  const activeCharRef = useRef<CharacterType>(CharacterType.ONYX);
  const playerPos = useRef<Vector2>({ x: 100, y: 100 });
  const playerVel = useRef<Vector2>({ x: 0, y: 0 });
  const playerFacing = useRef<Direction>(Direction.DOWN);
  const playerHealth = useRef<number>(10);
  const playerMaxHealth = useRef<number>(10);
  const score = useRef<number>(0);
  
  // Input Refs
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const touchJoystick = useRef<Vector2>({ x: 0, y: 0 });
  
  // Debuff States
  const playerSpeedMultiplier = useRef<number>(1.0);
  const playerSlowTimer = useRef<number>(0);
  
  const projectiles = useRef<Projectile[]>([]);
  const particles = useRef<ExtendedParticle[]>([]);
  const pickups = useRef<Pickup[]>([]);
  const floatingTexts = useRef<FloatingText[]>([]);
  const enemies = useRef<Enemy[]>([]);
  const camera = useRef<Vector2>({ x: 0, y: 0 });
  const screenShake = useRef<number>(0);
  
  // Action States
  const attackCooldown = useRef<number>(0);
  const isAttacking = useRef<boolean>(false);
  const attackType = useRef<'NORMAL' | 'CHARGED'>('NORMAL');
  const attackFrame = useRef<number>(0); 
  const chargeTimer = useRef<number>(0);

  // Dodge States
  const isDodging = useRef<boolean>(false);
  const dodgeTimer = useRef<number>(0);
  const dodgeCooldown = useRef<number>(0);
  const playerGhostTrail = useRef<{x: number, y: number, life: number}[]>([]);

  // Physics/Feel Enhancements
  const hitStop = useRef<number>(0);
  const noiseBuffer = useRef<AudioBuffer | null>(null);

  // --- AUDIO SYSTEM ---
  const initAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  };

  const playSound = (type: 'shoot' | 'swing' | 'hit' | 'powerup' | 'enemy_hit' | 'dodge' | 'clash' | 'game_over' | 'gem_collect' | 'charge_ready' | 'charge_release') => {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // Lazy Init Noise Buffer for Swing sounds
    if (!noiseBuffer.current) {
        const bufferSize = audioCtx.sampleRate * 2; // 2 seconds buffer
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
             data[i] = Math.random() * 2 - 1;
        }
        noiseBuffer.current = buffer;
    }

    if (type === 'shoot') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);

    } else if (type === 'swing') {
        const source = audioCtx.createBufferSource();
        source.buffer = noiseBuffer.current;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 0.5;
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.12);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        source.start(now);
        source.stop(now + 0.15);

    } else if (type === 'charge_ready') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);

    } else if (type === 'charge_release') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(80, now);
        osc2.frequency.exponentialRampToValueAtTime(10, now + 0.4);
        gain2.gain.setValueAtTime(0.3, now);
        gain2.gain.linearRampToValueAtTime(0, now + 0.4);
        osc2.start(now);
        osc2.stop(now + 0.4);

    } else if (type === 'clash') {
         const osc = audioCtx.createOscillator();
         osc.type = 'triangle';
         osc.frequency.setValueAtTime(300, now); 
         osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
         const mod = audioCtx.createOscillator();
         mod.type = 'square';
         mod.frequency.setValueAtTime(643, now); 
         const modGain = audioCtx.createGain();
         modGain.gain.setValueAtTime(1500, now);
         modGain.gain.exponentialRampToValueAtTime(10, now + 0.15);
         mod.connect(modGain);
         modGain.connect(osc.frequency);
         const gain = audioCtx.createGain();
         gain.gain.setValueAtTime(0.25, now);
         gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
         osc.connect(gain);
         gain.connect(audioCtx.destination);
         osc.start(now);
         osc.stop(now + 0.25);
         mod.start(now);
         mod.stop(now + 0.25);

    } else if (type === 'hit') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);

    } else if (type === 'enemy_hit') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);

    } else if (type === 'powerup') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now); 
        osc.frequency.setValueAtTime(1108, now + 0.06); 
        osc.frequency.setValueAtTime(1318, now + 0.12); 
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.25); 
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);

    } else if (type === 'gem_collect') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);

    } else if (type === 'dodge') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(200, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'game_over') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 1.5); 
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 1.5);
        osc.start(now);
        osc.stop(now + 1.5);
    }
  };

  const renderStaticMap = () => {
    const canvas = document.createElement('canvas');
    canvas.width = LEVEL_MAP_WIDTH * TILE_SIZE;
    canvas.height = LEVEL_MAP_HEIGHT * TILE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Clear with transparency (void/pits will be transparent)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < LEVEL_MAP_HEIGHT; y++) {
        for (let x = 0; x < LEVEL_MAP_WIDTH; x++) {
          const tile = levelGrid.current[y][x];
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;
  
          if (tile === TileType.FLOOR || tile === TileType.HEART_CONTAINER || tile === TileType.GOAL) {
            // Base floor color
            ctx.fillStyle = '#1e293b'; 
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

            // Subtle texture noise
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            if ((x + y) % 2 === 0) ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            
            // Random varied details for "depth"
            const seed = (x * 37 + y * 13) % 100;
            if (seed > 80) {
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(px + (seed%20), py + (seed%15), 4, 4);
            }
            
            // Fake AO on edges of floor tiles
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
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

                // Shadow below wall
                if (y < LEVEL_MAP_HEIGHT - 1 && levelGrid.current[y+1][x] !== TileType.WALL) {
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.fillRect(px, py + TILE_SIZE, TILE_SIZE, 16);
                }
                
                // Top of Wall (Roof)
                ctx.fillStyle = '#334155';
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE - wallFaceHeight);
                // Top Highlight
                ctx.fillStyle = '#475569';
                ctx.fillRect(px, py, TILE_SIZE, 2);
                ctx.fillRect(px, py, 2, TILE_SIZE - wallFaceHeight);

                // Front Face
                const faceY = py + TILE_SIZE - wallFaceHeight;
                
                // Gradient for face (depth/lighting)
                const grad = ctx.createLinearGradient(px, faceY, px, faceY + wallFaceHeight);
                grad.addColorStop(0, '#334155');
                grad.addColorStop(1, '#0f172a');
                ctx.fillStyle = grad;
                ctx.fillRect(px, faceY, TILE_SIZE, wallFaceHeight);

                // Texture: Vertical streaks (wetness/weathering)
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                if ((x + y) % 3 === 0) ctx.fillRect(px + 8, faceY, 4, wallFaceHeight);
                if ((x * y) % 4 === 0) ctx.fillRect(px + 24, faceY, 2, wallFaceHeight);
                
                // Top edge highlight of the front face
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(px, faceY, TILE_SIZE, 1);
                
                // Side definition
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                ctx.fillRect(px, faceY, 1, wallFaceHeight);
                ctx.fillRect(px + TILE_SIZE - 1, faceY, 1, wallFaceHeight);
            }
        }
    }
    return canvas;
  };

  const initGame = useCallback(() => {
    levelGrid.current = JSON.parse(JSON.stringify(LEVEL_DATA));
    mapCacheRef.current = renderStaticMap();
    fogGrid.current = Array(LEVEL_MAP_HEIGHT).fill(null).map(() => Array(LEVEL_MAP_WIDTH).fill(false));
    
    playerPos.current = { x: 2 * TILE_SIZE, y: 2 * TILE_SIZE };
    playerVel.current = { x: 0, y: 0 };
    activeCharRef.current = CharacterType.ONYX;
    playerMaxHealth.current = 10;
    playerHealth.current = 10;
    playerSpeedMultiplier.current = 1.0;
    playerSlowTimer.current = 0;
    hitStop.current = 0;
    frameCount.current = 0;
    score.current = 0;
    chargeTimer.current = 0;
    screenShake.current = 0;
    
    projectiles.current = [];
    particles.current = [];
    pickups.current = [];
    floatingTexts.current = [];
    playerGhostTrail.current = [];
    
    enemies.current = [
      { id: 'e1', pos: { x: 12 * TILE_SIZE, y: 3 * TILE_SIZE }, vel: { x: 0, y: 0 }, width: 32, height: 32, active: true, health: 3, maxHealth: 3, agroRange: 300, type: 'CHASER', facing: Direction.DOWN, attackCooldown: 0 },
      { id: 'e2', pos: { x: 20 * TILE_SIZE, y: 7 * TILE_SIZE }, vel: { x: 0, y: 0 }, width: 32, height: 32, active: true, health: 3, maxHealth: 3, agroRange: 300, type: 'CHASER', facing: Direction.DOWN, attackCooldown: 0 },
      { id: 'd1', pos: { x: 5 * TILE_SIZE, y: 14 * TILE_SIZE }, vel: { x: 0, y: 0 }, width: 32, height: 32, active: true, health: 2, maxHealth: 2, agroRange: 400, type: 'DASHER', facing: Direction.DOWN, attackCooldown: 0 },
      { id: 'd2', pos: { x: 8 * TILE_SIZE, y: 16 * TILE_SIZE }, vel: { x: 0, y: 0 }, width: 32, height: 32, active: true, health: 2, maxHealth: 2, agroRange: 400, type: 'DASHER', facing: Direction.UP, attackCooldown: 0 },
      { id: 's1', pos: { x: 5 * TILE_SIZE, y: 10 * TILE_SIZE }, vel: { x: 0, y: 0 }, width: 28, height: 28, active: true, health: 2, maxHealth: 2, agroRange: 300, type: 'SLIMER', facing: Direction.DOWN, attackCooldown: 0 },
      { id: 's2', pos: { x: 25 * TILE_SIZE, y: 2 * TILE_SIZE }, vel: { x: 0, y: 0 }, width: 28, height: 28, active: true, health: 2, maxHealth: 2, agroRange: 300, type: 'SLIMER', facing: Direction.DOWN, attackCooldown: 0 },
      { id: 't1', pos: { x: 24 * TILE_SIZE, y: 14 * TILE_SIZE }, vel: { x: 0, y: 0 }, width: 32, height: 32, active: true, health: 4, maxHealth: 4, agroRange: 450, type: 'TURRET', facing: Direction.LEFT, attackCooldown: 60 },
      { id: 't2', pos: { x: 8 * TILE_SIZE, y: 5 * TILE_SIZE }, vel: { x: 0, y: 0 }, width: 32, height: 32, active: true, health: 4, maxHealth: 4, agroRange: 450, type: 'TURRET', facing: Direction.DOWN, attackCooldown: 30 },
      { id: 'tk1', pos: { x: 13 * TILE_SIZE, y: 14 * TILE_SIZE }, vel: { x: 0, y: 0 }, width: 48, height: 48, active: true, health: 15, maxHealth: 15, agroRange: 200, type: 'TANK', facing: Direction.DOWN, attackCooldown: 0 },
      { id: 'e3', pos: { x: 15 * TILE_SIZE, y: 15 * TILE_SIZE }, vel: { x: 0, y: 0 }, width: 40, height: 40, active: true, health: 10, maxHealth: 10, agroRange: 500, type: 'CHASER', facing: Direction.DOWN, attackCooldown: 0 },
    ];
    window.dispatchEvent(new CustomEvent('hud-update', { 
        detail: { 
          char: activeCharRef.current, 
          hp: playerHealth.current, 
          maxHp: playerMaxHealth.current,
          score: score.current
        } 
    }));
  }, []);

  const hasInitialized = useRef(false);
  useEffect(() => {
      if (gameStatus === GameStatus.PLAYING && !hasInitialized.current) {
          initGame();
          hasInitialized.current = true;
      }
      if (gameStatus === GameStatus.MENU) {
          hasInitialized.current = false;
      }
  }, [gameStatus, initGame]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      initAudio(); 
      keysPressed.current[e.code] = true;

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
    
    // Custom Input Event Listener for Touch Controls
    const handleGameInput = (e: Event) => {
        const ce = e as CustomEvent;
        const { type, data } = ce.detail;
        initAudio(); // Ensure audio context is active on touch

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
                 if (state === 'down') {
                     triggerDodge();
                 }
             }
             if (name === 'SWAP') {
                 if (state === 'down') swapCharacter();
             }
             if (name === 'PAUSE') {
                 if (state === 'down') {
                     setGameStatus(prev => prev === GameStatus.PLAYING ? GameStatus.PAUSED : GameStatus.PLAYING);
                 }
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
    createExplosion(playerPos.current.x, playerPos.current.y, PHYSICS[activeCharRef.current].color, 10);
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
    const durationMult = isCharged ? 1.5 : 1.0;
    attackFrame.current = Math.floor(charConfig.attackDuration * durationMult);
    attackCooldown.current = Math.floor(charConfig.attackCooldown * (isCharged ? 1.5 : 1.0));

    if (activeCharRef.current === CharacterType.ZAINAB) {
      playSound('shoot');
      const vel = { x: 0, y: 0 };
      const speed = 8; 
      if (playerFacing.current === Direction.UP) vel.y = -speed;
      if (playerFacing.current === Direction.DOWN) vel.y = speed;
      if (playerFacing.current === Direction.LEFT) vel.x = -speed;
      if (playerFacing.current === Direction.RIGHT) vel.x = speed;

      projectiles.current.push({
        id: Math.random().toString(),
        pos: { x: playerPos.current.x + 10, y: playerPos.current.y + 10 },
        vel: vel,
        width: 10,
        height: 10,
        active: true,
        life: 60,
        owner: 'PLAYER',
        damage: charConfig.damage,
        facing: playerFacing.current,
        color: '#FFD700',
        trail: []
      });
    } else {
      if (isCharged) {
          playSound('charge_release');
          screenShake.current = 15;
          createShockwave(playerPos.current.x + 12, playerPos.current.y + 12, '#FF4500');
          createExplosion(playerPos.current.x + 12, playerPos.current.y + 12, '#FF4500', 20);
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
    
    const dodgeSpeed = 10; 
    const dir = getDirectionOffset(playerFacing.current, 1);
    playerVel.current = { x: dir.x * dodgeSpeed, y: dir.y * dodgeSpeed };
    
    playSound('dodge');
    screenShake.current = 3;
    createShockwave(playerPos.current.x + 12, playerPos.current.y + 12, '#FFFFFF');
    createExplosion(playerPos.current.x + 12, playerPos.current.y + 12, '#FFFFFF', 8);
  };

  const getDirectionOffset = (dir: Direction, dist: number) => {
    if (dir === Direction.UP) return { x: 0, y: -dist };
    if (dir === Direction.DOWN) return { x: 0, y: dist };
    if (dir === Direction.LEFT) return { x: -dist, y: 0 };
    if (dir === Direction.RIGHT) return { x: dist, y: 0 };
    return { x: 0, y: 0 };
  };

  const createExplosion = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        id: Math.random().toString(),
        pos: { x, y },
        vel: { x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5 },
        width: 4,
        height: 4,
        active: true,
        life: 20 + Math.random() * 10,
        maxLife: 30,
        facing: Direction.DOWN,
        color: color,
        type: 'DEFAULT'
      });
    }
  };

  const createSlashImpact = (x: number, y: number, color: string) => {
      const angle = Math.random() * Math.PI * 2;
      // Slash line particle
      particles.current.push({
          id: Math.random().toString(),
          pos: { x, y },
          vel: { x: 0, y: 0 },
          width: 40,
          height: 2,
          active: true,
          life: 12,
          maxLife: 12,
          color: '#FFFFFF',
          type: 'SLASH',
          rotation: angle
      });
      // Cross slash
       particles.current.push({
          id: Math.random().toString(),
          pos: { x, y },
          vel: { x: 0, y: 0 },
          width: 30,
          height: 2,
          active: true,
          life: 8,
          maxLife: 8,
          color: color,
          type: 'SLASH',
          rotation: angle + Math.PI/2
      });
      // Ring expanding
      particles.current.push({
          id: Math.random().toString(),
          pos: { x, y },
          vel: { x: 0, y: 0 },
          width: 10, 
          height: 10,
          active: true,
          life: 15,
          maxLife: 15,
          color: color,
          type: 'RING'
      });

      createSparks(x, y, color, 8);
  };

  const createImpactEffect = (x: number, y: number, color: string) => {
      // Central Burst
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5;
        particles.current.push({
          id: Math.random().toString(),
          pos: { x, y },
          vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          width: 4 + Math.random() * 4, 
          height: 2, 
          active: true,
          life: 15 + Math.random() * 10,
          maxLife: 25,
          color: color,
          facing: Direction.DOWN,
          type: 'SPARK',
          rotation: angle
        });
      }
      // Rings
      particles.current.push({
          id: Math.random().toString(),
          pos: { x, y },
          vel: { x: 0, y: 0 },
          width: 5,
          height: 5,
          active: true,
          life: 12,
          maxLife: 12,
          color: '#FFFFFF',
          facing: Direction.DOWN,
          type: 'RING'
      });
       particles.current.push({
          id: Math.random().toString(),
          pos: { x, y },
          vel: { x: 0, y: 0 },
          width: 15,
          height: 15,
          active: true,
          life: 20,
          maxLife: 20,
          color: color,
          facing: Direction.DOWN,
          type: 'SHOCKWAVE'
      });
  };

  const createPickupEffect = (x: number, y: number) => {
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24;
      const speed = 2.5 + Math.random();
      particles.current.push({
        id: Math.random().toString(),
        pos: { x, y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        width: 3,
        height: 3,
        active: true,
        life: 50,
        maxLife: 50,
        facing: Direction.DOWN,
        color: '#FFD700',
        type: 'DEFAULT'
      });
    }
     for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2;
      particles.current.push({
        id: Math.random().toString(),
        pos: { x, y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        width: 2,
        height: 2,
        active: true,
        life: 30,
        maxLife: 30,
        facing: Direction.DOWN,
        color: '#FFFFFF',
        type: 'DEFAULT'
      });
    }
  };

  const createShockwave = (x: number, y: number, color: string) => {
      particles.current.push({
        id: Math.random().toString(),
        pos: { x, y },
        vel: { x: 0, y: 0 },
        width: 10,
        height: 10,
        active: true,
        life: 10,
        maxLife: 10,
        facing: Direction.DOWN,
        color: color,
        type: 'SHOCKWAVE'
      });
  };

  const createSparks = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        id: Math.random().toString(),
        pos: { x, y },
        vel: { x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8 }, 
        width: 2,
        height: 2,
        active: true,
        life: 10 + Math.random() * 5,
        maxLife: 15,
        facing: Direction.DOWN,
        color: color,
        type: 'DEFAULT'
      });
    }
  };

  const createGem = (x: number, y: number) => {
     const angle = Math.random() * Math.PI * 2;
     const speed = 2;
     pickups.current.push({
        id: Math.random().toString(),
        pos: { x, y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        width: 12,
        height: 12,
        active: true,
        facing: Direction.DOWN,
        type: 'GEM',
        value: 10,
        life: 600, 
        collected: false
     });
  };

  const damageEnemy = (e: Enemy, dmg: number) => {
    e.health -= dmg;
    e.hitFlash = 10;
    hitStop.current = 4; // Small hitstop for crunch
    playSound('enemy_hit');
    
    if (e.health <= 0) {
      e.active = false;
      hitStop.current = 8; // Longer hitstop on kill
      createExplosion(e.pos.x + 16, e.pos.y + 16, '#00FF00', 15);
      createGem(e.pos.x + e.width/2 - 6, e.pos.y + e.height/2 - 6);
    }
  };

  const rectIntersect = (x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number) => {
    return x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1;
  };

  const checkWallCollision = (x: number, y: number, size: number) => {
      const points = [
        { x: x, y: y },
        { x: x + size, y: y },
        { x: x, y: y + size },
        { x: x + size, y: y + size }
      ];
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

  const checkTileInteraction = () => {
      const cx = playerPos.current.x + 12;
      const cy = playerPos.current.y + 12;
      const tx = Math.floor(cx / TILE_SIZE);
      const ty = Math.floor(cy / TILE_SIZE);
      
      if (ty >= 0 && ty < LEVEL_MAP_HEIGHT && tx >= 0 && tx < LEVEL_MAP_WIDTH) {
          const tile = levelGrid.current[ty][tx];
          if (tile === TileType.GOAL) {
              setGameStatus(GameStatus.VICTORY);
              playSound('gem_collect');
          } else if (tile === TileType.HEART_CONTAINER) {
               levelGrid.current[ty][tx] = TileType.FLOOR;
               mapCacheRef.current = renderStaticMap();
               playerMaxHealth.current += 2;
               playerHealth.current = playerMaxHealth.current;
               playSound('powerup');
               floatingTexts.current.push({
                   id: Math.random().toString(),
                   x: cx, y: cy - 20,
                   text: "MAX HP UP!",
                   color: "#ef4444",
                   life: 60,
                   velY: -0.5
               });
               window.dispatchEvent(new CustomEvent('hud-update', { 
                detail: { 
                  char: activeCharRef.current, 
                  hp: playerHealth.current, 
                  maxHp: playerMaxHealth.current,
                  score: score.current
                } 
              }));
          }
      }
  };

  const updateCamera = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const targetX = playerPos.current.x - canvas.width / 2 + 12;
      const targetY = playerPos.current.y - canvas.height / 2 + 12;
      camera.current.x += (targetX - camera.current.x) * 0.1;
      camera.current.y += (targetY - camera.current.y) * 0.1;
      
      // Bounds check
      const maxX = Math.max(0, LEVEL_MAP_WIDTH * TILE_SIZE - canvas.width);
      const maxY = Math.max(0, LEVEL_MAP_HEIGHT * TILE_SIZE - canvas.height);
      camera.current.x = Math.max(0, Math.min(camera.current.x, maxX));
      camera.current.y = Math.max(0, Math.min(camera.current.y, maxY));
  };

  const drawBipedalEnemy = (ctx: CanvasRenderingContext2D, e: Enemy, time: number) => {
      const isMoving = Math.abs(e.vel.x) > 0.1 || Math.abs(e.vel.y) > 0.1;
      const bounce = isMoving ? Math.sin(time / 100 + parseInt(e.id.replace(/\D/g, '') || '0')) * 2 : 0;
      const breathe = Math.sin(time / 300) * 1;
      
      ctx.save();
      // Color palettes & Config
      let skinColor = '#65a30d'; // Default Goblin Green
      let armorColor = '#78350f'; // Leather
      let scale = 1;
      let weaponType: 'SWORD' | 'BOW' | 'HAMMER' | 'DAGGER' = 'SWORD';

      if (e.type === 'CHASER') {
          skinColor = '#65a30d'; // Green
          armorColor = '#a16207'; // Brown
          weaponType = 'SWORD';
      } else if (e.type === 'TURRET') {
          skinColor = '#84cc16'; // Lighter Green
          armorColor = '#1e293b'; // Dark robes
          weaponType = 'BOW';
      } else if (e.type === 'DASHER') {
          skinColor = '#581c87'; // Purple skin
          armorColor = '#0f172a'; // Black ninja suit
          weaponType = 'DAGGER';
      } else if (e.type === 'TANK') {
          skinColor = '#9f1239'; // Red Orc
          armorColor = '#334155'; // Iron armor
          scale = 1.4;
          weaponType = 'HAMMER';
      }

      const cx = e.pos.x + e.width/2;
      const cy = e.pos.y + e.height/2;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(0, bounce);

      // Legs
      ctx.fillStyle = '#171717';
      if (isMoving) {
          const walk = Math.sin(time / 80) * 4;
          ctx.fillRect(-5 + walk, 6, 3, 4);
          ctx.fillRect(2 - walk, 6, 3, 4);
      } else {
          ctx.fillRect(-5, 6, 3, 4);
          ctx.fillRect(2, 6, 3, 4);
      }

      // Body
      ctx.fillStyle = armorColor;
      ctx.beginPath();
      ctx.roundRect(-7, -4, 14, 12, 2);
      ctx.fill();

      // Detail on armor
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(-5, -2, 3, 8);

      // Head Group
      ctx.translate(0, breathe - 1);
      
      // Ears
      ctx.fillStyle = skinColor;
      // Left Ear
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(-12, -6);
      ctx.lineTo(-6, -1);
      ctx.fill();
      // Right Ear
      ctx.beginPath();
      ctx.moveTo(6, -4);
      ctx.lineTo(12, -6);
      ctx.lineTo(6, -1);
      ctx.fill();

      // Face
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(0, -4, 6, 0, Math.PI*2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(-3, -5, 2, 2);
      ctx.fillRect(1, -5, 2, 2);
      ctx.fillStyle = '#ef4444'; // Red glow
      ctx.fillRect(-2, -5, 1, 1);
      ctx.fillRect(2, -5, 1, 1);

      // Weapon Drawing
      ctx.translate(8, 2); // Right hand position
      if (weaponType === 'SWORD') {
          const swing = e.attackCooldown > 0 ? Math.sin(time/50)*1 : Math.PI/4;
          ctx.rotate(swing);
          ctx.fillStyle = '#525252'; // Metal
          ctx.fillRect(0, -1, 12, 2); // Blade
          ctx.fillStyle = '#451a03'; // Hilt
          ctx.fillRect(-2, -2, 2, 4); 
      } else if (weaponType === 'HAMMER') {
          const swing = e.attackCooldown > 0 ? Math.sin(time/100)*2 : -Math.PI/2;
          ctx.rotate(swing);
          ctx.fillStyle = '#451a03'; // Handle
          ctx.fillRect(0, -2, 16, 4);
          ctx.fillStyle = '#1e293b'; // Head
          ctx.fillRect(12, -6, 8, 12);
      } else if (weaponType === 'DAGGER') {
          ctx.rotate(Math.PI/2);
          ctx.fillStyle = '#e5e5e5';
          ctx.beginPath();
          ctx.moveTo(0,0); ctx.lineTo(8, -2); ctx.lineTo(8, 2); ctx.fill();
      } else if (weaponType === 'BOW') {
          ctx.rotate(-Math.PI/2);
          ctx.strokeStyle = '#854d0e';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 8, -0.5, Math.PI + 0.5);
          ctx.stroke();
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#fff';
          ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
      }

      ctx.restore();
  };

  const drawSlimer = (ctx: CanvasRenderingContext2D, e: Enemy, time: number) => {
      const cx = e.pos.x + e.width/2;
      const cy = e.pos.y + e.height/2;
      
      ctx.save();
      ctx.translate(cx, cy);
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 12, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      const wobble = Math.sin(time / 150) * 2;
      const scaleY = 1 - Math.sin(time / 150) * 0.1;
      
      ctx.scale(1, scaleY);
      
      // Slime Body gradient
      const grad = ctx.createRadialGradient(0, -5, 2, 0, 0, 15);
      grad.addColorStop(0, '#d9f99d');
      grad.addColorStop(0.6, '#84cc16');
      grad.addColorStop(1, '#365314');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      // Blob shape
      ctx.moveTo(-12 - wobble, 0);
      ctx.bezierCurveTo(-12, -15, 12, -15, 12 + wobble, 0);
      ctx.bezierCurveTo(15, 10, -15, 10, -12 - wobble, 0);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-4, -4 + wobble, 2, 0, Math.PI*2);
      ctx.arc(4, -4 + wobble, 2, 0, Math.PI*2);
      ctx.fill();
      
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(-5, -8, 3, 1.5, -0.5, 0, Math.PI*2);
      ctx.fill();

      ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, e: Enemy) => {
      if (e.hitFlash && e.hitFlash > 0) {
          const cx = e.pos.x + e.width/2;
          const cy = e.pos.y + e.height/2;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(cx, cy, e.width/2, 0, Math.PI*2);
          ctx.fill();
          return;
      }
      
      const time = Date.now();

      if (e.type === 'SLIMER') {
          drawSlimer(ctx, e, time);
      } else {
          drawBipedalEnemy(ctx, e, time);
      }
      
      // Health bar
      ctx.save();
      ctx.translate(e.pos.x + e.width/2, e.pos.y + e.height/2);
      const hpPct = e.health / e.maxHealth;
      ctx.fillStyle = '#000';
      ctx.fillRect(-12, -e.height/2 - 10, 24, 4);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-11, -e.height/2 - 9, 22 * hpPct, 2);
      ctx.restore();
  };

  const updatePhysics = () => {
    if (gameStatusRef.current !== GameStatus.PLAYING) return;

    // HITSTOP: If active, pause logic, just render last frame (ish) or subtle shake
    if (hitStop.current > 0) {
        hitStop.current--;
        // We still run requestAnimationFrame loop in tick, so we just return here to skip physics
        return; 
    }

    // Screen Shake Decay
    if (screenShake.current > 0) {
        screenShake.current *= 0.9;
        if (screenShake.current < 0.5) screenShake.current = 0;
    }

    const charConfig = PHYSICS[activeCharRef.current];
    const isOnyx = activeCharRef.current === CharacterType.ONYX;

    if (isOnyx && keysPressed.current['Space'] && !isAttacking.current && !isDodging.current) {
        chargeTimer.current++;
        if (chargeTimer.current % 5 === 0) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20;
            particles.current.push({
                id: Math.random().toString(),
                pos: { x: playerPos.current.x + 12 + Math.cos(angle)*dist, y: playerPos.current.y + 12 + Math.sin(angle)*dist },
                vel: { x: -Math.cos(angle), y: -Math.sin(angle) }, 
                width: 2, height: 2, active: true, life: 20, maxLife: 20,
                color: chargeTimer.current > 30 ? '#FF4500' : '#FFF',
                type: 'DEFAULT', facing: Direction.DOWN
            });
        }
        if (chargeTimer.current === 30) {
            playSound('charge_ready');
            createShockwave(playerPos.current.x + 12, playerPos.current.y + 12, '#FFD700');
        }
    } else if (!keysPressed.current['Space']) {
        if (!isAttacking.current) chargeTimer.current = 0;
    }

    if (playerSlowTimer.current > 0) {
        playerSlowTimer.current--;
        if (playerSlowTimer.current <= 0) {
            playerSpeedMultiplier.current = 1.0;
        }
    }
    if (dodgeCooldown.current > 0) dodgeCooldown.current--;

    const pCx = Math.floor((playerPos.current.x + 12) / TILE_SIZE);
    const pCy = Math.floor((playerPos.current.y + 12) / TILE_SIZE);
    const radiusSq = 25; 

    for (let y = pCy - 5; y <= pCy + 5; y++) {
        for (let x = pCx - 5; x <= pCx + 5; x++) {
            if (y >= 0 && y < LEVEL_MAP_HEIGHT && x >= 0 && x < LEVEL_MAP_WIDTH) {
                if (fogGrid.current[y][x]) continue; 
                const distSq = (x - pCx) * (x - pCx) + (y - pCy) * (y - pCy);
                if (distSq <= radiusSq) {
                    fogGrid.current[y][x] = true;
                }
            }
        }
    }

    if (isDodging.current) {
        dodgeTimer.current--;
        if (dodgeTimer.current % 3 === 0) {
            playerGhostTrail.current.push({
                x: playerPos.current.x,
                y: playerPos.current.y,
                life: 10
            });
        }
        if (dodgeTimer.current <= 0) {
            isDodging.current = false;
            playerVel.current.x *= 0.5; 
            playerVel.current.y *= 0.5;
        }
    } else {
        let inputX = 0;
        let inputY = 0;

        // Keyboard
        if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) inputX -= 1;
        if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) inputX += 1;
        if (keysPressed.current['ArrowUp'] || keysPressed.current['KeyW']) inputY -= 1;
        if (keysPressed.current['ArrowDown'] || keysPressed.current['KeyS']) inputY += 1;

        // Joystick Override/Add
        if (Math.abs(touchJoystick.current.x) > 0.1) inputX = touchJoystick.current.x;
        if (Math.abs(touchJoystick.current.y) > 0.1) inputY = touchJoystick.current.y;

        if (inputX !== 0 || inputY !== 0) {
            // Normalize if strictly keyboard, joystick usually already normalized
            if (Math.abs(inputX) > 1 || Math.abs(inputY) > 1 || (inputX !== 0 && inputY !== 0 && touchJoystick.current.x === 0)) {
                const len = Math.hypot(inputX, inputY);
                inputX /= len;
                inputY /= len;
            }
            
            // Allow turning during attack for responsiveness (removed lock)
            if (Math.abs(inputX) > Math.abs(inputY)) {
                    playerFacing.current = inputX > 0 ? Direction.RIGHT : Direction.LEFT;
            } else {
                    playerFacing.current = inputY > 0 ? Direction.DOWN : Direction.UP;
            }
        }

        const moveMulti = isAttacking.current && isOnyx ? 0.5 : 1.0;
        const chargeSlow = (isOnyx && chargeTimer.current > 0) ? 0.4 : 1.0; 
        const speedSetting = playerSpeedModRef.current;
        
        const maxSpd = charConfig.maxSpeed * moveMulti * chargeSlow * playerSpeedMultiplier.current * speedSetting;

        const targetVx = inputX * maxSpd;
        const targetVy = inputY * maxSpd;

        const applyForce = (currentVel: number, targetVel: number) => {
            const hasInput = Math.abs(targetVel) > 0.01;
            
            if (hasInput) {
                let accel = charConfig.moveSpeed;
                const isTurning = Math.sign(targetVel) !== Math.sign(currentVel) && Math.abs(currentVel) > 0.5;
                if (isTurning) {
                    if (isOnyx) accel *= 2.5;
                    else accel *= 0.3;
                }
                return currentVel + (targetVel - currentVel) * accel;
            } else {
                let friction = charConfig.friction;
                if (Math.abs(currentVel) < 0.1) return 0;
                return currentVel * friction;
            }
        };

        playerVel.current.x = applyForce(playerVel.current.x, targetVx);
        playerVel.current.y = applyForce(playerVel.current.y, targetVy);
    }

    const nextX = playerPos.current.x + playerVel.current.x;
    const nextY = playerPos.current.y + playerVel.current.y;
    const playerSize = 24;
    const padding = (TILE_SIZE - playerSize) / 2;
    
    if (!checkWallCollision(nextX + padding, playerPos.current.y + padding, playerSize)) {
      playerPos.current.x = nextX;
    } else {
      if(isDodging.current) isDodging.current = false;
      playerVel.current.x = 0;
    }
    if (!checkWallCollision(playerPos.current.x + padding, nextY + padding, playerSize)) {
      playerPos.current.y = nextY;
    } else {
      if(isDodging.current) isDodging.current = false;
      playerVel.current.y = 0;
    }

    checkTileInteraction();

    if (attackCooldown.current > 0) attackCooldown.current--;
    if (attackFrame.current > 0) {
      attackFrame.current--;
      if (attackFrame.current <= 0) isAttacking.current = false;

      if (isOnyx && attackFrame.current > 2) {
        let hitbox;
        const isCharged = attackType.current === 'CHARGED';
        
        if (isCharged) {
            hitbox = {
                x: playerPos.current.x + 12 - 40,
                y: playerPos.current.y + 12 - 40,
                w: 80,
                h: 80
            };
        } else {
            const offset = getDirectionOffset(playerFacing.current, 32);
            hitbox = {
                x: playerPos.current.x + 12 + offset.x,
                y: playerPos.current.y + 12 + offset.y,
                w: 32,
                h: 32
            };
        }
        
        enemies.current.forEach(e => {
          if (e.active && (e.hitFlash || 0) <= 0 && rectIntersect(hitbox.x, hitbox.y, hitbox.w, hitbox.h, e.pos.x, e.pos.y, e.width, e.height)) {
             const dmg = isCharged ? charConfig.damage * 3 : charConfig.damage;
             damageEnemy(e, dmg);
             
             const knockbackMod = e.type === 'TANK' ? 0.1 : 1.0;
             const kForce = isCharged ? 25 : 10;
             
             const dx = e.pos.x - playerPos.current.x;
             const dy = e.pos.y - playerPos.current.y;
             const dist = Math.hypot(dx, dy) || 1;
             e.vel.x += (dx / dist) * kForce * knockbackMod;
             e.vel.y += (dy / dist) * kForce * knockbackMod;
             
             createSlashImpact(e.pos.x + 16, e.pos.y + 16, '#FFFF00');
             // Impact Rumble
             screenShake.current = isCharged ? 15 : 8; 
          }
        });
      }
    }

    projectiles.current.forEach(p => {
      if (!p.active) return;
      
      if (p.trail) {
        p.trail.push({x: p.pos.x, y: p.pos.y});
        if (p.trail.length > 10) p.trail.shift();
      }
      
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      p.life--;
      if (p.life <= 0) p.active = false;
      
      if (checkWallCollision(p.pos.x, p.pos.y, p.width)) {
        p.active = false;
        createSparks(p.pos.x, p.pos.y, p.color, 5);
      }
      
      if (p.owner === 'PLAYER') {
        enemies.current.forEach(e => {
          if (p.active && e.active && rectIntersect(p.pos.x, p.pos.y, p.width, p.height, e.pos.x, e.pos.y, e.width, e.height)) {
            damageEnemy(e, p.damage);
            p.active = false;
            createImpactEffect(p.pos.x, p.pos.y, '#FFD700');
            
            const knockbackMod = e.type === 'TANK' ? 0.1 : 1.0;
            const dx = e.pos.x - p.pos.x;
            const dy = e.pos.y - p.pos.y;
            const dist = Math.hypot(dx, dy) || 1;
            e.vel.x += (dx / dist) * 4 * knockbackMod;
            e.vel.y += (dy / dist) * 4 * knockbackMod;
            // Projectile Impact Rumble
            screenShake.current = 5;
          }
        });
      } else if (p.owner === 'ENEMY') {
        if (!isDodging.current && p.active && rectIntersect(p.pos.x, p.pos.y, p.width, p.height, playerPos.current.x + 8, playerPos.current.y + 8, 24, 24)) {
           playerHealth.current -= p.damage;
           hitStop.current = 6; // Hit stop on player damage
           // Hit Rumble
           screenShake.current = 10;
           playSound('hit');
           
           const dx = playerPos.current.x - p.pos.x;
           const dy = playerPos.current.y - p.pos.y;
           const dist = Math.hypot(dx, dy) || 1;
           const force = 10;
           playerVel.current.x = (dx / dist) * force;
           playerVel.current.y = (dy / dist) * force;

           p.active = false;
           createExplosion(p.pos.x, p.pos.y, '#FF0000', 5);
           if (playerHealth.current <= 0) setGameStatus(GameStatus.GAME_OVER);
            window.dispatchEvent(new CustomEvent('hud-update', { 
                detail: { 
                char: activeCharRef.current, 
                hp: playerHealth.current, 
                maxHp: playerMaxHealth.current,
                score: score.current
                } 
            }));
        }
      }
    });

    enemies.current.forEach(e => {
      if (!e.active) return;
      if (e.hitFlash && e.hitFlash > 0) e.hitFlash--;

      const dist = Math.hypot(playerPos.current.x - e.pos.x, playerPos.current.y - e.pos.y);
      const angleToPlayer = Math.atan2(playerPos.current.y - e.pos.y, playerPos.current.x - e.pos.x);

      if (e.attackCooldown > 0) e.attackCooldown--;

      if (e.type === 'TURRET') {
          e.vel.x *= 0.9; // Smooth Friction
          e.vel.y *= 0.9;
          
          if (dist < e.agroRange && e.attackCooldown <= 0) {
              const pSpeed = 4; // Reduced from 6
              projectiles.current.push({
                id: Math.random().toString(),
                pos: { x: e.pos.x + e.width/2 - 5, y: e.pos.y + e.height/2 - 5 },
                vel: { x: Math.cos(angleToPlayer) * pSpeed, y: Math.sin(angleToPlayer) * pSpeed },
                width: 10,
                height: 10,
                active: true,
                life: 100,
                owner: 'ENEMY',
                damage: 1,
                color: '#D500F9',
                facing: Direction.DOWN,
                trail: []
              });
              e.attackCooldown = 100; 
              playSound('shoot');
              createSparks(e.pos.x + e.width/2 + Math.cos(angleToPlayer)*16, e.pos.y + e.height/2 + Math.sin(angleToPlayer)*16, '#D500F9', 5);
          }

      } else if (e.type === 'SLIMER') {
          e.vel.x *= 0.9; // Smooth Friction
          e.vel.y *= 0.9;
          if (dist < e.agroRange) {
            const speed = 0.1; // Reduced force
            const wobble = Math.sin(Date.now() / 100 + parseInt(e.id.replace(/\D/g, ''))) * 1.5; 
            const dx = Math.cos(angleToPlayer + wobble * 0.5);
            const dy = Math.sin(angleToPlayer + wobble * 0.5);
            e.vel.x += dx * speed;
            e.vel.y += dy * speed;
            
            const maxSpeed = 1.8; // Reduced from 3.5
            const currentSpeed = Math.hypot(e.vel.x, e.vel.y);
            if (currentSpeed > maxSpeed) {
                e.vel.x = (e.vel.x / currentSpeed) * maxSpeed;
                e.vel.y = (e.vel.y / currentSpeed) * maxSpeed;
            }
          }

      } else if (e.type === 'DASHER') {
          if (e.attackCooldown <= 0) {
              e.vel.x *= 0.9; // Smooth Friction
              e.vel.y *= 0.9;

              if (dist < e.agroRange) {
                  e.attackCooldown = 100; 
                  if (Math.abs(Math.cos(angleToPlayer)) > Math.abs(Math.sin(angleToPlayer))) {
                      e.facing = Math.cos(angleToPlayer) > 0 ? Direction.RIGHT : Direction.LEFT;
                  } else {
                      e.facing = Math.sin(angleToPlayer) > 0 ? Direction.DOWN : Direction.UP;
                  }
              }
          } else if (e.attackCooldown > 60) {
              e.vel.x *= 0.5; 
              e.vel.y *= 0.5;
          } else if (e.attackCooldown === 60) {
              const dashSpeed = 9; // Reduced from 14
              e.vel.x = Math.cos(angleToPlayer) * dashSpeed;
              e.vel.y = Math.sin(angleToPlayer) * dashSpeed;
              playSound('dodge'); 
              createShockwave(e.pos.x + e.width/2, e.pos.y + e.height/2, '#a855f7');
          } else if (e.attackCooldown < 60 && e.attackCooldown > 20) {
          } else {
              e.vel.x *= 0.9;
              e.vel.y *= 0.9;
          }

      } else if (e.type === 'TANK') {
          e.vel.x *= 0.9; // Smooth Friction
          e.vel.y *= 0.9;
          if (dist < e.agroRange) {
             const speed = 0.05; // Very heavy accel
             e.vel.x += Math.cos(angleToPlayer) * speed;
             e.vel.y += Math.sin(angleToPlayer) * speed;
             
             const maxSpeed = 0.8; // Reduced from 1.5
             const s = Math.hypot(e.vel.x, e.vel.y);
             if (s > maxSpeed) {
                 e.vel.x = (e.vel.x / s) * maxSpeed;
                 e.vel.y = (e.vel.y / s) * maxSpeed;
             }
          }

      } else { // Default Chaser
          e.vel.x *= 0.9; // Smooth Friction
          e.vel.y *= 0.9;
          if (dist < e.agroRange) {
            const chaseSpeed = 0.25; // Reduced from 0.5
            const dx = Math.cos(angleToPlayer);
            const dy = Math.sin(angleToPlayer);
            e.vel.x += dx * chaseSpeed;
            e.vel.y += dy * chaseSpeed;
          }
      }

      if (!checkWallCollision(e.pos.x + e.vel.x, e.pos.y, e.width)) e.pos.x += e.vel.x;
      if (!checkWallCollision(e.pos.x, e.pos.y + e.vel.y, e.width)) e.pos.y += e.vel.y;

      if (e.type !== 'DASHER' || e.attackCooldown <= 0) {
          if (Math.abs(e.vel.x) > 0.1) {
              e.facing = e.vel.x > 0 ? Direction.RIGHT : Direction.LEFT;
          } else if (Math.abs(e.vel.y) > 0.1) {
              e.facing = e.vel.y > 0 ? Direction.DOWN : Direction.UP;
          }
      }

      if (rectIntersect(playerPos.current.x + 8, playerPos.current.y + 8, 24, 24, e.pos.x, e.pos.y, e.width, e.height)) {
        if (e.type === 'SLIMER' && playerSlowTimer.current <= 0 && !isDodging.current) {
            playerSlowTimer.current = 180;
            playerSpeedMultiplier.current = 0.4;
            createExplosion(playerPos.current.x, playerPos.current.y, '#00FF00', 8);
            floatingTexts.current.push({
              id: Math.random().toString(),
              x: playerPos.current.x,
              y: playerPos.current.y - 20,
              text: "SLOWED!",
              color: "#00FF00",
              life: 40,
              velY: -0.5
            });
        }

        if (attackCooldown.current <= 0 && !isDodging.current) { 
           const dmg = e.type === 'TANK' ? 2 : 1; 
           playerHealth.current -= dmg;
           
           hitStop.current = 8; // Hit stop on collision damage
           // Hit Rumble
           screenShake.current = 12;
           playSound('hit');
           const dx = playerPos.current.x - e.pos.x;
           const dy = playerPos.current.y - e.pos.y;
           const dist = Math.hypot(dx, dy) || 1;
           
           const knockback = e.type === 'TANK' ? 20 : 15;
           playerVel.current.x = (dx / dist) * knockback;
           playerVel.current.y = (dy / dist) * knockback;
           
           if (playerHealth.current <= 0) setGameStatus(GameStatus.GAME_OVER);
           attackCooldown.current = 30; 
           window.dispatchEvent(new CustomEvent('hud-update', { 
            detail: { 
              char: activeCharRef.current, 
              hp: playerHealth.current, 
              maxHp: playerMaxHealth.current,
              score: score.current
            } 
          }));
        }
      }
    });

    pickups.current.forEach(p => {
       if (!p.active) return;
       p.life--;
       if (p.life <= 0) p.active = false;

       const dx = (playerPos.current.x + 12) - p.pos.x; 
       const dy = (playerPos.current.y + 12) - p.pos.y;
       const dist = Math.hypot(dx, dy);

       if (dist < 100 && !p.collected) {
          p.pos.x += (dx / dist) * 4;
          p.pos.y += (dy / dist) * 4;
       } else {
           p.pos.x += p.vel.x;
           p.pos.y += p.vel.y;
           p.vel.x *= 0.9;
           p.vel.y *= 0.9;
       }

       if (dist < 24 && !p.collected) {
           p.collected = true;
           p.active = false;
           score.current += p.value;
           playSound('gem_collect');
           
           createSparks(p.pos.x, p.pos.y, '#22d3ee', 5);
           floatingTexts.current.push({
              id: Math.random().toString(),
              x: p.pos.x,
              y: p.pos.y - 10,
              text: `+${p.value}`,
              color: "#22d3ee",
              life: 30,
              velY: -1
           });

           window.dispatchEvent(new CustomEvent('hud-update', { 
            detail: { 
              char: activeCharRef.current, 
              hp: playerHealth.current, 
              maxHp: playerMaxHealth.current,
              score: score.current
            } 
          }));
       }
    });

    particles.current.forEach(p => {
      if (!p.active) return;
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      
      if (p.type === 'SHOCKWAVE') {
          p.width += 4;
          p.height += 4;
          p.pos.x -= 2;
          p.pos.y -= 2;
          p.life--;
      } else if (p.type === 'RING') {
          p.width += 2;
          p.height += 2;
          p.pos.x -= 1;
          p.pos.y -= 1;
          p.life--;
      } else if (p.type === 'SLASH') {
          p.life--;
      } else {
          p.life--;
      }

      if (p.life <= 0) p.active = false;
    });

    playerGhostTrail.current.forEach(g => g.life--);
    playerGhostTrail.current = playerGhostTrail.current.filter(g => g.life > 0);

    floatingTexts.current.forEach(t => {
        t.y += t.velY;
        t.life--;
    });
    floatingTexts.current = floatingTexts.current.filter(t => t.life > 0);

    updateCamera();
  };

  const drawCharacter = (ctx: CanvasRenderingContext2D, char: CharacterType, x: number, y: number, facing: Direction, isWalking: boolean) => {
    ctx.save();
    ctx.translate(x, y);

    if (char === CharacterType.ONYX && chargeTimer.current > 0) {
        ctx.translate((Math.random()-0.5)*2, (Math.random()-0.5)*2);
    }

    const time = Date.now();
    let animY = 0;

    if (isWalking) {
        animY = Math.sin(time / 100) * 2;
    } else {
        if (char === CharacterType.ONYX) {
            animY = Math.sin(time / 400) * 1; 
        } else {
            animY = Math.sin(time / 500) * 3; 
        }
    }
    
    // Character Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    const shadowScale = char === CharacterType.ZAINAB && !isWalking ? 1 + (animY * 0.05) : 1;
    ctx.ellipse(16, 32, 10 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (char === CharacterType.ONYX && chargeTimer.current > 0) {
        ctx.filter = `sepia(1) hue-rotate(-50deg) saturate(${3 + chargeTimer.current/10})`;
    }

    if (char === CharacterType.ONYX) {
        ctx.fillStyle = '#0F172A'; 
        ctx.fillRect(10, 22 + (isWalking ? animY : 0), 5, 8);
        ctx.fillRect(19, 22 - (isWalking ? animY : 0), 5, 8);
        
        ctx.fillStyle = '#334155'; 
        ctx.fillRect(8, 12 + animY, 18, 14);
        
        ctx.fillStyle = '#94A3B8'; 
        ctx.fillRect(12, 14 + animY, 10, 8);

        ctx.fillStyle = '#1E293B'; 
        ctx.fillRect(7, -2 + animY, 20, 16);
        
        ctx.fillStyle = '#EAB308'; 
        const headY = animY;
        if (facing === Direction.DOWN) {
            ctx.fillRect(11, 4 + headY, 12, 4);
            ctx.fillStyle = '#475569'; 
            ctx.fillRect(6, 4 + headY, 2, 4);
            ctx.fillRect(26, 4 + headY, 2, 4);
        } else if (facing === Direction.RIGHT) {
            ctx.fillRect(17, 4 + headY, 8, 4);
        } else if (facing === Direction.LEFT) {
            ctx.fillRect(9, 4 + headY, 8, 4);
        } else {
            ctx.fillStyle = '#334155';
            ctx.fillRect(12, 2 + headY, 10, 8);
        }

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(6, 14 + headY, 6, 0, Math.PI * 2); 
        ctx.arc(28, 14 + headY, 6, 0, Math.PI * 2); 
        ctx.fill();

        if (facing === Direction.UP) {
             ctx.fillStyle = '#1e293b';
             ctx.fillRect(10, 14 + headY, 14, 16);
             ctx.strokeStyle = '#94a3b8';
             ctx.strokeRect(10, 14 + headY, 14, 16);
        }

    } else {
        if (!isWalking) {
             const pulse = (Math.sin(time / 400) + 1) * 0.5; 
             const gradient = ctx.createRadialGradient(16, 16 + animY, 10, 16, 16 + animY, 30);
             gradient.addColorStop(0, 'rgba(99, 102, 241, 0.0)');
             gradient.addColorStop(0.5, `rgba(99, 102, 241, ${0.1 + pulse * 0.2})`);
             gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
             
             ctx.fillStyle = gradient;
             ctx.beginPath();
             ctx.arc(16, 16 + animY, 32, 0, Math.PI * 2);
             ctx.fill();
        }

        ctx.fillStyle = '#312e81'; 
        ctx.beginPath();
        ctx.moveTo(6, 30 + animY); 
        ctx.lineTo(28, 30 + animY);
        ctx.lineTo(24, 14 + animY);
        ctx.lineTo(10, 14 + animY);
        ctx.fill();
        
        ctx.fillStyle = '#4338ca'; 
        ctx.fillRect(10, 12 + animY, 14, 10);
        
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(16, 12 + animY, 2, 18);

        ctx.fillStyle = '#3f2c22'; 
        ctx.fillRect(8, -4 + animY, 18, 18);
        
        ctx.fillStyle = '#fcd34d'; 
        const headY = animY;
        if (facing === Direction.DOWN) {
            ctx.fillRect(11, 4 + headY, 12, 9);
            ctx.fillStyle = '#000'; 
            ctx.fillRect(13, 7 + headY, 2, 2);
            ctx.fillRect(19, 7 + headY, 2, 2);
        } else if (facing === Direction.RIGHT) {
            ctx.fillRect(15, 4 + headY, 10, 9);
            ctx.fillStyle = '#000';
            ctx.fillRect(19, 7 + headY, 2, 2);
        } else if (facing === Direction.LEFT) {
            ctx.fillRect(9, 4 + headY, 10, 9);
            ctx.fillStyle = '#000';
            ctx.fillRect(11, 7 + headY, 2, 2);
        }

        ctx.fillStyle = '#312e81';
        ctx.fillRect(8, -4 + headY, 18, 6);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(8, 2 + headY, 18, 2);
    }
    ctx.restore();
  };

  const drawWeapon = (ctx: CanvasRenderingContext2D, char: CharacterType, x: number, y: number, facing: Direction, isAttacking: boolean, frame: number) => {
      ctx.save();
      const cx = x + 16;
      const cy = y + 16;
      ctx.translate(cx, cy);

      let handX = 0;
      let handY = 0;
      let baseRot = 0;
      let mirror = 1;

      if (facing === Direction.LEFT) {
           ctx.scale(-1, 1);
           mirror = -1;
           facing = Direction.RIGHT; 
      }

      if (facing === Direction.RIGHT) {
          handX = 6; handY = 8; baseRot = 0;
      } else if (facing === Direction.DOWN) {
          handX = -6; handY = 6; baseRot = Math.PI / 2; 
      } else if (facing === Direction.UP) {
          handX = 6; handY = -4; baseRot = -Math.PI / 2;
      }

      ctx.translate(handX, handY);
      ctx.rotate(baseRot);

      if (char === CharacterType.ONYX) {
          // --- SWORD (Refined & Impactful) ---
          let swingRot = 0;
          ctx.translate(0, -2); 

          if (isAttacking) {
              if (attackType.current === 'CHARGED') {
                  const progress = 1 - (frame / 15); 
                  swingRot = progress * Math.PI * 4; 
              } else {
                  const charConfig = PHYSICS[char];
                  const maxFrame = charConfig.attackDuration;
                  const progress = 1 - (frame / maxFrame);
                  // Heavier ease-out for impact (starts fast, slows down)
                  const ease = 1 - Math.pow(1 - progress, 4); 
                  
                  // Wide Slash Arc (~160 degrees)
                  const totalSwipe = 2.8; 
                  const startAngle = -totalSwipe / 2 - 0.2;
                  swingRot = startAngle + (totalSwipe * ease);
                  
                  // Thrust forward during swing
                  const thrust = Math.sin(progress * Math.PI) * 12;
                  ctx.translate(thrust, 0);
              }
          } else {
              const breathe = Math.sin(Date.now() / 400) * 0.08;
              const chargeShake = chargeTimer.current > 0 ? (Math.random()-0.5)*0.2 : 0;
              swingRot = Math.PI / 3 + breathe + chargeShake;
          }
          ctx.rotate(swingRot);

          // Grip
          ctx.fillStyle = '#451a03'; 
          ctx.fillRect(-2, -4, 4, 8);
          
          // Pommel
          ctx.fillStyle = '#d97706';
          ctx.beginPath();
          ctx.arc(0, -5, 3.5, 0, Math.PI*2);
          ctx.fill();

          // Crossguard (Winged)
          ctx.fillStyle = '#f59e0b'; 
          ctx.beginPath();
          ctx.moveTo(0, 4);
          ctx.lineTo(6, 6);
          ctx.lineTo(6, 8);
          ctx.lineTo(-6, 8);
          ctx.lineTo(-6, 6);
          ctx.lineTo(0, 4);
          ctx.fill();
          
          // Blade (Thinned)
          const grad = ctx.createLinearGradient(0, 0, 40, 0);
          if (chargeTimer.current > 30) {
              grad.addColorStop(0, '#fef3c7');
              grad.addColorStop(0.5, '#fbbf24');
              grad.addColorStop(1, '#b45309');
          } else {
              grad.addColorStop(0, '#e2e8f0');
              grad.addColorStop(0.5, '#94a3b8');
              grad.addColorStop(1, '#cbd5e1');
          }
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(2, 3); 
          ctx.lineTo(36, 3);
          ctx.lineTo(42, 0); 
          ctx.lineTo(36, -3); 
          ctx.lineTo(2, -3);
          ctx.fill();
          
          // Fuller
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.moveTo(4, 1); 
          ctx.lineTo(30, 0.5);
          ctx.lineTo(30, -0.5);
          ctx.lineTo(4, -1);
          ctx.fill();

          // Trail FX
          if (isAttacking) {
              if (attackType.current === 'CHARGED') {
                  ctx.save();
                  const spinGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 60);
                  spinGrad.addColorStop(0, 'rgba(255,255,255,0)');
                  spinGrad.addColorStop(0.8, 'rgba(255,100,0,0.5)');
                  spinGrad.addColorStop(1, 'rgba(255,255,255,0)');
                  ctx.fillStyle = spinGrad;
                  ctx.beginPath();
                  ctx.arc(0, 0, 60, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.restore();
              } else if (frame > 1) {
                  // SWORD TRAIL - Arc Segment
                  ctx.save();
                  const trailColor = chargeTimer.current > 30 ? '#fbbf24' : '#FFF';
                  // Rotate back to align trail with swipe
                  // We want to draw the trail in the "world" space of the hand, not rotating with the sword
                  // But it's easier to just draw a "swoosh" relative to hand
                  ctx.rotate(-swingRot); // Undo sword rotation to draw stationary trail arc relative to hand
                  
                  const charConfig = PHYSICS[char];
                  const maxFrame = charConfig.attackDuration;
                  const progress = 1 - (frame / maxFrame);
                  const ease = 1 - Math.pow(1 - progress, 4);
                  const totalSwipe = 2.8;
                  const startAngle = -totalSwipe / 2 - 0.2;
                  const currentAngle = startAngle + (totalSwipe * ease);

                  ctx.beginPath();
                  // Draw arc following blade tip radius (~40)
                  ctx.arc(0, 0, 40, startAngle, currentAngle, false);
                  ctx.strokeStyle = trailColor;
                  ctx.lineWidth = 4;
                  ctx.globalAlpha = 0.5 * (frame / maxFrame); // Fade out
                  ctx.stroke();
                  
                  // Inner brighter trail
                  ctx.beginPath();
                  ctx.arc(0, 0, 35, startAngle + 0.2, currentAngle, false);
                  ctx.lineWidth = 2;
                  ctx.globalAlpha = 0.8 * (frame / maxFrame);
                  ctx.stroke();

                  ctx.restore();
              }
          }

      } else {
          // --- STAFF (Recoil & Flash) ---
          if (isAttacking) {
              const charConfig = PHYSICS[char];
              const maxFrame = charConfig.attackDuration;
              const progress = 1 - (frame / maxFrame);
              
              // Recoil Animation: Quick forward (cast), slow back
              let thrust = 0;
              if (progress < 0.2) {
                  thrust = (progress / 0.2) * 12; // Snap forward
              } else {
                  thrust = 12 - ((progress - 0.2) / 0.8) * 12; // Slide back
              }
              ctx.translate(thrust, 0);
          } else {
             const bob = Math.sin(Date.now() / 400) * 3;
             ctx.translate(0, bob);
             ctx.rotate(-Math.PI / 6); 
          }

          // Shaft
          ctx.fillStyle = '#3f2c22';
          ctx.fillRect(-4, -2, 42, 4);
          
          // Gold Banding
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(4, -2.5, 3, 5);
          ctx.fillRect(24, -2.5, 3, 5);

          // Head
          ctx.translate(38, 0);
          
          // Claw
          ctx.fillStyle = '#d97706';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(5, -10, 15, -8, 12, -2);
          ctx.lineTo(8, 0);
          ctx.lineTo(12, 2);
          ctx.bezierCurveTo(15, 8, 5, 10, 0, 0);
          ctx.fill();

          // Orb Glow Logic
          const charConfig = PHYSICS[char];
          const maxFrame = charConfig.attackDuration;
          const isFiringFrame = isAttacking && frame > maxFrame - 3; // First 3 frames
          
          // Orb
          const pulse = Math.sin(Date.now() / 150);
          const glowSize = isFiringFrame ? 15 : 4 + pulse;
          const coreColor = isFiringFrame ? '#FFFFFF' : '#6366f1';
          
          const glowGrad = ctx.createRadialGradient(6, 0, 2, 6, 0, isFiringFrame ? 25 : 15);
          const alpha = isFiringFrame ? 0.9 : 0.4;
          glowGrad.addColorStop(0, `rgba(165, 180, 252, ${alpha})`);
          glowGrad.addColorStop(1, 'rgba(165, 180, 252, 0)');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(6, 0, isFiringFrame ? 30 : 15, 0, Math.PI*2);
          ctx.fill();

          // Core Orb
          ctx.fillStyle = coreColor;
          ctx.shadowColor = '#4338ca';
          ctx.shadowBlur = isFiringFrame ? 30 : 10;
          ctx.beginPath();
          ctx.arc(6, 0, isFiringFrame ? 8 : 4, 0, Math.PI*2);
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // Muzzle Flash (Energy Buildup)
          if (isFiringFrame) {
              ctx.save();
              ctx.translate(6, 0);
              // Starburst
              ctx.fillStyle = '#FFF';
              ctx.beginPath();
              for (let i = 0; i < 4; i++) {
                  ctx.rotate(Math.PI / 2);
                  ctx.moveTo(0, 0);
                  ctx.lineTo(5, 2);
                  ctx.lineTo(15 + Math.random() * 10, 0); // Long spike
                  ctx.lineTo(5, -2);
              }
              ctx.fill();
              
              // Shock ring
              ctx.strokeStyle = '#a5b4fc';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(0, 0, 12 + (maxFrame - frame) * 4, 0, Math.PI*2);
              ctx.stroke();
              ctx.restore();
          } else if (Math.random() > 0.9) {
              // Idle sparks
              ctx.fillStyle = '#FFF';
              const ang = Math.random() * Math.PI * 2;
              const dist = 8 + Math.random() * 8;
              ctx.beginPath();
              ctx.arc(6 + Math.cos(ang)*dist, Math.sin(ang)*dist, 1, 0, Math.PI*2);
              ctx.fill();
          }
      }
      ctx.restore();
  };

  const drawLighting = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    
    // Global Ambient Overlay (Color Grading)
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = '#1e3a8a'; // Deep blue tint for dungeon feel
    ctx.fillRect(0, 0, width, height);
    
    // Vignette
    ctx.globalCompositeOperation = 'source-over';
    const screenX = playerPos.current.x - camera.current.x + 16;
    const screenY = playerPos.current.y - camera.current.y + 16;
    
    const grad = ctx.createRadialGradient(screenX, screenY, 120, screenX, screenY, 450);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.4)');
    grad.addColorStop(1, 'rgba(0,0,0,0.9)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    frameCount.current++;

    if (mapCacheRef.current) {
        const shakeX = (Math.random() - 0.5) * screenShake.current;
        const shakeY = (Math.random() - 0.5) * screenShake.current;
        
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0,0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(-camera.current.x + shakeX, -camera.current.y + shakeY);
        
        ctx.drawImage(mapCacheRef.current, 0, 0);
    } else {
        ctx.fillStyle = '#0f172a'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
    }

    for (let y = 0; y < LEVEL_MAP_HEIGHT; y++) {
        for (let x = 0; x < LEVEL_MAP_WIDTH; x++) {
            const tile = levelGrid.current[y][x];
            const px = x * TILE_SIZE;
            const py = y * TILE_SIZE;
            
            if (tile === TileType.GOAL) {
                const pulse = Math.sin(Date.now() / 200) * 5;
                ctx.fillStyle = '#00FFFF';
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#00FFFF';
                ctx.beginPath();
                ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, 10 + pulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
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

    pickups.current.forEach(p => {
        if (!p.active) return;
        const t = Date.now() / 300;
        const bounce = Math.sin(t) * 3;
        const cx = p.pos.x;
        const cy = p.pos.y + bounce;

        ctx.fillStyle = '#22d3ee'; 
        ctx.shadowColor = '#0891b2';
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx + 6, cy);
        ctx.lineTo(cx, cy + 6);
        ctx.lineTo(cx - 6, cy);
        ctx.fill();

        ctx.fillStyle = '#cffafe';
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - 2);
        ctx.lineTo(cx + 2, cy - 2);
        ctx.lineTo(cx, cy - 4);
        ctx.fill();

        ctx.shadowBlur = 0;
    });

    enemies.current.forEach(e => {
      if (!e.active) return;
      drawEnemy(ctx, e);
    });

    playerGhostTrail.current.forEach(g => {
        ctx.globalAlpha = 0.3 * (g.life / 10);
        drawCharacter(ctx, activeCharRef.current, g.x, g.y, playerFacing.current, true);
        ctx.globalAlpha = 1.0;
    });

    const pX = playerPos.current.x;
    const pY = playerPos.current.y;
    const isMoving = Math.abs(playerVel.current.x) > 0.1 || Math.abs(playerVel.current.y) > 0.1 || isDodging.current;

    if (playerFacing.current === Direction.UP) {
        drawWeapon(ctx, activeCharRef.current, pX, pY, playerFacing.current, isAttacking.current, attackFrame.current);
    }
    drawCharacter(ctx, activeCharRef.current, pX, pY, playerFacing.current, isMoving);
    if (playerFacing.current !== Direction.UP) {
        drawWeapon(ctx, activeCharRef.current, pX, pY, playerFacing.current, isAttacking.current, attackFrame.current);
    }
    ctx.globalAlpha = 1.0;

    if (playerSlowTimer.current > 0) {
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.strokeRect(pX - 4, pY - 4, 40, 40);
        ctx.fillStyle = 'rgba(0,255,0,0.2)';
        ctx.fillRect(pX, pY, 32, 32);
    }
    
    projectiles.current.forEach(p => {
      if (!p.active) return;
      
      // Draw Trail
      if (p.trail && p.trail.length > 1) {
          ctx.lineWidth = p.width * 0.6;
          ctx.lineCap = 'round';
          for (let i = 1; i < p.trail.length; i++) {
              ctx.beginPath();
              ctx.moveTo(p.trail[i-1].x, p.trail[i-1].y);
              ctx.lineTo(p.trail[i].x, p.trail[i].y);
              ctx.strokeStyle = p.color;
              ctx.globalAlpha = 0.4 * (i / p.trail.length);
              ctx.stroke();
          }
          ctx.globalAlpha = 1.0;
      }
      
      // Glow
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.width/2, 0, Math.PI * 2);
      ctx.fill();
      
      // Core
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.width/3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;
    });

    particles.current.forEach(p => {
      if (!p.active) return;

      if (p.type === 'SPARK') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.height; 
          ctx.globalAlpha = p.life / p.maxLife;
          
          const len = p.width;
          const rot = p.rotation || 0;
          
          ctx.save();
          ctx.translate(p.pos.x, p.pos.y);
          ctx.rotate(rot);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(len, 0);
          ctx.stroke();
          ctx.restore();
          
          ctx.globalAlpha = 1;
      } else if (p.type === 'SHOCKWAVE' || p.type === 'RING') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.type === 'RING' ? 1 : 3;
          ctx.globalAlpha = p.life / p.maxLife;
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, p.width, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
      } else if (p.type === 'SLASH') {
          ctx.save();
          ctx.translate(p.pos.x, p.pos.y);
          ctx.rotate(p.rotation || 0);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life / p.maxLife;
          ctx.fillRect(-p.width/2, -p.height/2, p.width, p.height);
          ctx.restore();
          ctx.globalAlpha = 1.0;
      } else {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life / p.maxLife;
          ctx.fillRect(p.pos.x, p.pos.y, p.width, p.height);
          ctx.globalAlpha = 1;
      }
    });

    ctx.fillStyle = '#000000';
    for (let y = 0; y < LEVEL_MAP_HEIGHT; y++) {
        for (let x = 0; x < LEVEL_MAP_WIDTH; x++) {
            if (!fogGrid.current[y][x]) {
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE + 1, TILE_SIZE + 1);
            }
        }
    }

    floatingTexts.current.forEach(t => {
        ctx.fillStyle = t.color;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText(t.text, t.x, t.y);
        ctx.shadowBlur = 0;
    });

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