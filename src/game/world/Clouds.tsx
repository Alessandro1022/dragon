import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/** Stylised low-poly cloud clusters, instanced into a single draw call. */
export function Clouds() {
  const ref = useRef<THREE.InstancedMesh>(null)

  const puffs = useMemo(() => {
    const out: { x: number; y: number; z: number; s: number }[] = []
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2
      const d = 200 + Math.random() * 1800
      const cx = Math.cos(a) * d
      const cz = Math.sin(a) * d
      const cy = 260 + Math.random() * 180
      const n = 4 + Math.floor(Math.random() * 5)
      for (let k = 0; k < n; k++) {
        out.push({
          x: cx + (Math.random() - 0.5) * 70,
          y: cy + (Math.random() - 0.5) * 14,
          z: cz + (Math.random() - 0.5) * 40,
          s: 14 + Math.random() * 20,
        })
      }
    }
    return out
  }, [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    puffs.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s * 0.6, p.s))
      ref.current!.setMatrixAt(i, m)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [puffs])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, puffs.length]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#ffffff" emissive="#c9d6e6" emissiveIntensity={0.55} flatShading roughness={1} transparent opacity={0.94} />
    </instancedMesh>
  )
}
