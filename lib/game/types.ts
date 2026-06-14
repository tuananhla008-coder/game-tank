export const TILE = 36
export const COLS = 19
export const ROWS = 15
export const WIDTH = COLS * TILE
export const HEIGHT = ROWS * TILE

export type Dir = "up" | "down" | "left" | "right"

// Tile codes
export const EMPTY = 0
export const BRICK = 1
export const STEEL = 2
export const WATER = 3
export const TREE = 4

export type TileCode = 0 | 1 | 2 | 3 | 4

export interface Tank {
  id: number
  x: number
  y: number
  size: number
  dir: Dir
  speed: number
  hp: number
  maxHp: number
  isPlayer: boolean
  cooldown: number
  fireRate: number // ms between shots
  bulletSpeed: number
  bulletPower: number // hp damage
  // AI helpers
  aiTurnTimer: number
  // power-up timers
  speedBoost: number
  strongShot: number
}

export interface Bullet {
  id: number
  x: number
  y: number
  dir: Dir
  speed: number
  power: number
  fromPlayer: boolean
}

export type PowerKind = "heal" | "speed" | "power"

export interface PowerUp {
  id: number
  x: number
  y: number
  kind: PowerKind
  life: number // ms remaining before disappearing
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

export type Phase = "playing" | "won" | "lost"

export interface GameState {
  grid: TileCode[][]
  player: Tank
  enemies: Tank[]
  bullets: Bullet[]
  powerups: PowerUp[]
  particles: Particle[]
  score: number
  timeLeft: number // ms
  phase: Phase
  kills: number
  totalEnemies: number
  nextId: number
  powerupTimer: number
}

export interface MapDef {
  id: number
  name: string
  description: string
  layout: string[]
  enemyCount: number
  enemySpeed: number
  enemyFireRate: number
  enemyHp: number
  enemyAccuracy: number // 0..1 chance to aim at player when deciding
}
