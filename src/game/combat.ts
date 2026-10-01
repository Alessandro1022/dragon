import * as THREE from 'three'

/**
 * Anything dragon fire can damage registers here: guard dragons, bandit
 * tents, later buildings and wild beasts. Kept as a plain registry so the
 * fire system doesn't need to know what it's burning.
 */
export interface Target {
  id: string
  kind: 'guard' | 'tent'
  position: THREE.Vector3
  radius: number
  hp: number
  maxHp: number
  alive: boolean
  /** seconds since last hit, for burning visuals */
  burning: number
  onHit?: (damage: number) => void
  onDestroyed?: () => void
}

export const targets = new Map<string, Target>()

export function registerTarget(t: Target) {
  targets.set(t.id, t)
  return () => targets.delete(t.id)
}

const toTarget = new THREE.Vector3()

export const FIRE_RANGE = 42
export const FIRE_CONE = 0.42 // radians

/** Apply one frame of fire breath from origin along dir. Returns targets hit. */
export function breathe(origin: THREE.Vector3, dir: THREE.Vector3, dps: number, dt: number) {
  let hits = 0
  for (const t of targets.values()) {
    if (!t.alive) continue
    toTarget.subVectors(t.position, origin)
    const dist = toTarget.length()
    if (dist > FIRE_RANGE + t.radius) continue
    const angle = toTarget.angleTo(dir)
    // the cone widens with the target's size
    if (angle > FIRE_CONE + Math.atan2(t.radius, Math.max(dist, 1))) continue
    const damage = dps * dt * (1 - (dist / (FIRE_RANGE + t.radius)) * 0.4)
    t.hp -= damage
    t.burning = 0
    t.onHit?.(damage)
    hits++
    if (t.hp <= 0) {
      t.alive = false
      t.onDestroyed?.()
    }
  }
  return hits
}
