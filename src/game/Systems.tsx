import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useGame } from '../store/gameStore'
import { updatePrompt } from './interaction'
import { flight } from './dragon/flightState'
import { player } from './player/playerState'
import { NEST } from './world/worldSpots'

const nestPos = new THREE.Vector3(...NEST)

/** Seconds of play for an untended egg to hatch. */
export const INCUBATION_SECONDS = 240

/**
 * Game-rule tick: context prompts every frame; hunger, energy and egg
 * incubation once per second. The parked dragon warms the egg 3x faster
 * when it rests beside the nest; staying close yourself adds another 1.5x.
 */
export function Systems() {
  const acc = useRef(0)
  useFrame((_, dt) => {
    const s = useGame.getState()
    if (s.phase !== 'playing') return
    updatePrompt()

    acc.current += Math.min(dt, 0.25)
    if (acc.current < 1) return
    const seconds = acc.current
    acc.current = 0
    s.tickNeeds(seconds)

    if (s.nestEgg && !s.hatchReady) {
      let rate = 1
      if (s.mode === 'walking' && flight.position.distanceTo(nestPos) < 26) rate *= 3
      if (s.mode === 'walking' && player.position.distanceTo(nestPos) < 12) rate *= 1.5
      s.incubate((seconds * rate) / INCUBATION_SECONDS)
    }
  })
  return null
}

export function incubationRate(): { rate: number; dragonWarming: boolean; playerNear: boolean } {
  const s = useGame.getState()
  const dragonWarming = s.mode === 'walking' && flight.position.distanceTo(nestPos) < 26
  const playerNear = s.mode === 'walking' && player.position.distanceTo(nestPos) < 12
  return { rate: (dragonWarming ? 3 : 1) * (playerNear ? 1.5 : 1), dragonWarming, playerNear }
}
