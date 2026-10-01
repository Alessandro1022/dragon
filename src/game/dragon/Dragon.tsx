import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { DragonModel } from './DragonModel'
import { useFlight } from './useFlight'
import { flight } from './flightState'

/** The player's dragon: flight physics + model + boost fire. */
export function Dragon() {
  const group = useRef<THREE.Group>(null)
  const flame = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  useFlight(group)

  useFrame(({ clock }) => {
    const on = flight.boosting
    const flicker = 0.85 + Math.sin(clock.elapsedTime * 40) * 0.1 + Math.random() * 0.1
    if (flame.current) {
      const s = on ? flicker : 0.0001
      flame.current.scale.setScalar(THREE.MathUtils.lerp(flame.current.scale.x, s, 0.35))
    }
    if (light.current) light.current.intensity = on ? 60 * flicker : 0
  })

  return (
    <group ref={group}>
      <DragonModel />
      {/* boost fire from the mouth (head sits ~6.5 units ahead) */}
      <group ref={flame} position={[0, 1.6, -7.6]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.6]}>
          <coneGeometry args={[0.55, 3.2, 8, 1, true]} />
          <meshBasicMaterial color="#ffb02e" transparent opacity={0.85} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.1]}>
          <coneGeometry args={[0.3, 2.1, 8, 1, true]} />
          <meshBasicMaterial color="#fff3c4" toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, 1.6, -9]} color="#ff9a2e" distance={40} decay={1.6} />
    </group>
  )
}
