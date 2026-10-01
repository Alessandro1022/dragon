import { useState } from 'react'
import { useGame, type Quality } from '../store/gameStore'
import { Sheet } from './components'

const QUALITIES: [Quality, string][] = [
  ['low', 'Låg'],
  ['medium', 'Medel'],
  ['high', 'Hög'],
]

/** Pause menu: graphics, sound, controls and starting over. */
export function SettingsPanel() {
  const settings = useGame((s) => s.settings)
  const { updateSettings, openPanel, resetProgress } = useGame.getState()
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <Sheet title="PAUS" onClose={() => openPanel(null)}>
      <button
        onClick={() => openPanel(null)}
        className="mb-5 w-full rounded-xl bg-gradient-to-b from-ember to-ember-deep py-3 font-display font-extrabold tracking-[0.18em] text-night"
      >
        FORTSÄTT
      </button>

      <Section title="Grafik">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1">
          {QUALITIES.map(([q, label]) => (
            <button
              key={q}
              onClick={() => updateSettings({ quality: q, autoQuality: false })}
              className={`rounded-lg py-2 text-sm font-semibold transition ${settings.quality === q ? 'bg-white/12 text-white' : 'text-white/50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Toggle label="Anpassa automatiskt efter enheten" on={settings.autoQuality} onChange={(v) => updateSettings({ autoQuality: v })} />
      </Section>

      <Section title="Ljud">
        <label className="flex items-center gap-3 text-sm">
          <span className="w-16 text-white/70">Volym</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
            className="flex-1 accent-[#f5b041]"
          />
          <span className="w-10 text-right tabular-nums text-white/55">{Math.round(settings.volume * 100)}%</span>
        </label>
        <Toggle label="Musik" on={settings.music} onChange={(v) => updateSettings({ music: v })} />
      </Section>

      <Section title="Styrning">
        <Toggle label="Invertera upp/ner i luften" on={settings.invertPitch} onChange={(v) => updateSettings({ invertPitch: v })} />
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-white/60">
          <span>W/S – fram / stig, dyk</span>
          <span>A/D – sväng</span>
          <span>Space – hoppa / flaxa</span>
          <span>Shift – spring / boost</span>
          <span>F – eld</span>
          <span>E – agera</span>
          <span>I – dina drakar</span>
          <span>Esc – paus</span>
        </div>
      </Section>

      <Section title="Spelet">
        {confirmReset ? (
          <div className="rounded-xl bg-red-500/10 p-3 text-sm">
            <p className="text-red-200">Allt sparat försvinner: drakar, ägg, guld och uppdrag.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => resetProgress()} className="flex-1 rounded-lg bg-red-500/80 py-2 font-semibold">
                Ja, börja om
              </button>
              <button onClick={() => setConfirmReset(false)} className="flex-1 rounded-lg bg-white/10 py-2 font-semibold">
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} className="w-full rounded-xl bg-white/5 py-2.5 text-sm font-semibold text-white/70">
            Börja om från början
          </button>
        )}
      </Section>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className="flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 text-sm">
      <span className="text-white/80">{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-ember' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}
