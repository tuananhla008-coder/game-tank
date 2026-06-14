"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createGame, type Input, update } from "@/lib/game/engine"
import { render } from "@/lib/game/render"
import type { GameState, MapDef, Phase } from "@/lib/game/types"
import { HEIGHT, WIDTH } from "@/lib/game/types"
import { Heart, Pause, Play, Target, Timer, Zap } from "lucide-react"

interface Props {
  map: MapDef
  onEnd: (result: { phase: Phase; score: number; kills: number }) => void
  onQuit: () => void
}

interface Hud {
  hp: number
  maxHp: number
  score: number
  kills: number
  total: number
  time: number
  boost: boolean
  power: boolean
}

const KEY_MAP: Record<string, keyof Input> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  Space: "fire",
  ShiftLeft: "boost",
  ShiftRight: "boost",
}

export function GameCanvas({ map, onEnd, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState | null>(null)
  const inputRef = useRef<Input>({
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
    boost: false,
  })
  const touchRef = useRef<Partial<Input>>({})
  const rafRef = useRef<number>(0)
  const lastRef = useRef<number>(0)
  const pausedRef = useRef(false)
  const endedRef = useRef(false)

  const [paused, setPaused] = useState(false)
  const [hud, setHud] = useState<Hud>({
    hp: 5,
    maxHp: 5,
    score: 0,
    kills: 0,
    total: map.enemyCount,
    time: 180_000,
    boost: false,
    power: false,
  })

  // (re)initialize game when map changes
  useEffect(() => {
    stateRef.current = createGame(map)
    endedRef.current = false
    lastRef.current = 0
    pausedRef.current = false
    setPaused(false)
  }, [map])

  const togglePause = useCallback(() => {
    setPaused((p) => {
      pausedRef.current = !p
      return !p
    })
  }, [])

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "KeyP") {
        togglePause()
        return
      }
      const action = KEY_MAP[e.code]
      if (action) {
        e.preventDefault()
        inputRef.current[action] = true
      }
    }
    const up = (e: KeyboardEvent) => {
      const action = KEY_MAP[e.code]
      if (action) {
        e.preventDefault()
        inputRef.current[action] = false
      }
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [togglePause])

  // game loop
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    let hudCounter = 0

    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop)
      const state = stateRef.current
      if (!state) return
      if (lastRef.current === 0) lastRef.current = t
      const dt = t - lastRef.current
      lastRef.current = t

      if (!pausedRef.current) {
        const merged: Input = {
          up: inputRef.current.up || !!touchRef.current.up,
          down: inputRef.current.down || !!touchRef.current.down,
          left: inputRef.current.left || !!touchRef.current.left,
          right: inputRef.current.right || !!touchRef.current.right,
          fire: inputRef.current.fire || !!touchRef.current.fire,
          boost: inputRef.current.boost || !!touchRef.current.boost,
        }
        update(state, dt, merged)
      }

      render(ctx, state, t)

      hudCounter += dt
      if (hudCounter > 90) {
        hudCounter = 0
        setHud({
          hp: Math.max(0, state.player.hp),
          maxHp: state.player.maxHp,
          score: state.score,
          kills: state.kills,
          total: state.totalEnemies,
          time: state.timeLeft,
          boost: state.player.speedBoost > 0,
          power: state.player.strongShot > 0,
        })
      }

      if (state.phase !== "playing" && !endedRef.current) {
        endedRef.current = true
        onEnd({ phase: state.phase, score: state.score, kills: state.kills })
      }
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [onEnd])

  const setTouch = (key: keyof Input, val: boolean) => {
    touchRef.current[key] = val
  }

  const mins = Math.floor(hud.time / 60000)
  const secs = Math.floor((hud.time % 60000) / 1000)
  const lowTime = hud.time < 30000

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {/* HUD */}
      <div className="flex w-full max-w-[684px] flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-1.5" aria-label="Player health">
          <Heart className="size-4 text-primary" aria-hidden />
          <div className="flex gap-1">
            {Array.from({ length: hud.maxHp }).map((_, i) => (
              <span
                key={i}
                className={`h-3 w-2.5 rounded-[1px] ${i < hud.hp ? "bg-primary" : "bg-secondary"}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <Target className="size-4 text-destructive" aria-hidden />
          <span className="font-mono">
            {hud.total - hud.kills} LEFT
          </span>
        </div>

        <div
          className={`flex items-center gap-1.5 font-mono text-xs ${lowTime ? "text-destructive" : "text-foreground"}`}
        >
          <Timer className="size-4" aria-hidden />
          <span>
            {mins}:{secs.toString().padStart(2, "0")}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-accent">
          <Zap className="size-4" aria-hidden />
          <span className="font-mono">{hud.score}</span>
        </div>

        <button
          onClick={togglePause}
          className="flex items-center gap-1 rounded-sm border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground transition-colors hover:bg-muted"
          aria-label={paused ? "Resume game" : "Pause game"}
        >
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </button>
      </div>

      {/* active buff badges */}
      {(hud.boost || hud.power) && (
        <div className="flex gap-2 text-[10px]">
          {hud.boost && (
            <span className="rounded-sm bg-chart-4/20 px-2 py-0.5 text-chart-4">SPEED BOOST</span>
          )}
          {hud.power && (
            <span className="rounded-sm bg-accent/20 px-2 py-0.5 text-accent">POWER SHOT</span>
          )}
        </div>
      )}

      {/* Canvas */}
      <div className="relative w-full max-w-[684px]">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full rounded-sm border-2 border-border bg-[#15180f] [image-rendering:pixelated]"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        />
        {paused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-sm bg-background/80 backdrop-blur-sm">
            <p className="font-heading text-lg text-primary">PAUSED</p>
            <div className="flex gap-2">
              <button
                onClick={togglePause}
                className="rounded-sm bg-primary px-4 py-2 font-mono text-sm text-primary-foreground transition-transform hover:scale-105"
              >
                RESUME
              </button>
              <button
                onClick={onQuit}
                className="rounded-sm border border-border bg-secondary px-4 py-2 font-mono text-sm text-secondary-foreground transition-colors hover:bg-muted"
              >
                QUIT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Touch controls */}
      <div className="flex w-full max-w-[684px] select-none items-center justify-between gap-4 md:hidden">
        <div className="grid grid-cols-3 grid-rows-3 gap-1">
          <span />
          <TouchBtn label="▲" onDown={() => setTouch("up", true)} onUp={() => setTouch("up", false)} />
          <span />
          <TouchBtn label="◀" onDown={() => setTouch("left", true)} onUp={() => setTouch("left", false)} />
          <span />
          <TouchBtn label="▶" onDown={() => setTouch("right", true)} onUp={() => setTouch("right", false)} />
          <span />
          <TouchBtn label="▼" onDown={() => setTouch("down", true)} onUp={() => setTouch("down", false)} />
          <span />
        </div>
        <div className="flex flex-col gap-2">
          <button
            className="flex size-16 items-center justify-center rounded-full bg-destructive font-heading text-xs text-foreground active:scale-95"
            onPointerDown={() => setTouch("fire", true)}
            onPointerUp={() => setTouch("fire", false)}
            onPointerLeave={() => setTouch("fire", false)}
            aria-label="Fire"
          >
            FIRE
          </button>
          <button
            className="flex size-12 items-center justify-center rounded-full bg-chart-4 font-mono text-[10px] text-background active:scale-95"
            onPointerDown={() => setTouch("boost", true)}
            onPointerUp={() => setTouch("boost", false)}
            onPointerLeave={() => setTouch("boost", false)}
            aria-label="Boost"
          >
            BOOST
          </button>
        </div>
      </div>

      <p className="hidden text-center font-mono text-[11px] leading-relaxed text-muted-foreground md:block">
        MOVE: WASD / ARROWS · FIRE: SPACE · BOOST: SHIFT · PAUSE: P
      </p>
    </div>
  )
}

function TouchBtn({
  label,
  onDown,
  onUp,
}: {
  label: string
  onDown: () => void
  onUp: () => void
}) {
  return (
    <button
      className="flex size-12 items-center justify-center rounded-sm border border-border bg-secondary text-secondary-foreground active:bg-primary active:text-primary-foreground"
      onPointerDown={(e) => {
        e.preventDefault()
        onDown()
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      aria-label={label}
    >
      {label}
    </button>
  )
}
