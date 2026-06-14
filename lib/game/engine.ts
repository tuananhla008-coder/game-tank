import {
  type Bullet,
  BRICK,
  COLS,
  type Dir,
  EMPTY,
  type GameState,
  HEIGHT,
  type MapDef,
  type PowerKind,
  type PowerUp,
  ROWS,
  STEEL,
  type Tank,
  type TileCode,
  TILE,
  TREE,
  WATER,
  WIDTH,
} from "./types"

const ROUND_TIME = 180_000 // 3 minutes in ms
const PLAYER_SPEED = 2.1
const PLAYER_FIRE_RATE = 320
const PLAYER_BULLET_SPEED = 6.5
const POWERUP_INTERVAL = 12_000

export interface Input {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  fire: boolean
  boost: boolean
}

function isSolidForTank(code: TileCode): boolean {
  return code === BRICK || code === STEEL || code === WATER
}

function tilesUnderRect(x: number, y: number, w: number, h: number) {
  const c0 = Math.floor(x / TILE)
  const c1 = Math.floor((x + w - 1) / TILE)
  const r0 = Math.floor(y / TILE)
  const r1 = Math.floor((y + h - 1) / TILE)
  return { c0, c1, r0, r1 }
}

function rectHitsSolid(grid: TileCode[][], x: number, y: number, size: number): boolean {
  if (x < 0 || y < 0 || x + size > WIDTH || y + size > HEIGHT) return true
  const { c0, c1, r0, r1 } = tilesUnderRect(x, y, size, size)
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return true
      if (isSolidForTank(grid[r][c])) return true
    }
  }
  return false
}

function tanksOverlap(a: { x: number; y: number; size: number }, b: Tank): boolean {
  return a.x < b.x + b.size && a.x + a.size > b.x && a.y < b.y + b.size && a.y + a.size > b.y
}

function dirToVec(dir: Dir): [number, number] {
  switch (dir) {
    case "up":
      return [0, -1]
    case "down":
      return [0, 1]
    case "left":
      return [-1, 0]
    case "right":
      return [1, 0]
  }
}

function makeTank(id: number, col: number, row: number, isPlayer: boolean, map: MapDef): Tank {
  const size = TILE - 8
  const x = col * TILE + (TILE - size) / 2
  const y = row * TILE + (TILE - size) / 2
  return {
    id,
    x,
    y,
    size,
    dir: isPlayer ? "up" : "down",
    speed: isPlayer ? PLAYER_SPEED : map.enemySpeed,
    hp: isPlayer ? 5 : map.enemyHp,
    maxHp: isPlayer ? 5 : map.enemyHp,
    isPlayer,
    cooldown: 0,
    fireRate: isPlayer ? PLAYER_FIRE_RATE : map.enemyFireRate,
    bulletSpeed: isPlayer ? PLAYER_BULLET_SPEED : 4.6,
    bulletPower: 1,
    aiTurnTimer: 400 + Math.random() * 1200,
    speedBoost: 0,
    strongShot: 0,
  }
}

export function createGame(map: MapDef): GameState {
  const grid: TileCode[][] = []
  let playerCol = 9
  let playerRow = 12
  const enemySpawns: [number, number][] = []

  for (let r = 0; r < ROWS; r++) {
    const row: TileCode[] = []
    const line = map.layout[r] ?? ""
    for (let c = 0; c < COLS; c++) {
      const ch = line[c] ?? "."
      switch (ch) {
        case "B":
          row.push(BRICK)
          break
        case "S":
          row.push(STEEL)
          break
        case "W":
          row.push(WATER)
          break
        case "T":
          row.push(TREE)
          break
        case "P":
          playerCol = c
          playerRow = r
          row.push(EMPTY)
          break
        case "E":
          enemySpawns.push([c, r])
          row.push(EMPTY)
          break
        default:
          row.push(EMPTY)
      }
    }
    grid.push(row)
  }

  let nextId = 1
  const player = makeTank(nextId++, playerCol, playerRow, true, map)

  const enemies: Tank[] = []
  for (let i = 0; i < map.enemyCount; i++) {
    const spawn = enemySpawns[i % enemySpawns.length] ?? [1, 1]
    // spread enemies a bit if more than spawns
    const t = makeTank(nextId++, spawn[0], spawn[1], false, map)
    t.accuracy = map.enemyAccuracy
    enemies.push(t)
  }

  return {
    grid,
    player,
    enemies,
    bullets: [],
    powerups: [],
    particles: [],
    score: 0,
    timeLeft: ROUND_TIME,
    phase: "playing",
    kills: 0,
    totalEnemies: map.enemyCount,
    nextId,
    powerupTimer: POWERUP_INTERVAL,
  }
}

// extend Tank with accuracy at runtime (avoids polluting shared type usage)
declare module "./types" {
  interface Tank {
    accuracy?: number
  }
}

