import { useGame } from '../store/gameStore'

const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export function StartScreen() {
  const start = useGame((s) => s.start)
  const hasProgress = useGame((s) => s.dragons.length > 1 || (s.nestEgg?.progress ?? 0) > 0)
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between bg-gradient-to-b from-night/70 via-transparent to-night/85 px-4 pb-10 pt-[12vh] text-white">
      <div className="text-center">
        <p className="rise text-xs font-semibold uppercase tracking-[0.45em] text-ember/90">Kapitel I · Drakväktaren</p>
        <h1
          className="rise mt-3 font-display text-6xl font-extrabold tracking-[0.12em] text-transparent sm:text-8xl"
          style={{
            animationDelay: '0.1s',
            backgroundImage: 'linear-gradient(180deg, #fff7e0 0%, #f5b041 55%, #c2410c 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 6px 24px rgb(194 65 12 / 0.45))',
          }}
        >
          DRAGON
        </h1>
        <p className="rise mx-auto mt-4 max-w-md text-sm text-white/75 sm:text-base" style={{ animationDelay: '0.2s' }}>
          Kläck ägget i nästet, föd upp din drake och flyg till Draksten. Där väntar uppdrag, ett kungligt kläckeri och Drakgardet.
        </p>
      </div>

      <div className="rise flex w-full max-w-sm flex-col items-center gap-5" style={{ animationDelay: '0.35s' }}>
        <button
          onClick={start}
          className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-ember to-ember-deep px-8 py-4 font-display text-lg font-extrabold tracking-[0.2em] text-night shadow-[0_10px_40px_rgb(194_65_12/0.55)] transition active:scale-[0.98]"
        >
          <span className="relative z-10">{hasProgress ? 'FORTSÄTT' : 'SPELA'}</span>
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        </button>

        <div className="glass w-full rounded-2xl p-4 text-xs text-white/80">
          {isTouch ? (
            <ul className="grid grid-cols-2 gap-2">
              <li><b className="text-white">Vänster spak</b> styr</li>
              <li><b className="text-white">Guldknappen</b> agera</li>
              <li><b className="text-white">Boost</b> fart + eld</li>
              <li><b className="text-white">ELD</b> sprut eld</li>
            </ul>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              <li><Key>W</Key><Key>S</Key> fram / stig</li>
              <li><Key>A</Key><Key>D</Key> sväng</li>
              <li><Key>Space</Key> hoppa / flaxa</li>
              <li><Key>Shift</Key> spring / boost</li>
              <li><Key>E</Key> kliv upp / landa / prata</li>
              <li><Key>F</Key> eld (i luften)</li>
              <li><Key>I</Key> dina drakar</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mr-1 inline-block min-w-6 rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-center font-sans text-[11px] font-semibold text-white">
      {children}
    </kbd>
  )
}
