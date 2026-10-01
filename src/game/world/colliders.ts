/** Circular obstacles for the on-foot player (houses, towers, stalls). */
export interface Collider {
  x: number
  z: number
  r: number
}

export const colliders: Collider[] = []

export function addColliders(list: Collider[]) {
  colliders.push(...list)
}

/** Push a point out of every collider it overlaps. Mutates and returns pos. */
export function resolve(pos: { x: number; z: number }, radius = 0.5) {
  for (const c of colliders) {
    const dx = pos.x - c.x
    const dz = pos.z - c.z
    const d = Math.hypot(dx, dz)
    const min = c.r + radius
    if (d < min && d > 1e-4) {
      pos.x = c.x + (dx / d) * min
      pos.z = c.z + (dz / d) * min
    }
  }
  return pos
}
