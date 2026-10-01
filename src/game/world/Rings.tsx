import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { flight } from '../dragon/flightState'
import { useGame } from '../../store/gameStore'
import { surfaceHeight } from './terrainHeight'
import type { RingDef } from '../../types'

const RING_RADIUS = 11
const COUNT = 12

/** A looping course of golden rings around the island. */
export function buildCourse(): RingDef[] {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < COUNT; i++) {
    const a = (i / COUNT) * Math.PI * 2 + Math.PI / 2
    const r = 700 + Math.sin(i * 1.7) * 260
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const y = Math.max(surfaceHeight(x, z) + 45 + (i % 3) * 25, 60)
    pts.push(new THREE.Vector3(x, y, z))
  }
  return pts.map((p, i) => {
    const next = pts[(i + 1) % pts.length]
    return { id: i, position: [p.x, p.y, p.z], yaw: Math.atan2(next.x - p.x, next.z - p.z) }
  })
}

export const COURSE = buildCourse()

function Ring({ def, index }: { def: RingDef; index: number }) {
  const ref = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const pos = useMemo(() => new THREE.Vector3(...def.position), [def])

  useFrame(({ clock }) => {
    const { collected, collectRing, mode } = useGame.getState()
    const done = collected.includes(def.id)
    const isNext = !done && collected.length === index
    if (isNext && mode === 'flying' && flight.position.distanceTo(pos) < RING_RADIUS + 2) {
      collectRing(def.id, COURSE.length)
    }
    if (ref.current) {
      const target = done ? 0.0001 : isNext ? 1 + Math.sin(clock.elapsedTime * 4) * 0.06 : 0.8
      const s = THREE.MathUtils.lerp(ref.current.scale.x, target, 0.12)
      ref.current.scale.setScalar(s)
      ref.current.rotation.z += 0.004
    }
    if (mat.current) mat.current.emissiveIntensity = isNext ? 2.4 : 0.6
  })

  return (
    <group position={def.position} rotation={[0, def.yaw, 0]}>
      <group ref={ref}>
        <mesh>
          <torusGeometry args={[RING_RADIUS, 0.9, 6, 24]} />
          <meshStandardMaterial ref={mat} color="#f5c046" emissive="#ffb21f" emissiveIntensity={0.6} metalness={0.8} roughness={0.25} flatShading />
        </mesh>
      </group>
    </group>
  )
}

export function Rings() {
  return (
    <group>
      {COURSE.map((r, i) => (
        <Ring key={r.id} def={r} index={i} />
      ))}
    </group>
  )
}

const arrowTarget = new THREE.Vector3()

/** Floating compass arrow above the dragon pointing at the next ring. */
export function NextRingArrow() {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const { collected, phase, mode } = useGame.getState()
    const next = COURSE[collected.length]
    if (!ref.current) return
    ref.current.visible = phase === 'playing' && mode === 'flying' && !!next
    if (!next) return
    ref.current.position.copy(flight.position).add(new THREE.Vector3(0, 7, 0))
    arrowTarget.set(...next.position)
    ref.current.lookAt(arrowTarget)
  })
  return (
    <group ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 1.2]}>
        <coneGeometry args={[0.7, 2.4, 4]} />
        <meshBasicMaterial color="#ffd166" toneMapped={false} transparent opacity={0.9} />
      </mesh>
    </group>
  )
}
