"use client"

import { useState } from "react"
import { GameCanvas } from "@/components/game-canvas"
import { MAPS } from "@/lib/game/maps"
import type { MapDef, Phase } from "@/lib/game/types"
import { ChevronRight, Crosshair, Droplets, Trees, Brackets, Skull, Trophy } from "lucide-react"

type Screen = "menu" | "select" | "play" | "result"

interface Result {
  phase: Phase
  score: number
  kills: number
}

const MAP_ICONS = [Crosshair, Brackets, Droplets, Trees, Skull]

export function TankGame() {
  const [screen, setScreen] = useState<Screen>("menu")
  const [map, setMap] = useState<MapDef>(MAPS[0])
  const [result, setResult] = useState<Result | null>(null)

  const start = (m: MapDef) => {
    setMap(m)
    setResult(null)
    setScreen("play")
  }

  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        {screen === "menu" && <MenuScreen onStart={() => setScreen("select")} />}

        {screen === "select" && (
          <SelectScreen onPick={start} onBack={() => setScreen("menu")} />
        )}

        {screen === "play" && (
          <GameCanvas
            map={map}
            onEnd={(r) => {
              setResult(r)
              setScreen("result")
            }}
            onQuit={() => setScreen("select")}
          />
        )}

        {screen === "result" && result && (
          <ResultScreen
            result={result}
            map={map}
            onReplay={() => start(map)}
            onMenu={() => setScreen("select")}
          />
        )}
      </div>
    </main>
  )
}

function MenuScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="rounded-sm border border-border bg-card px-3 py-1 font-mono text-[10px] tracking-widest text-primary">
          ARCADE · 1P vs AI
        </span>
        <h1 className="font-heading text-3xl leading-tight text-primary text-balance sm:text-5xl">
          IRON ASSAULT
        </h1>
        <p className="max-w-md font-mono text-sm leading-relaxed text-muted-foreground text-pretty">
          Command your tank across 5 battlefields. Smash through brick, dodge steel, ford the rivers and hunt every
          enemy before they get you.
        </p>
      </div>

      <button
        onClick={onStart}
        className="group flex items-center gap-2 rounded-sm bg-primary px-8 py-4 font-heading text-sm text-primary-foreground transition-transform hover:scale-105"
      >
        START
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
      </button>

      <div className="grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-3">
        <InfoCard title="MOVE" lines={["WASD / Arrow keys", "Shift to boost"]} />
        <InfoCard title="FIRE" lines={["Space to shoot", "Break brick, not steel"]} />
        <InfoCard title="WIN" lines={["Destroy all enemies", "Or outlast 3:00"]} />
      </div>
    </div>
  )
}

function InfoCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <p className="mb-2 font-heading text-[11px] text-accent">{title}</p>
      <ul className="space-y-1 font-mono text-xs text-muted-foreground">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

function SelectScreen({
  onPick,
  onBack,
}: {
  onPick: (m: MapDef) => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg text-primary">SELECT MAP</h2>
        <button
          onClick={onBack}
          className="rounded-sm border border-border bg-secondary px-3 py-1.5 font-mono text-xs text-secondary-foreground transition-colors hover:bg-muted"
        >
          BACK
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MAPS.map((m, i) => {
          const Icon = MAP_ICONS[i] ?? Crosshair
          return (
            <button
              key={m.id}
              onClick={() => onPick(m)}
              className="group flex flex-col gap-3 rounded-sm border border-border bg-card p-4 text-left transition-colors hover:border-primary"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-sm bg-secondary text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-heading text-[11px] text-muted-foreground">MAP {m.id}</p>
                    <p className="font-mono text-sm text-foreground">{m.name}</p>
                  </div>
                </div>
                <Difficulty level={i + 1} />
              </div>
              <p className="font-mono text-xs leading-relaxed text-muted-foreground text-pretty">
                {m.description}
              </p>
              <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Skull className="size-3.5 text-destructive" /> {m.enemyCount} tanks
                </span>
                <span className="flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  DEPLOY <ChevronRight className="size-3.5" />
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Difficulty({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`Difficulty ${level} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`h-3 w-1.5 rounded-[1px] ${i < level ? "bg-accent" : "bg-secondary"}`}
        />
      ))}
    </span>
  )
}

function ResultScreen({
  result,
  map,
  onReplay,
  onMenu,
}: {
  result: Result
  map: MapDef
  onReplay: () => void
  onMenu: () => void
}) {
  const won = result.phase === "won"
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span
        className={`flex size-20 items-center justify-center rounded-full ${won ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}
      >
        {won ? <Trophy className="size-10" /> : <Skull className="size-10" />}
      </span>
      <div className="flex flex-col gap-2">
        <h2 className={`font-heading text-3xl ${won ? "text-primary" : "text-destructive"}`}>
          {won ? "VICTORY" : "DESTROYED"}
        </h2>
        <p className="font-mono text-sm text-muted-foreground">
          {won ? `You cleared ${map.name}!` : `Your tank fell on ${map.name}.`}
        </p>
      </div>

      <div className="grid w-full max-w-xs grid-cols-2 gap-3">
        <Stat label="SCORE" value={result.score.toString()} />
        <Stat label="KILLS" value={`${result.kills}/${map.enemyCount}`} />
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReplay}
          className="rounded-sm bg-primary px-6 py-3 font-heading text-xs text-primary-foreground transition-transform hover:scale-105"
        >
          RETRY
        </button>
        <button
          onClick={onMenu}
          className="rounded-sm border border-border bg-secondary px-6 py-3 font-heading text-xs text-secondary-foreground transition-colors hover:bg-muted"
        >
          MAPS
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <p className="font-heading text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl text-accent">{value}</p>
    </div>
  )
}