function fire(state: GameState, tank: Tank) {
  if (tank.cooldown > 0) return
  tank.cooldown = tank.fireRate
  const [dx, dy] = dirToVec(tank.dir)
  const cx = tank.x + tank.size / 2
  const cy = tank.y + tank.size / 2
  const power = tank.isPlayer && tank.strongShot > 0 ? 2 : tank.bulletPower
  const speed = tank.bulletSpeed + (tank.isPlayer && tank.strongShot > 0 ? 1.5 : 0)
  state.bullets.push({
    id: state.nextId++,
    x: cx + (dx * tank.size) / 2 - 3,
    y: cy + (dy * tank.size) / 2 - 3,
    dir: tank.dir,
    speed,
    power,
    fromPlayer: tank.isPlayer,
  })
}

function spawnExplosion(state: GameState, x: number, y: number, color: string, count = 14) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2
    const sp = 0.5 + Math.random() * 2.5
    state.particles.push({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: 350 + Math.random() * 350,
      maxLife: 700,
      color,
      size: 2 + Math.random() * 3,
    })
  }
}

function moveTank(state: GameState, tank: Tank, dir: Dir, dist: number): boolean {
  const [dx, dy] = dirToVec(dir)
  const nx = tank.x + dx * dist
  const ny = tank.y + dy * dist
  if (rectHitsSolid(state.grid, nx, ny, tank.size)) return false
  // tank-tank collision
  const others = tank.isPlayer ? state.enemies : [state.player, ...state.enemies.filter((e) => e !== tank)]
  for (const o of others) {
    if (o.hp <= 0) continue
    if (tanksOverlap({ x: nx, y: ny, size: tank.size }, o)) return false
  }
  tank.x = nx
  tank.y = ny
  return true
}

function spawnPowerUp(state: GameState) {
  const kinds: PowerKind[] = ["heal", "speed", "power"]
  for (let attempt = 0; attempt < 30; attempt++) {
    const c = Math.floor(Math.random() * COLS)
    const r = Math.floor(Math.random() * ROWS)
    if (state.grid[r][c] === EMPTY) {
      const pu: PowerUp = {
        id: state.nextId++,
        x: c * TILE + TILE / 2,
        y: r * TILE + TILE / 2,
        kind: kinds[Math.floor(Math.random() * kinds.length)],
        life: 10_000,
      }
      state.powerups.push(pu)
      return
    }
  }
}

function updateAI(state: GameState, e: Tank, dt: number) {
  const factor = dt / 16.6667
  e.aiTurnTimer -= dt

  const player = state.player
  const ecx = e.x + e.size / 2
  const ecy = e.y + e.size / 2
  const pcx = player.x + player.size / 2
  const pcy = player.y + player.size / 2

  // Decide direction periodically
  if (e.aiTurnTimer <= 0) {
    e.aiTurnTimer = 700 + Math.random() * 1400
    const acc = e.accuracy ?? 0.5
    if (Math.random() < acc) {
      // aim toward player on the dominant axis
      if (Math.abs(pcx - ecx) > Math.abs(pcy - ecy)) {
        e.dir = pcx > ecx ? "right" : "left"
      } else {
        e.dir = pcy > ecy ? "down" : "up"
      }
    } else {
      const dirs: Dir[] = ["up", "down", "left", "right"]
      e.dir = dirs[Math.floor(Math.random() * 4)]
    }
  }

  const moved = moveTank(state, e, e.dir, e.speed * factor)
  if (!moved) {
    // blocked: turn soon
    e.aiTurnTimer = Math.min(e.aiTurnTimer, 60)
  }

  // Shooting: when roughly aligned with player, or random chance
  const aligned =
    (Math.abs(pcx - ecx) < TILE * 0.8 &&
      ((e.dir === "up" && pcy < ecy) || (e.dir === "down" && pcy > ecy))) ||
    (Math.abs(pcy - ecy) < TILE * 0.8 &&
      ((e.dir === "left" && pcx < ecx) || (e.dir === "right" && pcx > ecx)))
  if (e.cooldown <= 0 && (aligned || Math.random() < 0.012)) {
    fire(state, e)
  }
}

function damageTank(state: GameState, tank: Tank, amount: number) {
  tank.hp -= amount
  const cx = tank.x + tank.size / 2
  const cy = tank.y + tank.size / 2
  if (tank.hp <= 0) {
    spawnExplosion(state, cx, cy, tank.isPlayer ? "#f59e0b" : "#fb923c", 24)
  } else {
    spawnExplosion(state, cx, cy, "#fde68a", 6)
  }
}

