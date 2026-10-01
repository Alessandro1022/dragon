import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { useGame } from '../store/gameStore'
import { flight, FLIGHT } from '../game/dragon/flightState'
import { player } from '../game/player/playerState'
import { burst, chime, horn, noiseLoop, setMusicEnabled, setTension, setVolume, startMusic, audioReady, type Loop } from './engine'

/** Drives continuous sounds from game state and reacts to game events. */
export function AudioDirector() {
  const wind = useRef<Loop | null>(null)
  const fire = useRef<Loop | null>(null)
  const flapClock = useRef(0)
  const stepClock = useRef(0)
  const ready = useRef(false)

  // event sounds from store changes
  useEffect(() => {
    let lastToast = 0
    let lastHeat = 0
    let lastDragons = useGame.getState().dragons.length
    return useGame.subscribe((s) => {
      setVolume(s.settings.volume)
      setMusicEnabled(s.settings.music)
      const newest = s.toasts[s.toasts.length - 1]
      if (newest && newest.id !== lastToast) {
        lastToast = newest.id
        if (newest.text.startsWith('+')) chime([84, 91], { step: 0.06, level: 0.12, length: 0.35 })
        else if (newest.tone === 'gold') chime([72, 76, 79, 84], { step: 0.09, level: 0.14 })
        else if (newest.tone === 'warn') chime([52, 48], { step: 0.12, type: 'square', level: 0.06, length: 0.3 })
      }
      if (s.heat > lastHeat) horn()
      if (s.heat === 0 && lastHeat > 0) chime([67, 72, 76], { step: 0.12, level: 0.12 })
      lastHeat = s.heat
      setTension(s.heat > 0)
      if (s.dragons.length > lastDragons) chime([79, 83, 86, 91, 95], { step: 0.07, level: 0.12, length: 0.9 })
      lastDragons = s.dragons.length
    })
  }, [])

  useFrame((_, dt) => {
    if (!audioReady()) return
    if (!ready.current) {
      ready.current = true
      wind.current = noiseLoop('bandpass', 500, 0.6)
      fire.current = noiseLoop('lowpass', 900, 1.2)
      const st = useGame.getState().settings
      setVolume(st.volume)
      setMusicEnabled(st.music)
      startMusic()
    }
    const s = useGame.getState()
    const flying = s.phase === 'playing' && s.mode === 'flying'
    const k = (flight.speed - FLIGHT.minSpeed) / (FLIGHT.maxSpeed - FLIGHT.minSpeed)
    wind.current?.set(flying ? 0.05 + k * 0.28 : 0.02, 300 + k * 1400)
    fire.current?.set(flight.firing ? 0.38 + Math.random() * 0.12 : 0, 700 + Math.random() * 500)

    // wing beats
    if (flying && (flight.flapping || flight.boosting)) {
      flapClock.current += dt
      if (flapClock.current > 0.28) {
        flapClock.current = 0
        burst(180, 0.22, 0.35)
      }
    }
    // footsteps
    if (s.phase === 'playing' && s.mode === 'walking' && player.grounded && Math.abs(player.speed) > 1) {
      stepClock.current += dt
      if (stepClock.current > (player.running ? 0.27 : 0.42)) {
        stepClock.current = 0
        burst(1400 + Math.random() * 600, 0.07, 0.12, 'bandpass')
      }
    }
  })

  return null
}
