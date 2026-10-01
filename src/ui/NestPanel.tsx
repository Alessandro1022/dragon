import { useEffect, useRef, useState } from 'react'
import { useGame, selectActive } from '../store/gameStore'
import { incubationRate, INCUBATION_SECONDS } from '../game/Systems'
import { dragonName } from '../systems/names'
import { EggIcon, Sheet, Bar } from './components'

export function NestPanel() {
  const egg = useGame((s) => s.nestEgg)
  const ready = useGame((s) => s.hatchReady)
  const stash = useGame((s) => s.eggStash)
  const active = useGame(selectActive)
  const { openPanel, incubate, hatch, placeEgg } = useGame.getState()
  const [name, setName] = useState(() => dragonName())
  const [rate, setRate] = useState(incubationRate())
  const lastWarm = useRef(0)
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setRate(incubationRate()), 500)
    return () => clearInterval(id)
  }, [])

  const warm = () => {
    const now = performance.now()
    if (now - lastWarm.current < 250) return
    lastWarm.current = now
    incubate(0.012)
    setPulse((p) => p + 1)
  }

  const remaining = egg ? Math.max(0, ((1 - egg.progress) * INCUBATION_SECONDS) / rate.rate) : 0

  return (
    <Sheet title="NÄSTET" onClose={() => openPanel(null)}>
      {!egg ? (
        <div className="py-4 text-center">
          <p className="font-display text-xl font-bold">Nästet är tomt</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/65">
            Vilda drakägg vilar på öns tre högsta toppar. Flyg mot ljuspelarna och snudda vid ägget för att ta det.
          </p>
          {stash.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Dina sparade ägg</p>
              <div className="flex justify-center gap-3">
                {stash.map((e) => (
                  <button key={e.id} onClick={() => placeEgg(e.id)} className="rounded-2xl bg-white/5 p-3 transition hover:bg-white/10">
                    <EggIcon genome={e.genome} size={48} />
                    <p className="mt-1 text-xs text-white/70">Lägg i nästet</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          <button
            onClick={ready ? undefined : warm}
            key={pulse}
            className="relative rounded-full p-4 transition active:scale-95"
            style={{ animation: pulse ? 'rise .35s ease-out' : undefined }}
            aria-label="Värm ägget"
          >
            <EggIcon genome={egg.genome} size={120} glow={egg.progress + (ready ? 0.6 : 0)} />
          </button>

          {ready ? (
            <div className="w-full max-w-sm">
              <p className="font-display text-xl font-extrabold text-ember">Ägget kläcks!</p>
              <p className="mt-1 text-sm text-white/65">Ge din nya drake ett namn.</p>
              <div className="mt-4 flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 18))}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base font-semibold text-white outline-none focus:border-ember/60"
                  placeholder="Namn"
                />
                <button onClick={() => setName(dragonName())} className="rounded-xl bg-white/8 px-3 text-sm font-semibold" aria-label="Slumpa namn">
                  ↻
                </button>
              </div>
              <button
                onClick={() => hatch(name)}
                className="mt-3 w-full rounded-xl bg-gradient-to-b from-ember to-ember-deep py-3.5 font-display font-extrabold tracking-[0.18em] text-night shadow-[0_8px_30px_rgb(194_65_12/0.5)]"
              >
                KLÄCK
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm">
              <Bar
                label="Ruvning"
                right={`${Math.floor(egg.progress * 100)}%`}
                value={egg.progress}
                max={1}
                color="linear-gradient(90deg,#f5b041,#fde68a)"
              />
              <p className="mt-2 text-xs text-white/55">
                Kläcks om ca {remaining > 90 ? `${Math.ceil(remaining / 60)} min` : `${Math.ceil(remaining)} s`} · tryck på ägget för att värma det
              </p>
              <div className="mt-4 space-y-2 text-left text-sm">
                <Hint on={rate.dragonWarming}>
                  {active?.name ?? 'Din drake'} vilar vid nästet och värmer ägget <b>×3</b>
                </Hint>
                <Hint on={rate.playerNear}>Du håller dig nära ägget <b>×1,5</b></Hint>
              </div>
              {!rate.dragonWarming && (
                <p className="mt-3 text-xs text-white/50">Landa med draken intill nästet så ruvar ägget mycket snabbare.</p>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

function Hint({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${on ? 'bg-ember/12 text-white' : 'bg-white/4 text-white/45'}`}>
      <span className={`h-2 w-2 rounded-full ${on ? 'bg-ember shadow-[0_0_8px_#f5b041]' : 'bg-white/20'}`} />
      <span>{children}</span>
    </div>
  )
}
