import { GameCanvas } from './game/GameCanvas'
import { useKeyboard } from './game/input/controls'
import { HUD } from './ui/HUD'
import { StartScreen } from './ui/StartScreen'
import { TouchControls } from './ui/TouchControls'
import { useGame } from './store/gameStore'

export default function App() {
  useKeyboard()
  const phase = useGame((s) => s.phase)
  return (
    <div className="relative h-full w-full">
      <GameCanvas />
      {phase === 'menu' ? <StartScreen /> : (
        <>
          <HUD />
          <TouchControls />
        </>
      )}
    </div>
  )
}
