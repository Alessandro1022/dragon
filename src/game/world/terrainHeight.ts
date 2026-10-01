import { createNoise2D } from 'simplex-noise'

/** Deterministic PRNG so the world is identical for every player. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const WORLD_SIZE = 3200
export const ISLAND_RADIUS = 1350
export const WATER_LEVEL = 0

const rand = mulberry32(1337)
const n1 = createNoise2D(rand)
const n2 = createNoise2D(rand)
const n3 = createNoise2D(rand)

function fbm(x: number, z: number, octaves: number) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * n1(x * freq, z * freq)
    norm += amp
    amp *= 0.5
    freq *= 2.03
  }
  return sum / norm
}

function ridged(x: number, z: number) {
  let amp = 1
  let freq = 1
  let sum = 0
  for (let i = 0; i < 4; i++) {
    const v = 1 - Math.abs(n2(x * freq, z * freq))
    sum += v * v * amp
    amp *= 0.5
    freq *= 2.1
  }
  return sum / 1.875
}

const smoothstep = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

function rawHeight(x: number, z: number): number {
  const d = Math.hypot(x, z) / ISLAND_RADIUS
  // jagged coastline
  const coast = d + n3(x * 0.0018, z * 0.0018) * 0.18
  const land = smoothstep(1.0, 0.72, coast)

  const hills = (fbm(x * 0.0016, z * 0.0016, 5) * 0.5 + 0.5) * 70
  const mountainMask = smoothstep(0.1, 0.55, n3(x * 0.0008 + 40, z * 0.0008 - 12) * 0.5 + 0.5)
  const mountains = ridged(x * 0.0021, z * 0.0021) * 340 * mountainMask
  // fine crags on the mountains and gentle bumps underfoot
  const crags = (1 - Math.abs(n2(x * 0.011, z * 0.011))) * 9 * mountainMask * mountainMask
  const bumps = n1(x * 0.045, z * 0.045) * 0.7 + n3(x * 0.13, z * 0.13) * 0.18

  return 6 + (hills + mountains + crags + bumps) * land - (1 - land) * 55
}

/** Ground or water surface, whichever is higher. */
export function surfaceHeight(x: number, z: number): number {
  return Math.max(terrainHeight(x, z), WATER_LEVEL)
}

/**
 * Plateaus carved into the terrain for settlements, so buildings sit flat.
 * Each zone blends the natural height toward the height at its centre.
 */
export const FLAT_ZONES = [
  { id: 'town', x: -480, z: -320, r: 150 },
  { id: 'camp', x: 800, z: -120, r: 70 },
].map((zone) => ({ ...zone, h: rawHeight(zone.x, zone.z) }))

/** Height of the ground at a world (x, z). Used by both the mesh and collision. */
export function terrainHeight(x: number, z: number): number {
  let h = rawHeight(x, z)
  for (const zone of FLAT_ZONES) {
    const d = Math.hypot(x - zone.x, z - zone.z)
    if (d < zone.r) {
      const k = smoothstep(zone.r, zone.r * 0.55, d)
      h = h + (zone.h - h) * k
    }
  }
  return h
}
