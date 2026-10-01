import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { terrainHeight, ISLAND_RADIUS } from './terrainHeight'
import { NEST, TOWN, CAMP } from './worldSpots'
import { addColliders } from './colliders'
import { buildTreeVariants, windUniforms, VARIANTS, type TreeVariant, type VariantId } from './trees/treeAssets'
import { focusPosition } from '../focus'
import { useGame } from '../../store/gameStore'

/**
 * Forests of real procedural trees (EZ-Tree) with three levels of detail.
 * Every few frames each tree is sorted into full detail, reduced detail or
 * an impostor card by its distance to the player.
 */

const COUNT = 3400
const LOD_DIST = {
  low: [0, 160],
  medium: [70, 320],
  high: [130, 480],
}

interface Placement {
  x: number
  y: number
  z: number
  s: number
  r: number
  v: VariantId
  matrix: Float32Array
}

/** deterministic placement so every player sees the same forest */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

function pickVariant(h: number, r: number): VariantId {
  if (r < 0.14) return r < 0.07 ? 'bush1' : 'bush2'
  if (h > 70) return r < 0.45 ? 'pineM' : r < 0.75 ? 'pineL' : 'pineS'
  if (h > 40) return r < 0.3 ? 'pineM' : r < 0.5 ? 'pineS' : r < 0.7 ? 'aspen' : r < 0.85 ? 'oak' : 'ash'
  return r < 0.35 ? 'oak' : r < 0.6 ? 'aspen' : r < 0.8 ? 'ash' : 'pineS'
}

function makePlacements(): Placement[] {
  const rand = rng(90210)
  const out: Placement[] = []
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const Y = new THREE.Vector3(0, 1, 0)
  let tries = 0
  while (out.length < COUNT && tries < COUNT * 30) {
    tries++
    // clustered: pick a grove centre, then scatter around it
    const a = rand() * Math.PI * 2
    const d = Math.sqrt(rand()) * ISLAND_RADIUS
    const groveNoise = Math.sin(a * 7.3 + d * 0.011) * Math.cos(d * 0.017 - a * 3.1)
    if (groveNoise < -0.15 && rand() < 0.8) continue
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    const y = terrainHeight(x, z)
    if (y < 10 || y > 160) continue
    if (Math.hypot(x - NEST[0], z - NEST[2]) < 40) continue
    if (Math.hypot(x - TOWN.x, z - TOWN.z) < TOWN.radius + 14) continue
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < CAMP.radius) continue
    const dx = terrainHeight(x + 3, z) - y
    const dz = terrainHeight(x, z + 3) - y
    if (Math.hypot(dx, dz) > 1.8) continue
    const v = pickVariant(y + (rand() - 0.5) * 30, rand())
    const s = 0.75 + rand() * 0.5
    const r = rand() * Math.PI * 2
    q.setFromAxisAngle(Y, r)
    m.compose(new THREE.Vector3(x, y - 0.3, z), q, new THREE.Vector3(s, s * (0.9 + rand() * 0.2), s))
    out.push({ x, y, z, s, r, v, matrix: new Float32Array(m.elements) })
  }
  return out
}

/** Camera-facing (cylindrical) billboard for distant trees. */
function makeImpostorMaterial(v: TreeVariant) {
  const m = new THREE.MeshStandardMaterial({ map: v.impostor.texture, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <project_vertex>',
        `
        vec3 iCenter = instanceMatrix[3].xyz;
        float iScale = length(instanceMatrix[0].xyz);
        vec3 toCam = cameraPosition - iCenter;
        toCam.y = 0.0;
        vec3 fwd = normalize(toCam);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
        vec3 wpos = iCenter + right * position.x * iScale + vec3(0.0, position.y * iScale, 0.0);
        vec4 mvPosition = viewMatrix * vec4(wpos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        `,
      )
      .replace('#include <defaultnormal_vertex>', `vec3 transformedNormal = normalize((viewMatrix * vec4(0.0, 0.6, 0.0, 0.0)).xyz + (viewMatrix * vec4(normalize(cameraPosition - instanceMatrix[3].xyz), 0.0)).xyz * 0.6);`)
  }
  m.customProgramCacheKey = () => 'impostor'
  return m
}

