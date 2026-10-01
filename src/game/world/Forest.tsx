import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { terrainHeight, ISLAND_RADIUS } from './terrainHeight'
import { NEST, TOWN, CAMP } from './worldSpots'

const COUNT = 2600

/** Instanced low-poly pines — thousands of trees for a single draw call each. */
export function Forest() {
  const foliage = useRef<THREE.InstancedMesh>(null)
  const trunks = useRef<THREE.InstancedMesh>(null)

  const placements = useMemo(() => {
    const out: { x: number; y: number; z: number; s: number; r: number }[] = []
    let tries = 0
    while (out.length < COUNT && tries < COUNT * 20) {
      tries++
      const a = Math.random() * Math.PI * 2
      const d = Math.sqrt(Math.random()) * ISLAND_RADIUS
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      const y = terrainHeight(x, z)
      if (y < 12 || y > 140) continue
      // keep a clearing around the nest so the home base reads clearly
      if (Math.hypot(x - NEST[0], z - NEST[2]) < 38) continue
      if (Math.hypot(x - TOWN.x, z - TOWN.z) < TOWN.radius + 12) continue
      if (Math.hypot(x - CAMP.x, z - CAMP.z) < CAMP.radius) continue
      // slope check — no trees on cliffs
      const dx = terrainHeight(x + 4, z) - y
      const dz = terrainHeight(x, z + 4) - y
      if (Math.hypot(dx, dz) > 3.2) continue
      out.push({ x, y, z, s: 0.7 + Math.random() * 0.9, r: Math.random() * Math.PI })
    }
    return out
  }, [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const color = new THREE.Color()
    placements.forEach((p, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.r)
      m.compose(new THREE.Vector3(p.x, p.y + 7 * p.s, p.z), q, new THREE.Vector3(p.s, p.s, p.s))
      foliage.current!.setMatrixAt(i, m)
      color.setHSL(0.3 + Math.random() * 0.06, 0.45, 0.22 + Math.random() * 0.08)
      foliage.current!.setColorAt(i, color)
      m.compose(new THREE.Vector3(p.x, p.y + 1.5 * p.s, p.z), q, new THREE.Vector3(p.s, p.s, p.s))
      trunks.current!.setMatrixAt(i, m)
    })
    foliage.current!.instanceMatrix.needsUpdate = true
    if (foliage.current!.instanceColor) foliage.current!.instanceColor.needsUpdate = true
    trunks.current!.instanceMatrix.needsUpdate = true
  }, [placements])

  return (
    <group>
      <instancedMesh ref={foliage} args={[undefined, undefined, placements.length]} castShadow>
        <coneGeometry args={[3.2, 11, 6]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, placements.length]}>
        <cylinderGeometry args={[0.45, 0.6, 3, 5]} />
        <meshStandardMaterial color="#5a3d26" flatShading />
      </instancedMesh>
    </group>
  )
}
