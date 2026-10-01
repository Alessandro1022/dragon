import * as THREE from 'three'
import { useGame } from '../store/gameStore'
import { missionById } from '../systems/missions'
import { COURSE } from './world/Rings'
import { QUEST_GIVER, WILD_EGG_SPOTS, HATCHERY, CAMP, NEST } from './world/worldSpots'
import { flight } from './dragon/flightState'
import { player } from './player/playerState'
import { heat } from './heat'

/**
 * First-session guidance when no mission is active: hatch the egg, then
 * head to Draksten to meet Hedda. Disappears once the story has started.
 */
function guide(): { text: string; target: [number, number, number] | null } | null {
  const s = useGame.getState()
  if (s.activeMission || s.completedMissions.length > 0) return null
  const hatched = s.dragons.length > 1
  if (!hatched && s.nestEgg && s.mode === 'walking') {
    return s.hatchReady
      ? { text: 'Ägget spricker! Gå till nästet och kläck det', target: NEST }
      : { text: 'Gå till nästet och värm ägget (E)', target: NEST }
  }
  return {
    text: s.mode === 'walking' ? 'Kliv upp på draken och flyg till Draksten' : 'Flyg till Draksten och prata med Hedda',
    target: QUEST_GIVER,
  }
}

/** World position of the active mission's next objective, or null. */
export function missionTarget(out: THREE.Vector3): THREE.Vector3 | null {
  const s = useGame.getState()
  const def = s.activeMission && missionById(s.activeMission.id)
  if (!def) {
    const g = guide()
    return g?.target ? out.set(...g.target) : null
  }
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
  if (!def) return guide()?.text ?? null
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
