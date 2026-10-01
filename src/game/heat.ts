import { useGame } from '../store/gameStore'

/**
 * Wanted level ("heat"), 0–5 stars. Crimes raise it; staying out of the
 * Dragon Guard's sight lowers it one star at a time. The guard system
 * reads the level to decide how many riders hunt you.
 */
export const heat = {
  level: 0,
  /** seconds unseen; at COOL_SECONDS one star drops */
  unseen: 0,
  /** seconds a guard has been on top of you */
  catchProgress: 0,
  lastArson: -999,
  /** a royal egg was stolen during this heat episode */
  heist: false,
}

export const MAX_HEAT = 5
export const COOL_SECONDS = 11
export const CATCH_SECONDS = 3
export const SIGHT_RANGE = 420

export function raiseHeat(amount: number, reason?: string) {
  const before = heat.level
  heat.level = Math.min(MAX_HEAT, heat.level + amount)
  heat.unseen = 0
  const s = useGame.getState()
  s.setHeat(heat.level, s.guardsClose)
  if (reason && heat.level > before) s.toast(reason, 'warn')
}

export function clearHeat() {
  heat.level = 0
  heat.unseen = 0
  heat.catchProgress = 0
  heat.heist = false
  useGame.getState().setHeat(0, false)
}
