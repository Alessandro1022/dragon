import * as THREE from 'three'
import { useGame } from '../store/gameStore'
import { missionById } from '../systems/missions'
import { COURSE } from './world/Rings'
import { QUEST_GIVER, WILD_EGG_SPOTS, HATCHERY, CAMP } from './world/worldSpots'
import { flight } from './dragon/flightState'
import { player } from './player/playerState'
import { heat } from './heat'

/** World position of the active mission's next objective, or null. */
export function missionTarget(out: THREE.Vector3): THREE.Vector3 | null {
  const s = useGame.getState()
  const def = s.activeMission && missionById(s.activeMission.id)
  if (!def) return null
  switch (def.waypoint) {
    case 'ring': {
      const ring = COURSE[s.collected.length] ?? COURSE[0]
      return out.set(...ring.position)
    }
    case 'questGiver': {
      const need = def.deliver?.fish ?? 0
      // until you have the goods there's nowhere specific to go
      if (s.inventory.fish < need) return null
      return out.set(...QUEST_GIVER)
    }
    case 'wildEgg': {
      const me = s.mode === 'flying' ? flight.position : player.position
      let best: THREE.Vector3 | null = null
      let bestD = Infinity
      WILD_EGG_SPOTS.forEach((p, i) => {
        if (s.foundWildEggs.includes(i)) return
        const d = Math.hypot(p[0] - me.x, p[2] - me.z)
        if (d < bestD) {
          bestD = d
          best = out.set(p[0], p[1], p[2])
        }
      })
      return best
    }
    case 'hatchery':
      if (heat.heist || s.royalEggDay === s.day) return null
      return out.set(HATCHERY[0], HATCHERY[1], HATCHERY[2] + 3)
    case 'camp':
      return out.set(CAMP.x, CAMP.y, CAMP.z)
    default:
      return null
  }
}

/** One-line HUD objective, with live progress where it helps. */
export function objectiveText(): string | null {
  const s = useGame.getState()
  const def = s.activeMission && missionById(s.activeMission.id)
  if (!def) return null
  if (def.heatHint && heat.heist && heat.level > 0) return def.heatHint
  if (def.deliver?.fish) {
    return s.inventory.fish >= def.deliver.fish
      ? 'Ta silverfisken till Hedda i Draksten'
      : `Fånga silverfisk: ${s.inventory.fish}/${def.deliver.fish}`
  }
  if (def.goal && def.goal.amount > 1) {
    const done = s.counters[def.goal.counter] - s.activeMission!.baseline
    return `${def.objective} (${Math.min(done, def.goal.amount)}/${def.goal.amount})`
  }
  return def.objective
}
