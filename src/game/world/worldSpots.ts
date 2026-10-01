import { terrainHeight, ISLAND_RADIUS } from './terrainHeight'

/** Deterministic points of interest, computed once from the terrain. */

function flatness(x: number, z: number, r: number) {
  const h = terrainHeight(x, z)
  let max = 0
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2
    max = Math.max(max, Math.abs(terrainHeight(x + Math.cos(ang) * r, z + Math.sin(ang) * r) - h))
  }
  return max
}

function findNest(): [number, number, number] {
  // spiral out from a spot near the ring course start
  for (let i = 0; i < 4000; i++) {
    const a = i * 0.61
    const r = 2 + i * 0.9
    const x = 60 + Math.cos(a) * r
    const z = 820 + Math.sin(a) * r
    const h = terrainHeight(x, z)
    if (h > 14 && h < 70 && flatness(x, z, 18) < 3.5) return [x, h, z]
  }
  return [60, terrainHeight(60, 820), 820]
}

export const NEST = findNest()

const [nx, , nz] = NEST
const ground = (x: number, z: number): [number, number, number] => [x, terrainHeight(x, z), z]

export const PLAYER_SPAWN = ground(nx + 7, nz + 7)
export const DRAGON_SPAWN = ground(nx - 16, nz + 6)

/** Highest peak in each third of the island: rare wild eggs live there. */
function findPeaks(): [number, number, number][] {
  const peaks: [number, number, number][] = []
  for (let sector = 0; sector < 3; sector++) {
    let best: [number, number, number] = [0, -Infinity, 0]
    for (let i = 0; i < 3000; i++) {
      const a = ((sector + (i % 97) / 97) / 3) * Math.PI * 2
      const d = ((i * 7919) % 1000) / 1000 * ISLAND_RADIUS * 0.85
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      const h = terrainHeight(x, z)
      if (h > best[1]) best = [x, h, z]
    }
    peaks.push(best)
  }
  return peaks
}

export const WILD_EGG_SPOTS = findPeaks()

/** Seeded scatter for food pickups. */
function scatter(count: number, seed: number, accept: (x: number, h: number, z: number) => boolean) {
  const out: [number, number, number][] = []
  let s = seed
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  let tries = 0
  while (out.length < count && tries < count * 200) {
    tries++
    const a = rnd() * Math.PI * 2
    const d = Math.sqrt(rnd()) * ISLAND_RADIUS * 1.05
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    const h = terrainHeight(x, z)
    if (accept(x, h, z)) out.push([x, h, z])
  }
  return out
}

/** Berry bushes on the meadows, a cluster near the nest so new players find them. */
export const BERRY_SPOTS: [number, number, number][] = [
  ...[0, 1, 2, 3, 4].map((i) => {
    const a = (i / 5) * Math.PI * 2 + 0.4
    return ground(nx + Math.cos(a) * 24, nz + Math.sin(a) * 24)
  }),
  ...scatter(45, 7, (_x, h) => h > 12 && h < 90),
]

/** Fish jump in the shallows along the coast. */
export const FISH_SPOTS = scatter(30, 99, (_x, h) => h < -3 && h > -25).map(
  ([x, , z]) => [x, 0, z] as [number, number, number],
)
