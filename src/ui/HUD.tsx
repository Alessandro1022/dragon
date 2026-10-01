import { useGame, selectCompanion } from '../store/gameStore'
import { COURSE } from '../game/world/Rings'
import { performAction } from '../game/interaction'
import { view } from '../systems/dragons'
import { DragonPortrait, Icon } from './components'
import { Minimap } from './Minimap'
import { Leaderboard } from './Leaderboard'
import { objectiveText, missionTarget } from '../game/missionTarget'
import { flight } from '../game/dragon/flightState'
import { player } from '../game/player/playerState'
import * as THREE from 'three'
import { useEffect, useState } from 'react'

const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export function HUD() {
  const mode = useGame((s) => s.mode)
  const prompt = useGame((s) => s.prompt)
  const panel = useGame((s) => s.panel)
  return (
    <div className="pointer-events-none absolute inset-0 select-none p-4 text-white" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col items-start gap-3">
          {mode === 'flying' ? <CourseCard /> : <CompanionCard />}
          {isTouch && <Minimap />}
        </div>
        <TopRight />
      </div>
      {!isTouch && (
        <div className="absolute bottom-5 left-5">
          <Minimap />
        </div>
      )}
      {mode === 'flying' && <FlightGauges />}
      <Objective />
      {prompt && !panel && !isTouch && (
        <button
          onClick={performAction}
          className="glass rise pointer-events-auto absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full py-2 pl-2 pr-5 text-sm font-semibold"
        >
          <kbd className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-b from-ember to-ember-deep font-display text-sm font-extrabold text-night">E</kbd>
          {prompt.label}
        </button>
      )}
      <CourseComplete />
    </div>
  )
}

function TopRight() {
  const openPanel = useGame((s) => s.openPanel)
  const hatchReady = useGame((s) => s.hatchReady)
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <span className="hidden sm:flex">
          <Wallet />
        </span>
        <button
          onClick={() => openPanel('settings')}
          className="glass pointer-events-auto grid h-10 w-10 place-items-center rounded-full text-white/80 transition active:scale-95"
          aria-label="Paus och inställningar"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        </button>
        <button
          onClick={() => openPanel('dragons')}
          className="glass pointer-events-auto relative grid h-10 w-10 place-items-center rounded-full text-ember transition active:scale-95"
          aria-label="Dina drakar"
        >
          <Icon name="dragon" className="h-5 w-5" />
          {hatchReady && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-ember shadow-[0_0_10px_#f5b041]" />}
        </button>
      </div>
      <span className="sm:hidden">
        <Wallet />
      </span>
      <WantedStars />
      <RidersOnline />
      <StaminaBar />
    </div>
  )
}

function RidersOnline() {
  const n = useGame((s) => s.ridersOnline)
  if (n < 2) return null
  return (
    <div className="glass flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white/80">
      <span className="h-2 w-2 rounded-full bg-[#4ade80] shadow-[0_0_8px_#4ade80]" />
      {n} ryttare online
    </div>
  )
}

/** Gold, berries and fish in one compact pill. */
function Wallet() {
  const inventory = useGame((s) => s.inventory)
  const gold = useGame((s) => s.gold)
  return (
    <div className="glass flex items-center gap-3 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums">
      <span className="flex items-center gap-1 text-[#fde68a]">
        <span className="h-3.5 w-3.5 rounded-full bg-gradient-to-b from-[#fde68a] to-[#d97706]" /> {gold}
      </span>
      <span className="flex items-center gap-1">
        <Icon name="berry" /> {inventory.berries}
      </span>
      <span className="flex items-center gap-1">
        <Icon name="fish" /> {inventory.fish}
      </span>
    </div>
  )
}

function WantedStars() {
  const heat = useGame((s) => s.heat)
  const close = useGame((s) => s.guardsClose)
  if (heat === 0) return null
  return (
    <div className={`glass flex items-center gap-1 rounded-full px-3 py-1.5 ${close ? 'animate-pulse ring-1 ring-red-400/70' : ''}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="h-4 w-4">
          <path
            d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z"
            fill={i < heat ? '#fbbf24' : 'rgb(255 255 255 / 0.15)'}
            stroke={i < heat ? '#b45309' : 'none'}
            strokeWidth="1"
          />
        </svg>
      ))}
    </div>
  )
}

const objPos = new THREE.Vector3()

/** Active mission objective with distance, polled at 4 Hz. */
function Objective() {
  const active = useGame((s) => s.activeMission)
  const [info, setInfo] = useState<{ text: string | null; dist: number | null }>({ text: null, dist: null })
  useEffect(() => {
    const tick = () => {
      const text = objectiveText()
      const t = missionTarget(objPos)
      const me = useGame.getState().mode === 'flying' ? flight.position : player.position
      setInfo({ text, dist: t ? Math.round(Math.hypot(t.x - me.x, t.z - me.z)) : null })
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [active])
  if (!info.text) return null
  return (
    <div className="absolute left-1/2 top-[4.5rem] w-[min(92vw,26rem)] -translate-x-1/2 sm:top-5">
      <div className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rotate-45 bg-[#67e8f9] shadow-[0_0_10px_#67e8f9]" />
        <p className="flex-1 text-sm font-semibold leading-snug">{info.text}</p>
        {info.dist !== null && <span className="text-xs font-semibold tabular-nums text-[#67e8f9]">{info.dist} m</span>}
      </div>
    </div>
  )
}

function StaminaBar() {
  const mode = useGame((s) => s.mode)
  const t = useGame((s) => s.telemetry)
  if (mode !== 'flying') return null
  return (
    <div className="w-36 sm:w-48">
      <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
        <span className="hidden sm:inline">Uthållighet</span>
        <span className="ml-auto tabular-nums sm:hidden">{Math.round(t.speed * 3.6)} km/h</span>
      </div>
      <div className="glass h-2.5 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-[width] duration-100"
          style={{
            width: `${t.stamina * 100}%`,
            background: t.stamina < 0.25 ? 'linear-gradient(90deg,#ef4444,#f97316)' : 'linear-gradient(90deg,#f5b041,#fde68a)',
            boxShadow: t.boosting ? '0 0 14px #f5b041' : undefined,
          }}
        />
      </div>
    </div>
  )
}

function CompanionCard() {
  const companion = useGame(selectCompanion)
  const openPanel = useGame((s) => s.openPanel)
  const egg = useGame((s) => s.nestEgg)
  const ready = useGame((s) => s.hatchReady)
  if (!companion) {
    if (!egg) return <div />
    return (
      <div className="glass flex items-center gap-3 rounded-2xl px-3 py-2">
        <Icon name="egg" className="h-6 w-6" />
        <div>
          <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">Ägget i nästet</p>
          <p className="text-sm font-semibold">{ready ? 'Redo att kläckas!' : `${Math.floor(egg.progress * 100)}% ruvat`}</p>
        </div>
      </div>
    )
  }
  const v = view(companion)
  return (
    <button
      onClick={() => openPanel('dragons', companion.id)}
      className="glass pointer-events-auto flex items-center gap-2.5 rounded-2xl py-1.5 pl-1.5 pr-4 text-left"
    >
      <DragonPortrait genome={companion.genome} size={44} scale={v.stage.scale} />
      <div className="w-28">
        <p className="text-sm font-semibold leading-tight">{companion.name}</p>
        <p className="text-[10px] text-white/55">{v.stage.label}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${companion.hunger}%`, background: companion.hunger < 20 ? '#ef4444' : '#f59e0b' }} />
        </div>
      </div>
    </button>
  )
}

