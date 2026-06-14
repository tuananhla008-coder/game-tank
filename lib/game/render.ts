import {
  BRICK,
  COLS,
  type Dir,
  type GameState,
  HEIGHT,
  ROWS,
  STEEL,
  type Tank,
  TILE,
  TREE,
  WATER,
  WIDTH,
} from "./types"

function roundedTank(ctx: CanvasRenderingContext2D, t: Tank, body: string, tread: string, barrel: string) {
  const { x, y, size, dir } = t
  // treads
  ctx.fillStyle = tread
  if (dir === "left" || dir === "right") {
    ctx.fillRect(x, y, size, 4)
    ctx.fillRect(x, y + size - 4, size, 4)
  } else {
    ctx.fillRect(x, y, 4, size)
    ctx.fillRect(x + size - 4, y, 4, size)
  }
  // body
  ctx.fillStyle = body
  ctx.fillRect(x + 4, y + 4, size - 8, size - 8)
  // turret
  const cx = x + size / 2
  const cy = y + size / 2
  ctx.fillStyle = barrel
  ctx.beginPath()
  ctx.arc(cx, cy, size / 4.5, 0, Math.PI * 2)
  ctx.fill()
  // barrel
  ctx.fillStyle = barrel
  const bw = 4
  const bl = size / 2 + 3
  switch (dir as Dir) {
    case "up":
      ctx.fillRect(cx - bw / 2, cy - bl, bw, bl)
      break
    case "down":
      ctx.fillRect(cx - bw / 2, cy, bw, bl)
      break
    case "left":
      ctx.fillRect(cx - bl, cy - bw / 2, bl, bw)
      break
    case "right":
      ctx.fillRect(cx, cy - bw / 2, bl, bw)
      break
  }
}

function hpBar(ctx: CanvasRenderingContext2D, t: Tank) {
  if (t.hp >= t.maxHp) return
  const w = t.size
  const ratio = Math.max(0, t.hp / t.maxHp)
  ctx.fillStyle = "rgba(0,0,0,0.6)"
  ctx.fillRect(t.x, t.y - 6, w, 3)
  ctx.fillStyle = t.isPlayer ? "#84cc16" : "#f87171"
  ctx.fillRect(t.x, t.y - 6, w * ratio, 3)
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  // battlefield base
  ctx.fillStyle = "#15180f"
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.03)"
  ctx.lineWidth = 1
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath()
    ctx.moveTo(c * TILE, 0)
    ctx.lineTo(c * TILE, HEIGHT)
    ctx.stroke()
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath()
    ctx.moveTo(0, r * TILE)
    ctx.lineTo(WIDTH, r * TILE)
    ctx.stroke()
  }

  // tiles (draw water and steel and brick; trees drawn later on top of tanks)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const code = state.grid[r][c]
      const x = c * TILE
      const y = r * TILE
      if (code === BRICK) {
        ctx.fillStyle = "#7c2d12"
        ctx.fillRect(x, y, TILE, TILE)
        ctx.fillStyle = "#9a3412"
        const bw = TILE / 2
        const bh = TILE / 4
        for (let by = 0; by < 4; by++) {
          for (let bx = 0; bx < 2; bx++) {
            const off = by % 2 === 0 ? 0 : bw / 2
            ctx.fillRect(x + bx * bw + off + 1, y + by * bh + 1, bw - 2, bh - 2)
          }
        }
      } else if (code === STEEL) {
        ctx.fillStyle = "#475569"
        ctx.fillRect(x, y, TILE, TILE)
        ctx.fillStyle = "#94a3b8"
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6)
        ctx.fillStyle = "#64748b"
        ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16)
      } else if (code === WATER) {
        ctx.fillStyle = "#0c4a6e"
        ctx.fillRect(x, y, TILE, TILE)
        ctx.fillStyle = "#0ea5e9"
        const wob = Math.sin(time / 400 + (c + r)) * 2
        ctx.fillRect(x + 4, y + TILE / 3 + wob, TILE - 8, 2)
        ctx.fillRect(x + 6, y + (2 * TILE) / 3 - wob, TILE - 14, 2)
      }
    }
  }

  // power-ups
  for (const pu of state.powerups) {
    const blink = pu.life < 3000 && Math.floor(time / 150) % 2 === 0
    if (blink) continue
    const r = 11
    ctx.fillStyle = "rgba(0,0,0,0.5)"
    ctx.fillRect(pu.x - r, pu.y - r, r * 2, r * 2)
    ctx.fillStyle = pu.kind === "heal" ? "#22c55e" : pu.kind === "speed" ? "#38bdf8" : "#f59e0b"
    ctx.fillRect(pu.x - r + 2, pu.y - r + 2, r * 2 - 4, r * 2 - 4)
    ctx.fillStyle = "#0b0d08"
    ctx.font = "bold 12px monospace"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const label = pu.kind === "heal" ? "+" : pu.kind === "speed" ? "S" : "P"
    ctx.fillText(label, pu.x, pu.y + 1)
  }

  // player
  if (state.player.hp > 0) {
    roundedTank(ctx, state.player, "#65a30d", "#3f6212", "#bef264")
    hpBar(ctx, state.player)
    if (state.player.strongShot > 0 || state.player.speedBoost > 0) {
      ctx.strokeStyle = state.player.strongShot > 0 ? "#f59e0b" : "#38bdf8"
      ctx.lineWidth = 2
      ctx.strokeRect(state.player.x - 2, state.player.y - 2, state.player.size + 4, state.player.size + 4)
    }
  }

  // enemies
  for (const e of state.enemies) {
    roundedTank(ctx, e, "#b91c1c", "#7f1d1d", "#fca5a5")
    hpBar(ctx, e)
  }

  // bullets
  for (const b of state.bullets) {
    ctx.fillStyle = b.fromPlayer ? "#fef08a" : "#fca5a5"
    ctx.fillRect(b.x - 2, b.y - 2, 6, 6)
    ctx.fillStyle = b.fromPlayer ? "#fde047" : "#ef4444"
    ctx.fillRect(b.x - 1, b.y - 1, 3, 3)
  }

  // particles
  for (const pt of state.particles) {
    const a = Math.max(0, pt.life / pt.maxLife)
    ctx.globalAlpha = a
    ctx.fillStyle = pt.color
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size)
  }
  ctx.globalAlpha = 1

  // trees on top (hide tanks beneath)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.grid[r][c] !== TREE) continue
      const x = c * TILE
      const y = r * TILE
      ctx.fillStyle = "#14532d"
      ctx.fillRect(x, y, TILE, TILE)
      ctx.fillStyle = "#166534"
      for (let i = 0; i < 5; i++) {
        const px = x + 4 + ((i * 11) % (TILE - 8))
        const py = y + 4 + ((i * 17) % (TILE - 8))
        ctx.beginPath()
        ctx.arc(px, py, 5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = "#22c55e"
      ctx.beginPath()
      ctx.arc(x + TILE / 2, y + TILE / 2, 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
