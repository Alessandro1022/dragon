import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

export interface RiderAnim {
  /** horizontal speed in units/s */
  speed: number
  grounded: boolean
  seated: boolean
}

const COLORS = {
  tunic: '#2b3140',
  leather: '#6b4a2b',
  cape: '#8f1d22',
  skin: '#c68e5f',
  trim: '#f5b041',
  boots: '#2a1f17',
}

/** Low-poly dragon rider (~1.8 units tall, origin at the feet, facing -Z). */
export function RiderModel({ anim }: { anim: RiderAnim }) {
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const cape = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const phase = useRef(0)

  const m = useMemo(
    () => ({
      tunic: new THREE.MeshStandardMaterial({ color: COLORS.tunic, flatShading: true, roughness: 0.8 }),
      leather: new THREE.MeshStandardMaterial({ color: COLORS.leather, flatShading: true, roughness: 0.7 }),
      cape: new THREE.MeshStandardMaterial({ color: COLORS.cape, flatShading: true, side: THREE.DoubleSide, roughness: 0.9 }),
      skin: new THREE.MeshStandardMaterial({ color: COLORS.skin, flatShading: true }),
      trim: new THREE.MeshStandardMaterial({ color: COLORS.trim, flatShading: true, metalness: 0.6, roughness: 0.3 }),
      boots: new THREE.MeshStandardMaterial({ color: COLORS.boots, flatShading: true }),
    }),
    [],
  )

  useFrame((_, dt) => {
    const moving = anim.speed > 0.5 && anim.grounded && !anim.seated
    const running = anim.speed > 8
    phase.current += dt * (moving ? (running ? 11 : 7.5) : 1.5)
    const swing = moving ? Math.sin(phase.current) * (running ? 0.85 : 0.55) : 0
    const air = !anim.grounded && !anim.seated

    const legTarget = anim.seated ? -1.35 : air ? -0.5 : 0
    if (legL.current) legL.current.rotation.x = THREE.MathUtils.damp(legL.current.rotation.x, legTarget + swing, 14, dt)
    if (legR.current) legR.current.rotation.x = THREE.MathUtils.damp(legR.current.rotation.x, legTarget - swing + (air ? 0.6 : 0), 14, dt)
    // legs spread around the dragon's neck when seated
    if (legL.current) legL.current.rotation.z = THREE.MathUtils.damp(legL.current.rotation.z, anim.seated ? -0.45 : 0, 10, dt)
    if (legR.current) legR.current.rotation.z = THREE.MathUtils.damp(legR.current.rotation.z, anim.seated ? 0.45 : 0, 10, dt)

    const armTarget = anim.seated ? -0.9 : air ? -2.4 : 0
    if (armL.current) armL.current.rotation.x = THREE.MathUtils.damp(armL.current.rotation.x, armTarget - swing * 0.8, 12, dt)
    if (armR.current) armR.current.rotation.x = THREE.MathUtils.damp(armR.current.rotation.x, armTarget + swing * 0.8, 12, dt)

    if (body.current) {
      const bob = moving ? Math.abs(Math.sin(phase.current)) * (running ? 0.12 : 0.06) : Math.sin(phase.current) * 0.01
      body.current.position.y = bob
      body.current.rotation.x = THREE.MathUtils.damp(body.current.rotation.x, running ? -0.18 : anim.seated ? -0.25 : 0, 8, dt)
    }
    if (cape.current) {
      const flow = anim.seated ? 1.1 : Math.min(1, anim.speed / 12) * 0.9 + (air ? 0.4 : 0)
      cape.current.rotation.x = THREE.MathUtils.damp(cape.current.rotation.x, 0.08 + flow + Math.sin(phase.current * 1.7) * 0.06, 6, dt)
    }
  })

  return (
    <group>
      <group ref={body}>
        {/* legs (pivot at hip) */}
        {[
          [-0.16, legL],
          [0.16, legR],
        ].map(([x, ref], i) => (
          <group key={i} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 0.95, 0]}>
            <mesh material={m.leather} position={[0, -0.28, 0]} scale={[0.15, 0.56, 0.17]}>
              <boxGeometry />
            </mesh>
            <mesh material={m.boots} position={[0, -0.75, -0.04]} scale={[0.16, 0.42, 0.24]}>
              <boxGeometry />
            </mesh>
          </group>
        ))}

        {/* torso */}
        <mesh material={m.tunic} position={[0, 1.27, 0]} scale={[0.5, 0.66, 0.3]}>
          <boxGeometry />
        </mesh>
        <mesh material={m.leather} position={[0, 1.0, 0]} scale={[0.54, 0.1, 0.33]}>
          <boxGeometry />
        </mesh>
        <mesh material={m.trim} position={[0, 1.0, -0.17]} scale={[0.1, 0.08, 0.02]}>
          <boxGeometry />
        </mesh>
        {/* shoulder pauldrons */}
        {[-1, 1].map((s) => (
          <mesh key={s} material={m.leather} position={[s * 0.3, 1.56, 0]} scale={[0.17, 0.12, 0.2]}>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
        ))}

        {/* arms (pivot at shoulder) */}
        {[
          [-0.33, armL],
          [0.33, armR],
        ].map(([x, ref], i) => (
          <group key={i} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 1.52, 0]}>
            <mesh material={m.tunic} position={[0, -0.25, 0]} scale={[0.13, 0.5, 0.14]}>
              <boxGeometry />
            </mesh>
            <mesh material={m.skin} position={[0, -0.56, 0]} scale={[0.09, 0.1, 0.1]}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          </group>
        ))}

        {/* head + hood */}
        <mesh material={m.skin} position={[0, 1.78, -0.02]} scale={[0.17, 0.2, 0.18]}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
        <mesh material={m.cape} position={[0, 1.84, 0.04]} scale={[0.22, 0.24, 0.22]}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
        <mesh material={m.cape} position={[0, 2.02, 0.16]} rotation={[0.7, 0, 0]}>
          <coneGeometry args={[0.1, 0.3, 5]} />
        </mesh>

        {/* cape (pivot at shoulders) */}
        <group ref={cape} position={[0, 1.58, 0.17]}>
          <mesh material={m.cape} position={[0, -0.55, 0]}>
            <planeGeometry args={[0.62, 1.1, 1, 3]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
