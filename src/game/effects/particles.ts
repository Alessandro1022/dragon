import * as THREE from 'three'

/**
 * Shared fire/smoke particle pool. Anything can call emit(); the
 * FireParticles component integrates and draws them in two draw calls.
 */
export const MAX_PARTICLES = 900

export interface Pool {
  pos: Float32Array
  vel: Float32Array
  age: Float32Array
  life: Float32Array
  size: Float32Array
  kind: Uint8Array // 0 fire, 1 smoke
  /** mid-life fire colour per particle (element tint) */
  tint: Float32Array
  next: number
}

export const pool: Pool = {
  pos: new Float32Array(MAX_PARTICLES * 3),
  vel: new Float32Array(MAX_PARTICLES * 3),
  age: new Float32Array(MAX_PARTICLES).fill(999),
  life: new Float32Array(MAX_PARTICLES).fill(1),
  size: new Float32Array(MAX_PARTICLES),
  kind: new Uint8Array(MAX_PARTICLES),
  tint: new Float32Array(MAX_PARTICLES * 3).fill(1),
  next: 0,
}

const DEFAULT_TINT = new THREE.Color('#ff9a2e')

export function emit(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  opts: { spread?: number; life?: number; size?: number; kind?: 0 | 1; tint?: THREE.Color } = {},
) {
  const i = pool.next
  pool.next = (pool.next + 1) % MAX_PARTICLES
  const spread = opts.spread ?? 0
  pool.pos.set([position.x, position.y, position.z], i * 3)
  pool.vel.set(
    [
      velocity.x + (Math.random() - 0.5) * spread,
      velocity.y + (Math.random() - 0.5) * spread,
      velocity.z + (Math.random() - 0.5) * spread,
    ],
    i * 3,
  )
  pool.age[i] = 0
  pool.life[i] = (opts.life ?? 0.6) * (0.75 + Math.random() * 0.5)
  pool.size[i] = (opts.size ?? 3) * (0.7 + Math.random() * 0.6)
  pool.kind[i] = opts.kind ?? 0
  const t = opts.tint ?? DEFAULT_TINT
  pool.tint.set([t.r, t.g, t.b], i * 3)
}
