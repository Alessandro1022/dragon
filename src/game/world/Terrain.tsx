import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { terrainHeight, WORLD_SIZE } from './terrainHeight'
import { createTerrainMaterial } from './terrain/terrainMaterial'
import { focusPosition } from '../focus'
import { useGame } from '../../store/gameStore'

/**
 * Chunked level-of-detail terrain.
 *
 * The island is split into 200 m chunks. Each chunk picks a resolution
 * from its distance to the player (≈2 m cells up close, 25 m far away)
 * and is rebuilt in the background under a per-frame time budget.
 * Skirts hang down from every chunk edge so LOD seams never show gaps.
 * Normals come from the height function itself, so they're smooth and
 * continuous across chunk borders.
 */

const CHUNK = 200
const GRID = Math.round(WORLD_SIZE / CHUNK) // 16 × 16
const HALF = WORLD_SIZE / 2
const LODS = [96, 48, 24, 8] // quads per chunk edge
const LOD_DIST = [330, 750, 1500] // switch distances (m)
const SKIRT = 12
const BUILD_BUDGET_MS = 5

function lodFor(dist: number) {
  for (let i = 0; i < LOD_DIST.length; i++) if (dist < LOD_DIST[i]) return i
  return LOD_DIST.length
}

function buildChunk(ci: number, cj: number, lod: number) {
  const n = LODS[lod]
  const step = CHUNK / n
  const x0 = -HALF + ci * CHUNK
  const z0 = -HALF + cj * CHUNK

  // heights on an (n+3)² grid with a one-cell border, for central-difference normals
  const W = n + 3
  const hs = new Float32Array(W * W)
  for (let j = 0; j < W; j++) {
    for (let i = 0; i < W; i++) {
      hs[j * W + i] = terrainHeight(x0 + (i - 1) * step, z0 + (j - 1) * step)
    }
  }

  const V = n + 1
  const ringCount = 4 * n // skirt vertices
  const pos = new Float32Array((V * V + ringCount) * 3)
  const nor = new Float32Array((V * V + ringCount) * 3)
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < V; i++) {
      const k = j * V + i
      const h = hs[(j + 1) * W + (i + 1)]
      pos[k * 3] = x0 + i * step
      pos[k * 3 + 1] = h
      pos[k * 3 + 2] = z0 + j * step
      const dx = hs[(j + 1) * W + (i + 2)] - hs[(j + 1) * W + i]
      const dz = hs[(j + 2) * W + (i + 1)] - hs[j * W + (i + 1)]
      const nx = -dx
      const ny = 2 * step
      const nz = -dz
      const l = Math.hypot(nx, ny, nz)
      nor[k * 3] = nx / l
      nor[k * 3 + 1] = ny / l
      nor[k * 3 + 2] = nz / l
    }
  }

  const index: number[] = []
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * V + i
      const b = a + 1
      const c = a + V
      const d = c + 1
      // alternate the diagonal so the mesh has no directional bias
      if ((i + j) % 2 === 0) index.push(a, c, b, b, c, d)
      else index.push(a, c, d, a, d, b)
    }
  }

  // skirt: walk the border once, duplicating each vertex SKIRT metres lower
  const border: number[] = []
  for (let i = 0; i < n; i++) border.push(i) // top edge
  for (let j = 0; j < n; j++) border.push(j * V + n) // right
  for (let i = n; i > 0; i--) border.push(n * V + i) // bottom
  for (let j = n; j > 0; j--) border.push(j * V) // left
  const baseIdx = V * V
  border.forEach((src, bi) => {
    const k = baseIdx + bi
    pos[k * 3] = pos[src * 3]
    pos[k * 3 + 1] = pos[src * 3 + 1] - SKIRT
    pos[k * 3 + 2] = pos[src * 3 + 2]
    nor[k * 3] = nor[src * 3]
    nor[k * 3 + 1] = nor[src * 3 + 1]
    nor[k * 3 + 2] = nor[src * 3 + 2]
  })
  for (let bi = 0; bi < border.length; bi++) {
    const a = border[bi]
    const b = border[(bi + 1) % border.length]
    const a2 = baseIdx + bi
    const b2 = baseIdx + ((bi + 1) % border.length)
    index.push(a, b, a2, b, b2, a2)
    index.push(a, a2, b, b, a2, b2) // both windings: skirts are visible from either side
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  geo.setIndex(index)
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

interface Chunk {
  ci: number
  cj: number
  cx: number
  cz: number
  lod: number
  mesh: THREE.Mesh | null
  geos: (THREE.BufferGeometry | null)[]
}

/** Chunks that are entirely deep ocean are never built — the water hides them. */
function isOcean(ci: number, cj: number) {
  const x0 = -HALF + ci * CHUNK
  const z0 = -HALF + cj * CHUNK
  for (let j = 0; j <= 6; j++)
    for (let i = 0; i <= 6; i++) if (terrainHeight(x0 + (i * CHUNK) / 6, z0 + (j * CHUNK) / 6) > -14) return false
  return true
}

export function Terrain() {
  const gl = useThree((s) => s.gl)
  const quality = useGame((s) => s.settings.quality)
  const group = useRef<THREE.Group>(null)
  const material = useMemo(() => createTerrainMaterial(quality, gl.capabilities.getMaxAnisotropy()), [quality, gl])

  const chunks = useMemo<Chunk[]>(() => {
    const out: Chunk[] = []
    for (let cj = 0; cj < GRID; cj++)
      for (let ci = 0; ci < GRID; ci++) {
        if (isOcean(ci, cj)) continue
        out.push({ ci, cj, cx: -HALF + (ci + 0.5) * CHUNK, cz: -HALF + (cj + 0.5) * CHUNK, lod: -1, mesh: null, geos: [null, null, null, null] })
      }
    return out
  }, [])

  // the whole island at the coarsest LOD immediately, so there's never a hole
  useEffect(() => {
    const g = group.current!
    for (const c of chunks) {
      const geo = buildChunk(c.ci, c.cj, LODS.length - 1)
      c.geos[LODS.length - 1] = geo
      const mesh = new THREE.Mesh(geo, material)
      mesh.receiveShadow = true
      mesh.matrixAutoUpdate = false
      c.mesh = mesh
      c.lod = LODS.length - 1
      g.add(mesh)
    }
    return () => {
      for (const c of chunks) {
        if (c.mesh) g.remove(c.mesh)
        c.geos.forEach((geo) => geo?.dispose())
        c.geos = [null, null, null, null]
        c.mesh = null
        c.lod = -1
      }
    }
  }, [chunks, material])

  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    const f = focusPosition()
    const start = performance.now()
    // nearest chunks first
    const wanted = chunks
      .map((c) => ({ c, lod: lodFor(Math.max(0, Math.hypot(c.cx - f.x, c.cz - f.z) - CHUNK * 0.5)) }))
      .filter(({ c, lod }) => c.lod !== lod)
      .sort((a, b) => a.lod - b.lod)

    for (const { c, lod } of wanted) {
      if (!c.mesh) continue
      if (!c.geos[lod]) {
        const budget = import.meta.env.DEV && (window as unknown as { __buildAll?: boolean }).__buildAll ? 5000 : BUILD_BUDGET_MS
        if (performance.now() - start > budget) break
        c.geos[lod] = buildChunk(c.ci, c.cj, lod)
      }
      c.mesh.geometry = c.geos[lod]!
      c.lod = lod
      // free detailed geometry we've moved away from (keep the coarse fallback)
      for (let i = 0; i < LODS.length - 1; i++) {
        if (i !== lod && c.geos[i] && Math.abs(i - lod) > 1) {
          c.geos[i]!.dispose()
          c.geos[i] = null
        }
      }
    }
  })

  return <group ref={group} />
}
