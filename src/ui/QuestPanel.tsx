import { useState } from 'react'
import { useGame } from '../store/gameStore'
import { MISSIONS, SHOP } from '../systems/missions'
import { Icon, Sheet } from './components'

/** Hedda's stall: missions and the market. */
export function QuestPanel() {
  const [tab, setTab] = useState<'missions' | 'market'>('missions')
  const openPanel = useGame((s) => s.openPanel)
  const gold = useGame((s) => s.gold)
  return (
    <Sheet title="HEDDA · DRAKSTEN" onClose={() => openPanel(null)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
          {(
            [
              ['missions', 'Uppdrag'],
              ['market', 'Marknad'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg py-2 text-sm font-semibold transition ${tab === id ? 'bg-white/12 text-white' : 'text-white/50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <GoldChip amount={gold} />
      </div>
      {tab === 'missions' ? <Missions /> : <Market />}
    </Sheet>
  )
}

export function GoldChip({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fbbf24]/12 px-3 py-1.5 text-sm font-bold tabular-nums text-[#fde68a]">
      <span className="h-3.5 w-3.5 rounded-full bg-gradient-to-b from-[#fde68a] to-[#d97706] shadow-[inset_0_-1px_0_rgb(0_0_0/0.3)]" />
      {amount}
    </span>
  )
}

function Missions() {
  const completed = useGame((s) => s.completedMissions)
  const active = useGame((s) => s.activeMission)
  const fish = useGame((s) => s.inventory.fish)
  const { acceptMission, abandonMission, turnInMission } = useGame.getState()

  return (
    <div className="space-y-3">
      {MISSIONS.map((m) => {
        const done = completed.includes(m.id)
        const locked = !!m.requires && !completed.includes(m.requires)
        const isActive = active?.id === m.id
        return (
          <div
            key={m.id}
            className={`rounded-2xl p-4 ${isActive ? 'bg-[#67e8f9]/10 ring-1 ring-[#67e8f9]/40' : 'bg-white/5'} ${locked ? 'opacity-45' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-base font-bold">
                  {done && <span className="mr-1.5 text-[#4ade80]">✓</span>}
                  {m.title}
                </p>
                <p className="mt-1 text-sm text-white/65">{locked ? 'Klara tidigare uppdrag först.' : `"${m.pitch}"`}</p>
                {!locked && <p className="mt-2 text-xs font-semibold text-[#67e8f9]">Mål: {m.objective}</p>}
              </div>
              <div className="shrink-0 text-right">
                <GoldChip amount={m.reward.gold} />
                <p className="mt-1 text-[11px] text-white/50">+{m.reward.xp} XP</p>
              </div>
            </div>
            {!done && !locked && (
              <div className="mt-3 flex gap-2">
                {isActive ? (
                  <>
                    {m.deliver && (
                      <button
                        onClick={turnInMission}
                        disabled={fish < (m.deliver.fish ?? 0)}
                        className="flex-1 rounded-xl bg-gradient-to-b from-ember to-ember-deep py-2.5 text-sm font-bold text-night disabled:opacity-40"
                      >
                        Lämna {m.deliver.fish} silverfisk ({fish})
                      </button>
                    )}
                    <button onClick={abandonMission} className="rounded-xl bg-white/8 px-4 py-2.5 text-sm font-semibold text-white/70">
                      Avbryt
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => acceptMission(m.id)}
                    disabled={!!active}
                    className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-bold transition hover:bg-white/15 disabled:opacity-40"
                  >
                    {active ? 'Du har redan ett uppdrag' : 'Acceptera'}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Market() {
  const gold = useGame((s) => s.gold)
  const inventory = useGame((s) => s.inventory)
  const buy = useGame((s) => s.buy)
  return (
    <div className="space-y-2">
      {SHOP.map((item) => (
        <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/5">
            {item.kind === 'incubate' ? <Icon name="egg" className="h-6 w-6" /> : <Icon name={item.kind === 'berries' ? 'berry' : 'fish'} className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="text-xs text-white/55">
              {item.description}
              {item.kind !== 'incubate' && ` · du har ${inventory[item.kind]}`}
            </p>
          </div>
          <button
            onClick={() => buy(item.id)}
            disabled={gold < item.price}
            className="rounded-xl bg-gradient-to-b from-[#fde68a] to-[#f59e0b] px-4 py-2 text-sm font-bold text-night transition active:scale-95 disabled:opacity-35"
          >
            {item.price}
          </button>
        </div>
      ))}
      <p className="pt-2 text-center text-[11px] text-white/45">Tjäna guld genom uppdrag och ringbanan.</p>
    </div>
  )
}
