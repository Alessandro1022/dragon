import { GameCanvas } from './game/GameCanvas'
import { useKeyboard } from './game/input/controls'
import { HUD } from './ui/HUD'
import { StartScreen } from './ui/StartScreen'
import { TouchControls } from './ui/TouchControls'
import { DragonPanel } from './ui/DragonPanel'
import { NestPanel } from './ui/NestPanel'
import { Toasts } from './ui/Toasts'
import { QuestPanel } from './ui/QuestPanel'
import { SettingsPanel } from './ui/SettingsPanel'
import { useEffect } from 'react'
import { initAudio, audioReady } from './audio/engine'
import { useGame } from './store/gameStore'

export default function App() {
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
      <GameCanvas />
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