export function update(state: GameState, dtRaw: number, input: Input) {
  if (state.phase !== "playing") return
  const dt = Math.min(dtRaw, 50) // clamp to avoid tunneling on lag
  const factor = dt / 16.6667

  // timer
  state.timeLeft -= dt
  if (state.timeLeft <= 0) {
    state.timeLeft = 0
    // survival win: player still alive when time expires
    state.phase = state.player.hp > 0 ? "won" : "lost"
    return
  }

  // cooldowns / boosts
  const p = state.player
  if (p.cooldown > 0) p.cooldown -= dt
  if (p.speedBoost > 0) p.speedBoost -= dt
  if (p.strongShot > 0) p.strongShot -= dt
  for (const e of state.enemies) if (e.cooldown > 0) e.cooldown -= dt

  // player movement
  let pdir: Dir | null = null
  if (input.up) pdir = "up"
  else if (input.down) pdir = "down"
  else if (input.left) pdir = "left"
  else if (input.right) pdir = "right"
  if (pdir) {
    p.dir = pdir
    const sp = (PLAYER_SPEED + (p.speedBoost > 0 ? 1.4 : 0)) * (input.boost ? 1.8 : 1)
    moveTank(state, p, pdir, sp * factor)
  }
  if (input.fire) fire(state, p)

  // enemy AI
  for (const e of state.enemies) {
    if (e.hp <= 0) continue
    updateAI(state, e, dt)
  }

  // bullets
  const liveBullets: Bullet[] = []
  for (const b of state.bullets) {
    const [dx, dy] = dirToVec(b.dir)
    const steps = Math.max(1, Math.ceil((b.speed * factor) / 4))
    const stepDist = (b.speed * factor) / steps
    let dead = false
    for (let s = 0; s < steps && !dead; s++) {
      b.x += dx * stepDist
      b.y += dy * stepDist

      // out of bounds
      if (b.x < 0 || b.y < 0 || b.x > WIDTH || b.y > HEIGHT) {
        dead = true
        break
      }
      // tile collision
      const col = Math.floor((b.x + 3) / TILE)
      const row = Math.floor((b.y + 3) / TILE)
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        const code = state.grid[row][col]
        if (code === BRICK) {
          state.grid[row][col] = EMPTY
          spawnExplosion(state, col * TILE + TILE / 2, row * TILE + TILE / 2, "#a16207", 8)
          dead = true
          break
        } else if (code === STEEL) {
          spawnExplosion(state, b.x, b.y, "#cbd5e1", 4)
          dead = true
          break
        }
      }
      // tank collision
      if (b.fromPlayer) {
        for (const e of state.enemies) {
          if (e.hp <= 0) continue
          if (tanksOverlap({ x: b.x - 3, y: b.y - 3, size: 6 }, e)) {
            damageTank(state, e, b.power)
            if (e.hp <= 0) {
              state.kills++
              state.score += 100
            }
            dead = true
            break
          }
        }
      } else {
        if (p.hp > 0 && tanksOverlap({ x: b.x - 3, y: b.y - 3, size: 6 }, p)) {
          damageTank(state, p, b.power)
          dead = true
          break
        }
      }
    }
    if (!dead) liveBullets.push(b)
  }
  state.bullets = liveBullets

  // remove dead enemies
  state.enemies = state.enemies.filter((e) => e.hp > 0)

  // power-ups spawn + pickup + expire
  state.powerupTimer -= dt
  if (state.powerupTimer <= 0) {
    state.powerupTimer = POWERUP_INTERVAL
    if (state.powerups.length < 3) spawnPowerUp(state)
  }
  const remainingPowerups: PowerUp[] = []
  for (const pu of state.powerups) {
    pu.life -= dt
    if (pu.life <= 0) continue
    // pickup
    if (
      p.hp > 0 &&
      pu.x > p.x &&
      pu.x < p.x + p.size &&
      pu.y > p.y &&
      pu.y < p.y + p.size
    ) {
      if (pu.kind === "heal") p.hp = Math.min(p.maxHp, p.hp + 2)
      else if (pu.kind === "speed") p.speedBoost = 6000
      else if (pu.kind === "power") p.strongShot = 7000
      state.score += 25
      spawnExplosion(state, pu.x, pu.y, "#84cc16", 10)
      continue
    }
    remainingPowerups.push(pu)
  }
  state.powerups = remainingPowerups

  // particles
  const liveParticles = []
  for (const pt of state.particles) {
    pt.life -= dt
    if (pt.life <= 0) continue
    pt.x += pt.vx * factor
    pt.y += pt.vy * factor
    pt.vx *= 0.94
    pt.vy *= 0.94
    liveParticles.push(pt)
  }
  state.particles = liveParticles

  // win / lose
  if (p.hp <= 0) {
    state.phase = "lost"
  } else if (state.enemies.length === 0) {
    state.phase = "won"
    // time bonus
    state.score += Math.floor(state.timeLeft / 1000) * 5
  }
}
