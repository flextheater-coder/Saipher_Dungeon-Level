
export enum CharacterType {
  ONYX = 'ONYX',
  ZAINAB = 'ZAINAB'
}

export enum TileType {
  EMPTY = 0, // Void/Pit
  FLOOR = 1,
  WALL = 2,
  DOOR = 3,
  SWITCH = 4,
  HEART_CONTAINER = 5,
  GOAL = 9
}

export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT'
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector2;
  vel: Vector2;
  width: number;
  height: number;
  active: boolean;
  facing: Direction;
}

export interface Projectile extends Entity {
  damage: number;
  life: number;
  owner: 'PLAYER' | 'ENEMY';
  color: string;
  trail?: Vector2[];
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  color: string;
}

export interface Pickup extends Entity {
  type: 'GEM';
  value: number;
  life: number; // Despawn timer
  collected: boolean;
}

export interface Enemy extends Entity {
  health: number;
  maxHealth: number;
  agroRange: number;
  type: 'CHASER' | 'TURRET' | 'SLIMER' | 'DASHER' | 'TANK';
  attackCooldown: number;
  hitFlash?: number; // Number of frames to flash white
}
