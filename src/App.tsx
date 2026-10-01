import { useKeyboard } from './game/input/controls'
import { HUD } from './ui/HUD'
import { StartScreen } from './ui/StartScreen'
import { TouchControls } from './ui/TouchControls'
import { DragonPanel } from './ui/DragonPanel'
import { NestPanel } from './ui/NestPanel'
import { Toasts } from './ui/Toasts'
import { QuestPanel } from './ui/QuestPanel'
import { SettingsPanel } from './ui/SettingsPanel'
import { lazy, Suspense, useEffect, useState } from 'react'
import { initAudio, audioReady } from './audio/engine'
import { useGame } from './store/gameStore'

// the 3D world (trees, textures, shaders) loads as its own chunk behind a loading screen
const GameCanvas = lazy(() => import('./game/GameCanvas').then((m) => ({ default: m.GameCanvas })))

export default function App() {
  const [ready, setReady] = useState(false)
  useKeyboard()
  // mobile browsers suspend audio; any tap brings it back
  useEffect(() => {
    const wake = () => audioReady() && initAudio()
    window.addEventListener('pointerdown', wake)
    return () => window.removeEventListener('pointerdown', wake)
  }, [])
  const phase = useGame((s) => s.phase)
  const panel = useGame((s) => s.panel)
  return (
    <div className="relative h-full w-full">
      <Suspense fallback={null}>
        <GameCanvas onReady={() => setReady(true)} />
      </Suspense>
      {!ready && <LoadingScreen />}
      {phase === 'menu' ? (
        <StartScreen />
      ) : (
        <>
          <HUD />
          <TouchControls />
          {panel === 'dragons' && <DragonPanel />}
          {panel === 'nest' && <NestPanel />}
          {panel === 'quest' && <QuestPanel />}
          {panel === 'settings' && <SettingsPanel />}
          <Toasts />
        </>
      )}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-night text-white">
      <p className="font-display text-4xl font-extrabold tracking-[0.2em] text-ember sm:text-6xl">DRAGON</p>
      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/3 animate-[load_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-ember to-[#fde68a]" />
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.3em] text-white/45">Världen byggs…</p>
    </div>
  )
}
