import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { useGame, type Quality } from '../store/gameStore'

const ORDER: Quality[] = ['low', 'medium', 'high']

/**
 * Watches the frame rate during play and steps graphics quality down when
 * the device can't keep up (Chromebooks, older phones). Only active while
 * the player hasn't picked a quality by hand.
 */
export function AutoQuality() {
  const frames = useRef(0)
  const elapsed = useRef(0)
  const settle = useRef(0)

  useFrame((_, dt) => {
    const s = useGame.getState()
    if (s.phase !== 'playing' || !s.settings.autoQuality) return
    // ignore the first seconds after start / a change while shaders compile
    settle.current += dt
    if (settle.current < 4) return
    frames.current++
    elapsed.current += dt
    if (elapsed.current < 3) return
    const fps = frames.current / elapsed.current
    frames.current = 0
    elapsed.current = 0
    const i = ORDER.indexOf(s.settings.quality)
    if (fps < 28 && i > 0) {
      s.updateSettings({ quality: ORDER[i - 1] })
      s.toast(`Grafiken sänktes till ${ORDER[i - 1] === 'low' ? 'låg' : 'medel'} för bättre flyt.`)
      settle.current = 0
    }
  })
  return null
}
