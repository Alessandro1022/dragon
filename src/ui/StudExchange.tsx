import { useEffect, useState } from 'react'
import { online } from '../lib/supabase'
import { breedWithStud, fetchStuds, listStud, unlistStud, type StudListing } from '../lib/cloud'
import { useGame } from '../store/gameStore'
import { view } from '../systems/dragons'
import { RARITY_COLORS, type Rarity } from '../systems/genetics'
import { DragonPortrait } from './components'
import { GoldChip } from './QuestPanel'

/** "Avelsbörsen": breed with other players' dragons, or offer yours for gold. */
export function StudExchange() {
  const account = useGame((s) => s.account)
  const dragons = useGame((s) => s.dragons)
  const adults = dragons.filter((d) => view(d).stage.rideable)
  const [listings, setListings] = useState<StudListing[] | null>(null)
  const [mine, setMine] = useState(adults[0]?.id ?? '')
  const [price, setPrice] = useState(120)
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = () => void fetchStuds().then(setListings)
  useEffect(refresh, [])

  if (!online) return <p className="py-6 text-center text-sm text-white/55">Avelsbörsen kräver att spelet är kopplat till servern.</p>
  if (!account?.username) return <p className="py-6 text-center text-sm text-white/55">Logga in och välj ett ryttarnamn i pausmenyn för att använda Avelsbörsen.</p>

  const myDragon = dragons.find((d) => d.id === mine)
  const others = (listings ?? []).filter((l) => l.owner_id !== account.userId)
  const myListings = (listings ?? []).filter((l) => l.owner_id === account.userId)

  return (
    <div className="space-y-5">
      {adults.length === 0 ? (
        <p className="text-sm text-white/55">Du behöver en vuxen drake för att använda börsen.</p>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
          {myDragon && <DragonPortrait genome={myDragon.genome} size={48} />}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Din drake</p>
            <select
              value={mine}
              onChange={(e) => setMine(e.target.value)}
              className="mt-0.5 w-full rounded-lg bg-white/5 px-2 py-1.5 text-sm font-semibold outline-none"
            >
              {adults.map((d) => (
                <option key={d.id} value={d.id} className="bg-[#141a2b]">
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Andra ryttares drakar</p>
        {!listings ? (
          <p className="text-sm text-white/50">Laddar…</p>
        ) : others.length === 0 ? (
          <p className="text-sm text-white/50">Inga drakar erbjuds just nu. Bli först!</p>
        ) : (
          <div className="space-y-2">
            {others.map((l) => (
              <div key={l.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5">
                <DragonPortrait genome={l.genome} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{l.dragon_name}</p>
                  <p className="truncate text-xs text-white/55">
                    {l.owner_name} · {l.element} ·{' '}
                    <span style={{ color: RARITY_COLORS[l.rarity as Rarity] }}>{l.rarity}</span>
                  </p>
                </div>
                <button
                  disabled={!myDragon}
                  onClick={async () => {
                    const r = await breedWithStud(l, mine)
                    setMsg(r.error)
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-ember to-ember-deep px-3 py-2 text-xs font-bold text-night disabled:opacity-40"
                >
                  Para · {l.price}
                </button>
              </div>
            ))}
          </div>
        )}
        {msg && <p className="mt-2 text-xs text-red-300">{msg}</p>}
      </div>

      {myDragon && (
        <div className="rounded-2xl bg-white/5 p-3">
          <p className="text-sm font-semibold">Erbjud {myDragon.name} för avel</p>
          <p className="mt-0.5 text-xs text-white/55">Andra betalar dig guld varje gång de parar sig med din drake.</p>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="range"
              min={20}
              max={1000}
              step={10}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="flex-1 accent-[#f5b041]"
            />
            <GoldChip amount={price} />
          </div>
          <button
            onClick={async () => {
              const r = await listStud(myDragon, price)
              setMsg(r.error)
              refresh()
            }}
            className="mt-3 w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold"
          >
            Lägg upp på börsen
          </button>
        </div>
      )}

      {myListings.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Dina erbjudanden</p>
          {myListings.map((l) => (
            <div key={l.id} className="mb-1.5 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
              <span>
                {l.dragon_name} · {l.price} guld
              </span>
              <button
                onClick={async () => {
                  await unlistStud(l.id)
                  refresh()
                }}
                className="text-xs text-white/60 underline"
              >
                Ta bort
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
