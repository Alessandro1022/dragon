import * as THREE from 'three'
import { useGame } from '../store/gameStore'
import { flight } from './dragon/flightState'
import { player } from './player/playerState'

/** Where the camera's attention is: the rider on foot, or the dragon in flight. */
export function focusPosition(): THREE.Vector3 {
  const s = useGame.getState()
  return s.phase === 'playing' && s.mode === 'walking' ? player.position : flight.position
}
