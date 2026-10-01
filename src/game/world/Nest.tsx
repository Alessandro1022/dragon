import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { NEST } from './worldSpots'
import { useGame } from '../../store/gameStore'
import { eggColors, express } from '../../systems/genetics'

/** Stick nest with the incubating egg; the egg wobbles and glows as it nears hatching. */
export function Nest() {
  const egg = useGame((s) => s.nestEgg)
  const ready = useGame((s) => s.hatchReady)
  const eggRef = useRef<THREE.Group>(null)
  const glow = useRef<THREE.PointLight>(null)

  const sticks = useMemo(() => {
    const out: { pos: [number, number, number]; rot: [number, number, number]; len: number }[] = []
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + Math.random() * 0.3
      const r = 2.1 + Math.random() * 0.6
      const ring = i % 3
      out.push({
        pos: [Math.cos(a) * r, 0.25 + ring * 0.28, Math.sin(a) * r],
        rot: [Math.random() * 0.4, -a + Math.PI / 2 + (Math.random() - 0.5) * 0.8, Math.PI / 2 + (Math.random() - 0.5) * 0.5],
        len: 2.2 + Math.random() * 1.6,
      })
    }
    return out
  }, [])

  const colors = useMemo(() => (egg ? eggColors(express(egg.genome)) : null), [egg?.genome]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock }) => {
    const p = egg?.progress ?? 0
    const t = clock.elapsedTime
    if (eggRef.current) {
      const wobble = p > 0.6 || ready ? Math.sin(t * (ready ? 14 : 6)) * (ready ? 0.12 : (p - 0.6) * 0.15) : 0
      eggRef.current.rotation.z = wobble
      eggRef.current.position.y = 0.95 + (ready ? Math.abs(Math.sin(t * 7)) * 0.08 : 0)
    }
    if (glow.current) glow.current.intensity = egg ? 4 + p * 18 + (ready ? Math.sin(t * 6) * 8 + 10 : 0) : 0
  })

  return (
    <group position={NEST}>
      {sticks.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={s.rot}>
          <cylinderGeometry args={[0.09, 0.12, s.len, 4]} />
          <meshStandardMaterial color={i % 4 === 0 ? '#7a5532' : '#5c3d22'} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.2, 0]} scale={[2.1, 0.35, 2.1]}>
        <cylinderGeometry args={[1, 0.8, 1, 10]} />
        <meshStandardMaterial color="#6b5a3a" flatShading roughness={1} />
      </mesh>
      {/* standing stones mark the nest from the air */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 6.5, 1.2, Math.sin(a) * 6.5]} rotation={[0.05, a, 0.08]}>
            <boxGeometry args={[0.9, 2.8 + (i % 2) * 0.8, 0.7]} />
            <meshStandardMaterial color="#8d8a84" flatShading />
          </mesh>
        )
      })}
      {egg && colors && (
        <group ref={eggRef} position={[0, 0.95, 0]}>
          <mesh scale={[0.72, 1, 0.72]}>
            <sphereGeometry args={[0.9, 12, 10]} />
            <meshStandardMaterial
              color={colors[0]}
              emissive={colors[1]}
              emissiveIntensity={0.25 + egg.progress * 0.6 + (ready ? 0.8 : 0)}
              roughness={0.35}
              metalness={0.15}
              flatShading
            />
          </mesh>
          {/* speckles */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = i * 1.9
            const y = -0.4 + (i % 3) * 0.4
            return (
              <mesh key={i} position={[Math.cos(a) * 0.6, y, Math.sin(a) * 0.6]} scale={0.12}>
                <icosahedronGeometry args={[1, 0]} />
                <meshStandardMaterial color={colors[1]} emissive={colors[1]} emissiveIntensity={0.6} />
              </mesh>
            )
          })}
        </group>
      )}
      <pointLight ref={glow} position={[0, 2, 0]} color={colors?.[1] ?? '#f5b041'} distance={18} decay={1.5} />
    </group>
  )
}
