
import { CharacterType, LevelDefinition, TileType } from './types';

export const TILE_SIZE = 48;
export const LEVEL_MAP_WIDTH = 30;
export const LEVEL_MAP_HEIGHT = 20;

// Physics Config
export const PHYSICS = {
  [CharacterType.ONYX]: {
    moveSpeed: 0.35,
    maxSpeed: 5.5,
    friction: 0.60,
    color: '#FF2A2A',
    name: 'ONYX',
    desc: 'The Anvil - Fire & Lightning',
    attackCooldown: 18,
    attackDuration: 6,
    damage: 3
  },
  [CharacterType.ZAINAB]: {
    moveSpeed: 0.15,
    maxSpeed: 7.0,
    friction: 0.85,
    color: '#FFD700',
    name: 'ZAINAB',
    desc: 'The Weaver - Time & Air',
    attackCooldown: 15,
    attackDuration: 5,
    damage: 1
  }
};

// --- MAP LAYOUTS ---

// Layout A: The City/Castle Layout (More walls, rooms)
const LAYOUT_A = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,1,2,0],
  [0,2,2,2,1,2,2,2,2,1,2,2,2,2,2,2,2,2,2,2,2,2,1,2,2,2,1,2,2,0],
  [0,2,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,2,2,1,2,2,2,2,2,2,2,2,2,2,1,1,1,1,2,2,2,2,2,2,2,1,2,2,0],
  [0,2,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,2,1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,2,1,2,0,0,0,0,0,0,0,0,0,0,2,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,1,1,2,0,0,0,0,0,0,0,0,0,0,2,1,1,1,1,1,1,2,0],
  [0,2,2,2,2,2,2,2,1,1,2,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,2,0],
  [0,2,1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,1,1,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9,1,2,0],
  [0,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// Layout B: The Organic/Wild Layout (More open, scattered walls)
const LAYOUT_B = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,2,2,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,2,1,1,2,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,2,2,2,1,1,2,2,2,1,1,0,0,0,0,0,0,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,2,2,2,1,1,1,1,1,2,2,1,1,1,1,1,2,2,2,2,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,0,0,0,1,1,1,1,1,1,1,1,1,1,2,2,2,2,1,1,1,5,1,1,1,2,0],
  [0,2,1,1,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,1,1,1,1,2,9,1,1,1,2,1,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,2,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

export const GAME_LEVELS: LevelDefinition[] = [
  {
    id: 1,
    mapLayout: LAYOUT_A,
    enemySpawnRate: 1.0,
    enemyTypes: ['CHASER'],
    theme: {
      name: "CATACOMBS OF DALI",
      floorColor: '#1e293b', // Dark Slate
      wallColor: '#334155',
      wallTopColor: '#0f172a',
      voidColor: '#020617',
      ambientColor: '#1e3a8a', // Blue/Gold Tint
      gemName: "The Ancestor's Spark",
      gemColor: '#FFD700' // Gold
    }
  },
  {
    id: 2,
    mapLayout: LAYOUT_B,
    enemySpawnRate: 1.2,
    enemyTypes: ['CHASER', 'SLIMER', 'TURRET'],
    theme: {
      name: "ASHPERIA FOREST",
      floorColor: '#14532d', // Dark Green
      wallColor: '#365314', // Mossy
      wallTopColor: '#052e16',
      voidColor: '#020617', // Deep pit
      ambientColor: '#166534', // Green Tint
      gemName: "The Unopenable Lock",
      gemColor: '#4ade80' // Green
    }
  },
  {
    id: 3,
    mapLayout: LAYOUT_B,
    enemySpawnRate: 1.3,
    enemyTypes: ['DASHER', 'SLIMER'],
    theme: {
      name: "THE RIVERLANDS",
      floorColor: '#155e75', // Cyan/Blue
      wallColor: '#164e63',
      wallTopColor: '#083344',
      voidColor: '#0891b2', // Water Void
      ambientColor: '#06b6d4', // Aqua Tint
      gemName: "The Tide-Caller",
      gemColor: '#22d3ee' // Cyan
    }
  },
  {
    id: 4,
    mapLayout: LAYOUT_A,
    enemySpawnRate: 1.5,
    enemyTypes: ['TANK', 'CHASER'],
    theme: {
      name: "DIAMOND CASTLE",
      floorColor: '#475569', // Stone
      wallColor: '#e2e8f0', // White/Diamond Walls
      wallTopColor: '#94a3b8',
      voidColor: '#0f172a',
      ambientColor: '#f8fafc', // Bright/White Tint
      gemName: "The Wind-Razor",
      gemColor: '#FFFFFF' // White
    }
  },
  {
    id: 5,
    mapLayout: LAYOUT_B,
    enemySpawnRate: 1.6,
    enemyTypes: ['TANK', 'TURRET'],
    theme: {
      name: "THE MOUNTAIN",
      floorColor: '#451a03', // Brown Dirt
      wallColor: '#78350f', // Red Rock
      wallTopColor: '#451a03',
      voidColor: '#7f1d1d', // Lava Pit
      ambientColor: '#b91c1c', // Red Tint
      gemName: "The Sun-Eater",
      gemColor: '#ef4444' // Red
    }
  },
  {
    id: 6,
    mapLayout: LAYOUT_B,
    enemySpawnRate: 1.4,
    enemyTypes: ['DASHER', 'CHASER'],
    theme: {
      name: "THE DEEP SANDS",
      floorColor: '#d97706', // Orange Sand
      wallColor: '#b45309', // Sandstone
      wallTopColor: '#92400e',
      voidColor: '#451a03', // Dark Pit
      ambientColor: '#f59e0b', // Orange Tint
      gemName: "The Chronos-Dial",
      gemColor: '#fcd34d' // Gold
    }
  },
  {
    id: 7,
    mapLayout: LAYOUT_B,
    enemySpawnRate: 1.8,
    enemyTypes: ['SLIMER', 'TANK', 'TURRET'],
    theme: {
      name: "THE WASTELAND",
      floorColor: '#262626', // Grey Ash
      wallColor: '#404040',
      wallTopColor: '#171717',
      voidColor: '#000000',
      ambientColor: '#525252', // Grey Tint
      gemName: "The Terra-Fist",
      gemColor: '#a8a29e' // Stone
    }
  },
  {
    id: 8,
    mapLayout: LAYOUT_A,
    enemySpawnRate: 2.0,
    enemyTypes: ['TANK', 'DASHER', 'TURRET'],
    theme: {
      name: "GOLDEN CASTLE",
      floorColor: '#854d0e', // Gold Floor
      wallColor: '#ca8a04', // Gold Wall
      wallTopColor: '#a16207',
      voidColor: '#451a03',
      ambientColor: '#facc15', // Yellow Tint
      gemName: "The Wisdom Index",
      gemColor: '#22c55e' // Green/Wisdom
    }
  },
  {
    id: 9,
    mapLayout: LAYOUT_A, // Sky Castle
    enemySpawnRate: 2.5,
    enemyTypes: ['TANK', 'DASHER', 'TURRET', 'CHASER'],
    theme: {
      name: "SKY CASTLE",
      floorColor: '#e2e8f0', // Clouds/White
      wallColor: '#94a3b8', // Silver
      wallTopColor: '#fff',
      voidColor: '#bae6fd', // Sky Void
      ambientColor: '#e0f2fe', // Sky Tint
      gemName: "SAIPHER PRIME",
      gemColor: '#c084fc' // Purple/Rainbow
    }
  }
];
