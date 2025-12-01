
import { CharacterType } from './types';

export const TILE_SIZE = 48; // Slightly larger for top-down detail

// Physics (Top Down)
// Lower friction = faster stopping (0.0 - 1.0, where lower is "more drag")
export const FRICTION = 0.6; 

export const PHYSICS = {
  [CharacterType.ONYX]: {
    moveSpeed: 0.35, // Acceleration factor (Lerp alpha). Higher = Snappier
    maxSpeed: 5.5,
    friction: 0.60, // Fast stop
    color: '#FF2A2A', // Red
    secondaryColor: '#550000',
    name: 'ONYX',
    desc: 'Melee (Space), High Health',
    attackCooldown: 18, // 15% Faster (was 21)
    attackDuration: 6,  // Faster swing (was 8)
    damage: 3
  },
  [CharacterType.ZAINAB]: {
    moveSpeed: 0.15, // Lower acceleration = Floaty/Drifty
    maxSpeed: 7.0,
    friction: 0.85, // Slides more
    color: '#FFD700', // Gold
    secondaryColor: '#FFFFE0',
    name: 'ZAINAB',
    desc: 'Ranged (Space), Fly over Pits',
    attackCooldown: 15,
    attackDuration: 5,
    damage: 1
  }
};

export const LEVEL_MAP_WIDTH = 30;
export const LEVEL_MAP_HEIGHT = 20;

// Top Down Map Layout
// 0: Pit/Void, 1: Floor, 2: Wall, 3: Door/Special, 5: Heart Container, 9: Goal
export const LEVEL_DATA = [
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

export const LEVELS = [LEVEL_DATA];
