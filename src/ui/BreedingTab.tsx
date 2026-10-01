import { useMemo, useState } from 'react'
import { useGame } from '../store/gameStore'
import { ELEMENTS, TRAITS, forecast } from '../systems/genetics'
import { BREED_COST, breedCooldownLeft, STAGES, TRAIN_LABELS, view, type DragonData } from '../systems/dragons'
import { DragonPortrait, Icon } from './components'

/** Pair two adult dragons, see the genetic odds, and lay an egg. */
export function BreedingTab() {
  const dragons = useGame((s) => s.dragons)
  const fish = useGame((s) => s.inventory.fish)
  const breedDragons = useGame((s) => s.breedDragons)
  const adults = dragons.filter((d) => view(d).stage.rideable)
  const [a, setA] = useState<string | null>(adults[0]?.id ?? null)
  const [b, setB] = useState<string | null>(adults[1]?.id ?? null)

  const pa = dragons.find((d) => d.id === a) ?? null
  const pb = dragons.find((d) => d.id === b) ?? null
  const odds = useMemo(() => (pa && pb ? forecast(pa.genome, pb.genome) : null), [pa, pb])

  if (adults.length < 2) {
    const closest = dragons
      .filter((d) => !view(d).stage.rideable)
      .sort((x, y) => y.xp - x.xp)[0]
    return (
      <div className="py-2 text-center">
        <p className="font-display text-lg font-bold">Avel kräver två vuxna drakar</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/65">
          Ungen ärver en gen från varje förälder. Föd upp en till drake till vuxen ålder så kan du para dem här.
        </p>
        {closest && (
          <div className="mx-auto mt-5 flex max-w-xs items-center gap-3 rounded-2xl bg-white/5 p-3 text-left">
            <DragonPortrait genome={closest.genome} size={48} scale={view(closest).stage.scale} />
            <div className="flex-1">
              <p className="text-sm font-semibold">{closest.name}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-ember" style={{ width: `${(closest.xp / STAGES[3].xp) * 100}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-white/50">
                {Math.floor(closest.xp)} / {STAGES[3].xp} XP till vuxen
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  const wait = pa && pb ? Math.max(breedCooldownLeft(pa), breedCooldownLeft(pb)) : 0
  const canBreed = pa && pb && pa.id !== pb.id && wait === 0 && fish >= BREED_COST.fish

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ParentPicker label="Förälder 1" value={a} options={adults} onChange={setA} exclude={b} />
        <span className="font-display text-2xl text-ember">+</span>
        <ParentPicker label="Förälder 2" value={b} options={adults} onChange={setB} exclude={a} />
      </div>

      {odds && (
        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Element</p>
            <div className="flex h-7 overflow-hidden rounded-full">
              {odds.elements.map((e) => (
                <div
                  key={e.element}
                  className="flex items-center justify-center text-[11px] font-bold text-night"
                  style={{ width: `${e.chance * 100}%`, background: ELEMENTS[e.element].color }}
                >
                  {ELEMENTS[e.element].label} {Math.round(e.chance * 100)}%
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Ärvda egenskaper (gen-spann)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {(Object.keys(odds.stats) as (keyof typeof odds.stats)[]).map((k) => {
                const [lo, hi] = odds.stats[k]
                return (
                  <div key={k}>
                    <div className="flex justify-between text-[11px] text-white/70">
                      <span>{TRAIN_LABELS[k]}</span>
                      <span className="tabular-nums text-white/50">
                        {lo.toFixed(1)}–{hi.toFixed(1)}
                      </span>
                    </div>
                    <div className="relative mt-1 h-1.5 rounded-full bg-white/10">
                      <div className="absolute h-full rounded-full bg-ember" style={{ left: `${lo * 10}%`, width: `${Math.max(2, (hi - lo) * 10)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Sällsynta drag</p>
            {odds.traits.length === 0 ? (
              <p className="text-sm text-white/50">Inga dolda drag som båda föräldrarna bär på.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {odds.traits.map((t) => (
                  <span key={t.trait} className="rounded-full bg-[#fbbf24]/12 px-3 py-1 text-xs font-semibold text-[#fde68a]">
                    {TRAITS[t.trait].label} · {Math.round(t.chance * 100)}%
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        disabled={!canBreed}
        onClick={() => a && b && breedDragons(a, b)}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-ember to-ember-deep py-3.5 font-display font-extrabold tracking-[0.15em] text-night transition disabled:opacity-40"
      >
        PARA · {BREED_COST.fish} <Icon name="fish" className="h-5 w-5" />
      </button>
      <p className="mt-2 text-center text-[11px] text-white/45">
        {wait > 0
          ? `Föräldrarna vilar ${Math.ceil(wait / 60000)} min till.`
          : fish < BREED_COST.fish
            ? `Du har ${fish} silverfisk. Fånga fler genom att flyga lågt över havet.`
            : 'Ägget hamnar i nästet, eller sparas om nästet är upptaget.'}
      </p>
    </div>
  )
}

function ParentPicker({
  label,
  value,
  options,
  onChange,
  exclude,
}: {
  label: string
  value: string | null
  options: DragonData[]
  onChange: (id: string) => void
  exclude: string | null
}) {
  const current = options.find((d) => d.id === value)
  const cycle = () => {
    const pool = options.filter((d) => d.id !== exclude)
    if (!pool.length) return
    const i = pool.findIndex((d) => d.id === value)
    onChange(pool[(i + 1) % pool.length].id)
  }
  return (
    <button onClick={cycle} className="flex flex-col items-center rounded-2xl bg-white/5 p-3 transition hover:bg-white/8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{label}</p>
      {current ? (
        <>
          <DragonPortrait genome={current.genome} size={72} />
          <p className="text-sm font-semibold">{current.name}</p>
          <p className="text-[11px] text-white/50">{ELEMENTS[view(current).pheno.element].label} · tryck för att byta</p>
        </>
      ) : (
        <p className="py-6 text-sm text-white/50">Välj</p>
      )}
    </button>
  )
}
