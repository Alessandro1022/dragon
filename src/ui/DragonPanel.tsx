import { useGame } from '../store/gameStore'
import { ELEMENTS, RARITY_COLORS, TRAITS } from '../systems/genetics'
import { FOOD, nextStage, TRAIN_LABELS, view, type FoodKind, type TrainStat } from '../systems/dragons'
import { Badge, Bar, DragonPortrait, Icon, Sheet } from './components'

const STAT_COLORS: Record<TrainStat, string> = {
  strength: '#f87171',
  speed: '#60a5fa',
  stamina: '#4ade80',
  firepower: '#fb923c',
}

export function DragonPanel() {
  const dragons = useGame((s) => s.dragons)
  const selectedId = useGame((s) => s.selectedDragonId)
  const activeId = useGame((s) => s.activeDragonId)
  const companionId = useGame((s) => s.companionId)
  const inventory = useGame((s) => s.inventory)
  const eggs = useGame((s) => s.eggStash.length + (s.nestEgg ? 1 : 0))
  const { openPanel, feed, train, play, setCompanion, setActive } = useGame.getState()

  const selected = dragons.find((d) => d.id === selectedId) ?? dragons[0]
  const v = view(selected)
  const next = nextStage(selected)
  const el = ELEMENTS[v.pheno.element]
  const isActive = selected.id === activeId
  const isCompanion = selected.id === companionId

  return (
    <Sheet title="DINA DRAKAR" onClose={() => openPanel(null)}>
      {/* roster */}
      <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {dragons.map((d) => {
          const dv = view(d)
          const sel = d.id === selected.id
          return (
            <button
              key={d.id}
              onClick={() => openPanel('dragons', d.id)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-3 text-left transition ${
                sel ? 'bg-white/12 ring-1 ring-ember/70' : 'bg-white/5 hover:bg-white/8'
              }`}
            >
              <DragonPortrait genome={d.genome} size={40} scale={dv.stage.scale} />
              <div>
                <p className="text-sm font-semibold leading-tight">{d.name}</p>
                <p className="text-[11px] text-white/55">
                  {d.id === activeId ? 'Riddrake' : d.id === companionId ? 'Följer dig' : dv.stage.label}
                </p>
              </div>
            </button>
          )
        })}
        <div className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-dashed border-white/15 px-3 text-xs text-white/50">
          <Icon name="egg" /> {eggs} ägg
        </div>
      </div>

      {/* identity */}
      <div className="flex items-center gap-4">
        <div className="rounded-3xl bg-white/5 p-1">
          <DragonPortrait genome={selected.genome} size={104} scale={v.stage.scale} />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-2xl font-extrabold tracking-wide">{selected.name}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge color={RARITY_COLORS[v.rarity]}>{v.rarity}</Badge>
            <Badge color={el.color}>{el.label}</Badge>
            <Badge color="#cbd5e1">{v.stage.label}</Badge>
            {selected.genome.generation > 0 && <Badge color="#cbd5e1">Gen {selected.genome.generation}</Badge>}
          </div>
          {v.pheno.traits.length > 0 && (
            <p className="mt-2 text-xs text-white/65">
              {v.pheno.traits.map((t) => TRAITS[t].label).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* growth */}
      <div className="mt-5">
        <Bar
          label={next ? `Växer till ${next.label.toLowerCase()}` : 'Fullvuxen'}
          right={next ? `${Math.floor(selected.xp)} / ${next.xp} XP` : `${Math.floor(selected.xp)} XP`}
          value={next ? selected.xp : 1}
          max={next ? next.xp : 1}
          color="linear-gradient(90deg,#f5b041,#fde68a)"
        />
      </div>

      {/* needs */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Bar label="Mättnad" right={Math.round(selected.hunger)} value={selected.hunger} color={selected.hunger < 20 ? '#ef4444' : '#f59e0b'} />
        <Bar label="Band" right={Math.round(selected.bond)} value={selected.bond} color="#f472b6" />
        <Bar label="Energi" right={Math.round(selected.energy)} value={selected.energy} color="#38bdf8" />
      </div>

      {/* care */}
      <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Ta hand om</p>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(FOOD) as FoodKind[]).map((k) => (
          <ActionButton key={k} onClick={() => feed(selected.id, k)} disabled={inventory[k] <= 0}>
            <Icon name={k === 'berries' ? 'berry' : 'fish'} className="h-5 w-5" />
            <span>Mata {FOOD[k].label.toLowerCase()}</span>
            <span className="text-[10px] text-white/50">{inventory[k]} kvar</span>
          </ActionButton>
        ))}
        <ActionButton onClick={() => play(selected.id)}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#f472b6">
            <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" />
          </svg>
          <span>Lek</span>
          <span className="text-[10px] text-white/50">+ band</span>
        </ActionButton>
      </div>

      {/* stats + training */}
      <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Egenskaper · tryck för att träna</p>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(TRAIN_LABELS) as TrainStat[]).map((k) => (
          <button
            key={k}
            onClick={() => train(selected.id, k)}
            className="rounded-2xl bg-white/5 p-3 text-left transition hover:bg-white/8 active:scale-[0.98]"
          >
            <Bar label={TRAIN_LABELS[k]} right={v.stats[k].toFixed(1)} value={v.stats[k]} max={20} color={STAT_COLORS[k]} />
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-white/45">Träning kostar 25 energi. Hungriga drakar lär sig hälften så snabbt.</p>

      {/* role */}
      <div className="mt-5 flex gap-2">
        {isActive ? (
          <div className="flex-1 rounded-xl bg-ember/15 py-3 text-center text-sm font-semibold text-ember">Din riddrake</div>
        ) : v.stage.rideable ? (
          <button onClick={() => setActive(selected.id)} className="flex-1 rounded-xl bg-gradient-to-b from-ember to-ember-deep py-3 text-sm font-bold text-night">
            Rid den här draken
          </button>
        ) : null}
        {!isActive &&
          (isCompanion ? (
            <button onClick={() => setCompanion(null)} className="flex-1 rounded-xl bg-white/8 py-3 text-sm font-semibold">
              Lämna i nästet
            </button>
          ) : (
            <button onClick={() => setCompanion(selected.id)} className="flex-1 rounded-xl bg-white/8 py-3 text-sm font-semibold">
              Låt den följa mig
            </button>
          ))}
      </div>
    </Sheet>
  )
}

function ActionButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl bg-white/5 px-2 py-3 text-center text-xs font-semibold transition hover:bg-white/8 active:scale-[0.97] ${
        disabled ? 'opacity-45' : ''
      }`}
    >
      {children}
    </button>
  )
}
