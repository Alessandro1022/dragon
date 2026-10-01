import { useGame, selectCompanion } from '../store/gameStore'
import { COURSE } from '../game/world/Rings'
import { performAction } from '../game/interaction'
import { view } from '../systems/dragons'
import { DragonPortrait, Icon } from './components'
import { Minimap } from './Minimap'

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
  const inventory = useGame((s) => s.inventory)
  const openPanel = useGame((s) => s.openPanel)
  const hatchReady = useGame((s) => s.hatchReady)
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <div className="glass flex items-center gap-3 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums">
          <span className="flex items-center gap-1">
            <Icon name="berry" /> {inventory.berries}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="fish" /> {inventory.fish}
          </span>
        </div>
        <button
          onClick={() => openPanel('dragons')}
          className="glass pointer-events-auto relative grid h-10 w-10 place-items-center rounded-full text-ember transition active:scale-95"
          aria-label="Dina drakar"
        >
          <Icon name="dragon" className="h-5 w-5" />
          {hatchReady && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-ember shadow-[0_0_10px_#f5b041]" />}
        </button>
      </div>
      <StaminaBar />
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">Ägget i nästet</p>
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
        <p className="mt-2 text-sm text-white/70">{best === courseTime ? 'Nytt rekord!' : `Rekord: ${best?.toFixed(1)}s`} · +2 silverfisk, +40 XP</p>
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
