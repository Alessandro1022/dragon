import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { WATER_LEVEL } from './terrainHeight'

/** Large ocean plane with gently animated low-poly waves. */
export function Water() {
  const ref = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(9000, 9000, 64, 64)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const base = useMemo(() => Float32Array.from(geometry.attributes.position.array), [geometry])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pos = geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3]
      const z = base[i * 3 + 2]
      pos.setY(i, Math.sin(x * 0.02 + t * 0.8) * 0.9 + Math.cos(z * 0.025 + t * 0.6) * 0.9)
    }
    pos.needsUpdate = true
    geometry.computeVertexNormals()
  })

  return (
    <mesh ref={ref} geometry={geometry} position={[0, WATER_LEVEL, 0]}>
      <meshStandardMaterial
        color="#1d6f8f"
        transparent
        opacity={0.86}
        roughness={0.15}
        metalness={0.25}
        flatShading
      />
    </mesh>
  )
}
