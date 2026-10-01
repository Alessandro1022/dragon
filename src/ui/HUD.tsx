import { useGame } from '../store/gameStore'
import { COURSE } from '../game/world/Rings'

export function HUD() {
  const t = useGame((s) => s.telemetry)
  const collected = useGame((s) => s.collected)
  const courseStart = useGame((s) => s.courseStart)
  const courseTime = useGame((s) => s.courseTime)
  const resetCourse = useGame((s) => s.resetCourse)

  const total = COURSE.length
  const elapsed = courseTime ?? (courseStart ? (performance.now() - courseStart) / 1000 : 0)
  const kmh = Math.round(t.speed * 3.6)
  const done = courseTime !== null

  return (
    <div className="pointer-events-none absolute inset-0 select-none p-4 text-white" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
      {/* course progress */}
      <div className="glass inline-flex items-center gap-4 rounded-2xl px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/55">Ringar</p>
          <p className="font-display text-2xl font-extrabold leading-none text-ember">
            {collected.length}
            <span className="text-base text-white/50">/{total}</span>
          </p>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/55">Tid</p>
          <p className="font-mono text-xl font-semibold leading-none tabular-nums">{elapsed.toFixed(1)}s</p>
        </div>
      </div>

      {/* speed & altitude */}
      <div className="absolute bottom-6 right-4 hidden text-right sm:block">
        <Gauge label="Fart" value={kmh} unit="km/h" />
        <Gauge label="Höjd" value={Math.max(0, Math.round(t.altitude))} unit="m" />
      </div>

      {/* stamina */}
      <div className="absolute right-4 top-4 w-36 sm:bottom-8 sm:left-1/2 sm:right-auto sm:top-auto sm:w-72 sm:-translate-x-1/2" style={{ marginTop: 'env(safe-area-inset-top)' }}>
        <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-[0.25em] text-white/60">
          <span className="hidden sm:inline">Uthållighet</span>
          <span className="ml-auto tabular-nums sm:hidden">{kmh} km/h</span>
        </div>
        <div className="glass h-2.5 overflow-hidden rounded-full p-0">
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

      {done && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-night/40">
          <div className="glass rise w-full max-w-xs rounded-3xl p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-ember">Banan klar</p>
            <p className="mt-2 font-display text-5xl font-extrabold">{courseTime!.toFixed(1)}s</p>
            <p className="mt-2 text-sm text-white/70">Alla tolv ringar. Klarar du det snabbare?</p>
            <button
              onClick={resetCourse}
              className="mt-5 w-full rounded-xl bg-gradient-to-b from-ember to-ember-deep py-3 font-display font-extrabold tracking-[0.18em] text-night active:scale-[0.98]"
            >
              KÖR IGEN
            </button>
          </div>
        </div>
      )}
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
