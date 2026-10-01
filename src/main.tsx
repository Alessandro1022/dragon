import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { initCloud } from './lib/cloud'

initCloud()

const root = createRoot(document.getElementById('root')!)
if (import.meta.env.DEV && location.search.includes('lab')) {
  void import('./dev/DragonLab').then(({ DragonLab }) => root.render(<DragonLab />))
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// dev-only handle for debugging and automated playtests
if (import.meta.env.DEV) {
  Promise.all([import('./store/gameStore'), import('./game/player/playerState'), import('./game/dragon/flightState'), import('./game/world/time'), import('./game/world/Environment')]).then(
    ([store, p, f, t, e]) => {
      ;(window as unknown as Record<string, unknown>).__dragon = { useGame: store.useGame, player: p.player, flight: f.flight, time: t.worldTime, light: e.debugLight }
    },
  )
}
