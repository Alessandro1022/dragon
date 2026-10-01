import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { initCloud } from './lib/cloud'

initCloud()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// dev-only handle for debugging and automated playtests
if (import.meta.env.DEV) {
  Promise.all([import('./store/gameStore'), import('./game/player/playerState'), import('./game/dragon/flightState'), import('./game/world/time')]).then(
    ([store, p, f, t]) => {
      ;(window as unknown as Record<string, unknown>).__dragon = { useGame: store.useGame, player: p.player, flight: f.flight, time: t.worldTime }
    },
  )
}
