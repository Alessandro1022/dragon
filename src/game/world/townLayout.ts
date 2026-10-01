import { TOWN, HATCHERY, GUARD_TOWER, QUEST_GIVER } from './worldSpots'
import { addColliders } from './colliders'

/** Deterministic town plan for Draksten, shared by meshes, colliders and NPCs. */

export interface House {
  x: number
  z: number
  w: number
  d: number
  h: number
  rot: number
  wall: string
  roof: string
}

const WALLS = ['#e8dcc4', '#d9c9a8', '#cbb894', '#efe6d4', '#bfae8e']
const ROOFS = ['#8c3b2a', '#6e3a24', '#4b5563', '#7c2d12', '#57534e']

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

const avoid: [number, number, number][] = [
  [HATCHERY[0], HATCHERY[2], 24],
  [GUARD_TOWER[0], GUARD_TOWER[2], 16],
  [QUEST_GIVER[0], QUEST_GIVER[2], 9],
  [TOWN.x, TOWN.z, 22],
]

export const HOUSES: House[] = (() => {
  const r = rng(4242)
  const out: House[] = []
  const tryAdd = (x: number, z: number, rot: number) => {
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) return
    if (out.some((h) => Math.hypot(h.x - x, h.z - z) < 11)) return
    out.push({
      x,
      z,
      rot,
      w: 7 + r() * 4,
      d: 6 + r() * 3,
      h: 4.5 + r() * 3.5,
      wall: WALLS[Math.floor(r() * WALLS.length)],
      roof: ROOFS[Math.floor(r() * ROOFS.length)],
    })
  }
  // houses lining the two main streets
  for (let i = -6; i <= 6; i++) {
    const t = i * 12
    tryAdd(TOWN.x + t, TOWN.z - 13, 0)
    tryAdd(TOWN.x + t, TOWN.z + 13, Math.PI)
    tryAdd(TOWN.x - 13, TOWN.z + t, Math.PI / 2)
    tryAdd(TOWN.x + 13, TOWN.z + t, -Math.PI / 2)
  }
  // an outer ring of scattered homes
  for (let i = 0; i < 30; i++) {
    const a = r() * Math.PI * 2
    const d = 40 + r() * 42
    tryAdd(TOWN.x + Math.cos(a) * d, TOWN.z + Math.sin(a) * d, -a + Math.PI / 2)
  }
  return out
})()

export const LANTERNS: [number, number][] = (() => {
  const out: [number, number][] = []
  for (let i = -5; i <= 5; i++) {
    if (i === 0) continue
    out.push([TOWN.x + i * 14, TOWN.z - 5.5], [TOWN.x + 5.5, TOWN.z + i * 14])
  }
  return out
})()

/** Points villagers stroll between. */
export const STROLL_POINTS: [number, number][] = (() => {
  const out: [number, number][] = []
  for (let i = -5; i <= 5; i++) {
    out.push([TOWN.x + i * 12, TOWN.z + (i % 2) * 3], [TOWN.x + (i % 2) * 3, TOWN.z + i * 12])
  }
  for (let a = 0; a < 8; a++) out.push([TOWN.x + Math.cos(a) * 15, TOWN.z + Math.sin(a) * 15])
  return out
})()

addColliders([
  ...HOUSES.map((h) => ({ x: h.x, z: h.z, r: Math.max(h.w, h.d) * 0.55 })),
  { x: HATCHERY[0], z: HATCHERY[2] - 6, r: 10 },
  { x: GUARD_TOWER[0], z: GUARD_TOWER[2], r: 6 },
  { x: TOWN.x, z: TOWN.z, r: 3.2 },
])
