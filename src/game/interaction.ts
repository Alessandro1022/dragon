import * as THREE from 'three'
import { useGame, selectActive } from '../store/gameStore'
import { flight, FLIGHT } from './dragon/flightState'
import { player, placePlayerNear } from './player/playerState'
import { NEST } from './world/worldSpots'
import { terrainHeight, surfaceHeight } from './world/terrainHeight'

const nestPos = new THREE.Vector3(...NEST)
const tmp = new THREE.Vector3()

export const MOUNT_RANGE = 10
export const NEST_RANGE = 7.5
export const LAND_ALTITUDE = 18

/** Works out what the context action (E / action button) would do right now. */
export function updatePrompt() {
  const s = useGame.getState()
  if (s.phase !== 'playing' || s.panel) return s.setPrompt(null)
  const dragon = selectActive(s)

  if (s.mode === 'walking') {
    tmp.subVectors(player.position, flight.position).setY(0)
    const dDragon = tmp.length()
    const dNest = player.position.distanceTo(nestPos)
    if (dNest < NEST_RANGE && dNest < dDragon) {
      return s.setPrompt({ label: s.hatchReady ? 'Kläck ägget' : s.nestEgg ? 'Öppna nästet' : 'Nästet', action: 'nest' })
    }
    if (dDragon < MOUNT_RANGE && dragon) {
      return s.setPrompt({ label: `Kliv upp på ${dragon.name}`, action: 'mount' })
    }
    return s.setPrompt(null)
  }

  const alt = flight.position.y - surfaceHeight(flight.position.x, flight.position.z)
  const overLand = terrainHeight(flight.position.x, flight.position.z) > 1
  if (alt < LAND_ALTITUDE && overLand) return s.setPrompt({ label: 'Landa', action: 'dismount' })
  s.setPrompt(null)
}

export function performAction() {
  const s = useGame.getState()
  const p = s.prompt
  if (!p) return
  switch (p.action) {
    case 'mount':
      flight.takeoff = 1.1
      flight.speed = FLIGHT.minSpeed + 14
      flight.pitch = 0.35
      flight.stamina = 1
      flight.position.y += 1
      s.setMode('flying')
      break
    case 'dismount':
      placePlayerNear(
        new THREE.Vector3(flight.position.x, terrainHeight(flight.position.x, flight.position.z), flight.position.z),
        flight.yaw,
      )
      player.position.y = terrainHeight(player.position.x, player.position.z)
      flight.speed = FLIGHT.minSpeed
      s.setMode('walking')
      break
    case 'nest':
      s.openPanel('nest')
      break
    default:
      break
  }
}
