import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { missionTarget } from '../missionTarget'

const target = new THREE.Vector3()

/** A tall cyan beam over the active mission's objective. */
export function MissionMarker() {
  const ref = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = missionTarget(target)
    ref.current.visible = !!t
    if (!t) return
    ref.current.position.copy(t)
    ref.current.children[1].rotation.y = clock.elapsedTime * 1.4
    ref.current.children[1].position.y = 9 + Math.sin(clock.elapsedTime * 2) * 0.6
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(clock.elapsedTime * 2.5) * 0.05
  })
  return (
    <group ref={ref} visible={false}>
      <mesh ref={beam} position={[0, 120, 0]}>
        <cylinderGeometry args={[1.6, 2.4, 240, 10, 1, true]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.18} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 9, 0]}>
        <octahedronGeometry args={[1.4, 0]} />
        <meshBasicMaterial color="#67e8f9" toneMapped={false} />
      </mesh>
    </group>
  )
}
