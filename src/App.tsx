import { GameCanvas } from './game/GameCanvas'
import { useKeyboard } from './game/input/controls'
import { HUD } from './ui/HUD'
import { StartScreen } from './ui/StartScreen'
import { TouchControls } from './ui/TouchControls'
import { DragonPanel } from './ui/DragonPanel'
import { NestPanel } from './ui/NestPanel'
import { Toasts } from './ui/Toasts'
import { QuestPanel } from './ui/QuestPanel'
import { useGame } from './store/gameStore'

export default function App() {
  useKeyboard()
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
          <Toasts />
        </>
      )}
    </div>
  )
}