export function Forest() {
  const gl = useThree((s) => s.gl)
  const quality = useGame((s) => s.settings.quality)
  const lodDist = LOD_DIST[quality]
  const variants = useMemo(() => buildTreeVariants(gl), [gl])
  const placements = useMemo(makePlacements, [])

  const byVariant = useMemo(() => {
    const map = new Map<VariantId, Placement[]>()
    VARIANTS.forEach((v) => map.set(v, []))
    placements.forEach((p) => map.get(p.v)!.push(p))
    return map
  }, [placements])

  useEffect(() => {
    addColliders(
      placements
        .filter((p) => !p.v.startsWith('bush'))
        .map((p) => ({ x: p.x, z: p.z, r: Math.max(0.5, variants.find((v) => v.id === p.v)!.trunkRadius * p.s) })),
    )
  }, [placements, variants])

  const meshes = useMemo(() => {
    return variants.map((v) => {
      const n = byVariant.get(v.id)!.length
      const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow: boolean) => {
        const im = new THREE.InstancedMesh(geo, mat, Math.max(1, n))
        im.count = 0
        im.castShadow = shadow
        im.receiveShadow = true
        im.frustumCulled = false
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        return im
      }
      const quad = new THREE.PlaneGeometry(v.impostor.width, v.impostor.height)
      quad.translate(0, v.impostor.height / 2 + v.impostor.bottom, 0)
      return {
        v,
        bark0: mk(v.lod0.bark, v.barkMaterial, true),
        leaves0: mk(v.lod0.leaves, v.leafMaterial, true),
        bark1: mk(v.lod1.bark, v.barkMaterial, true),
        leaves1: mk(v.lod1.leaves, v.leafMaterial, true),
        imp: (() => {
          const im = mk(quad, makeImpostorMaterial(v), false)
          im.receiveShadow = false
          return im
        })(),
      }
    })
  }, [variants, byVariant])

  const group = useRef<THREE.Group>(null)
  useEffect(() => {
    const g = group.current!
    meshes.forEach((m) => g.add(m.bark0, m.leaves0, m.bark1, m.leaves1, m.imp))
    return () => meshes.forEach((m) => g.remove(m.bark0, m.leaves0, m.bark1, m.leaves1, m.imp))
  }, [meshes])

  const timer = useRef(99)
  useFrame((_, dt) => {
    windUniforms.uTime.value += dt
    timer.current += dt
    if (timer.current < 0.35) return
    timer.current = 0
    const f = focusPosition()
    const [d0, d1] = lodDist
    const d0sq = d0 * d0
    const d1sq = d1 * d1
    for (const m of meshes) {
      const list = byVariant.get(m.v.id)!
      let c0 = 0
      let c1 = 0
      let c2 = 0
      const a0b = m.bark0.instanceMatrix.array as Float32Array
      const a0l = m.leaves0.instanceMatrix.array as Float32Array
      const a1b = m.bark1.instanceMatrix.array as Float32Array
      const a1l = m.leaves1.instanceMatrix.array as Float32Array
      const a2 = m.imp.instanceMatrix.array as Float32Array
      for (const p of list) {
        const dx = p.x - f.x
        const dz = p.z - f.z
        const dsq = dx * dx + dz * dz
        if (dsq < d0sq) {
          a0b.set(p.matrix, c0 * 16)
          a0l.set(p.matrix, c0 * 16)
          c0++
        } else if (dsq < d1sq) {
          a1b.set(p.matrix, c1 * 16)
          a1l.set(p.matrix, c1 * 16)
          c1++
        } else {
          a2.set(p.matrix, c2 * 16)
          c2++
        }
      }
      m.bark0.count = m.leaves0.count = c0
      m.bark1.count = m.leaves1.count = c1
      m.imp.count = c2
      for (const im of [m.bark0, m.leaves0, m.bark1, m.leaves1, m.imp]) im.instanceMatrix.needsUpdate = true
    }
  })

  return <group ref={group} />
}