function CourseCard() {
  const collected = useGame((s) => s.collected)
  const courseStart = useGame((s) => s.courseStart)
  const courseTime = useGame((s) => s.courseTime)
  const best = useGame((s) => s.bestCourseTime)
  useGame((s) => s.telemetry) // re-render ~10 Hz for the clock
  const elapsed = courseTime ?? (courseStart ? (performance.now() - courseStart) / 1000 : 0)
  return (
    <div className="glass inline-flex items-center gap-4 rounded-2xl px-4 py-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/55">Ringar</p>
        <p className="font-display text-2xl font-extrabold leading-none text-ember">
          {collected.length}
          <span className="text-base text-white/50">/{COURSE.length}</span>
        </p>
      </div>
      <div className="h-8 w-px bg-white/10" />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/55">Tid</p>
        <p className="font-mono text-xl font-semibold leading-none tabular-nums">{elapsed.toFixed(1)}s</p>
        {best !== null && <p className="mt-0.5 text-[10px] text-white/45">Bäst {best.toFixed(1)}s</p>}
      </div>
    </div>
  )
}

function FlightGauges() {
  const t = useGame((s) => s.telemetry)
  return (
    <div className="absolute bottom-6 right-4 hidden text-right sm:block">
      <Gauge label="Fart" value={Math.round(t.speed * 3.6)} unit="km/h" />
      <Gauge label="Höjd" value={Math.max(0, Math.round(t.altitude))} unit="m" />
    </div>
  )
}

function CourseComplete() {
  const courseTime = useGame((s) => s.courseTime)
  const best = useGame((s) => s.bestCourseTime)
  const resetCourse = useGame((s) => s.resetCourse)
  if (courseTime === null) return null
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-night/40">
      <div className="glass rise w-full max-w-xs rounded-3xl p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-ember">Banan klar</p>
        <p className="mt-2 font-display text-5xl font-extrabold">{courseTime.toFixed(1)}s</p>
        <p className="mt-2 text-sm text-white/70">{best === courseTime ? 'Nytt rekord!' : `Rekord: ${best?.toFixed(1)}s`} · +25 guld, +2 silverfisk, +40 XP</p>
        <Leaderboard time={courseTime} />
        <button
          onClick={resetCourse}
          className="mt-5 w-full rounded-xl bg-gradient-to-b from-ember to-ember-deep py-3 font-display font-extrabold tracking-[0.18em] text-night active:scale-[0.98]"
        >
          KÖR IGEN
        </button>
      </div>
    </div>
  )
}

function Gauge({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="mb-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/55">{label}</p>
      <p className="font-display text-3xl font-extrabold leading-none tabular-nums drop-shadow">
        {value}
        <span className="ml-1 font-sans text-xs font-semibold text-white/60">{unit}</span>
      </p>
    </div>
  )
}
