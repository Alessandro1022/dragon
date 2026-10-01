import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CAMP } from './worldSpots'
import { registerTarget, type Target } from '../combat'
import { useGame } from '../../store/gameStore'
import { emit } from '../effects/particles'

const TENT_HP = 70
const up = new THREE.Vector3()
const at = new THREE.Vector3()

interface Tent {
  target: Target
  angle: number
}

/** Bandit camp in the eastern hills: four tents that burn. Rebuilt every dawn. */
export function BanditCamp() {
  const day = useGame((s) => s.day)
  const tents = useMemo<Tent[]>(
    () =>
      [0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 + 0.4
        const position = new THREE.Vector3(CAMP.x + Math.cos(angle) * 14, CAMP.y + 2, CAMP.z + Math.sin(angle) * 14)
        return {
          angle,
          target: {
            id: `tent-${i}`,
            kind: 'tent',
            position,
            radius: 4,
            hp: TENT_HP,
            maxHp: TENT_HP,
            alive: true,
            burning: 99,
            onDestroyed: () => {
              useGame.getState().bump('tentsBurned')
              useGame.getState().toast('Ett tält brann ner!')
            },
          },
        }
      }),
    [],
  )

  useEffect(() => {
    const offs = tents.map((t) => registerTarget(t.target))
    return () => offs.forEach((o) => o())
  }, [tents])

  // rebuild at dawn
  useEffect(() => {
    tents.forEach((t) => {
      t.target.hp = TENT_HP
      t.target.alive = true
      t.target.burning = 99
    })
  }, [day, tents])

  const canvas = useRef<(THREE.Mesh | null)[]>([])
  const flames = useRef<(THREE.Group | null)[]>([])
  const campfire = useRef<THREE.PointLight>(null)

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    tents.forEach((tent, i) => {
      tent.target.burning += dt
      const c = canvas.current[i]
      if (c) {
        const mat = c.material as THREE.MeshStandardMaterial
        const charred = 1 - Math.max(0, tent.target.hp) / TENT_HP
        mat.color.set('#c9b48a').lerp(new THREE.Color('#1c1917'), charred)
        c.scale.y = tent.target.alive ? 1 : 0.35
      }
      const f = flames.current[i]
      if (f) {
        const lit = tent.target.burning < 1.5 || (!tent.target.alive && tent.target.burning < 12)
        f.visible = lit
        if (lit) {
          f.scale.setScalar(0.8 + Math.sin(t * 18 + i) * 0.15 + Math.random() * 0.1)
          if (Math.random() < dt * 30) {
            at.copy(tent.target.position).add(up.set((Math.random() - 0.5) * 4, 1 + Math.random() * 2, (Math.random() - 0.5) * 4))
            emit(at, up.set(0, 6, 0), { spread: 3, life: 0.8, size: 3.5 })
            emit(at.setY(at.y + 3), up.set(0, 5, 0), { spread: 2, life: 3, size: 5, kind: 1 })
          }
        }
      }
    })
    if (campfire.current) campfire.current.intensity = 14 + Math.sin(t * 13) * 3
  })

  return (
    <group>
      {tents.map((tent, i) => (
        <group key={i} position={tent.target.position.clone().setY(CAMP.y)} rotation={[0, -tent.angle, 0]}>
          <mesh
            ref={(el) => {
              canvas.current[i] = el
            }}
            position={[0, 2.2, 0]}
          >
            <coneGeometry args={[3.6, 4.4, 6]} />
            <meshStandardMaterial color="#c9b48a" flatShading roughness={1} />
          </mesh>
          <group
            ref={(el) => {
              flames.current[i] = el
            }}
            position={[0, 2.5, 0]}
            visible={false}
          >
            <mesh position={[0, 1.4, 0]}>
              <coneGeometry args={[2.4, 5.5, 7, 1, true]} />
              <meshBasicMaterial color="#ff8a1f" transparent opacity={0.75} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.8, 0]}>
              <coneGeometry args={[1.3, 3.2, 7, 1, true]} />
              <meshBasicMaterial color="#ffe08a" toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      ))}
      {/* campfire, crates and a lookout post */}
      <group position={[CAMP.x, CAMP.y, CAMP.z]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.cos(i * 1.26) * 0.7, 0.3, Math.sin(i * 1.26) * 0.7]} rotation={[0, i * 1.26, Math.PI / 2.4]}>
            <cylinderGeometry args={[0.15, 0.18, 1.6, 5]} />
            <meshStandardMaterial color="#3f2a1d" />
          </mesh>
        ))}
        <mesh position={[0, 0.9, 0]}>
          <coneGeometry args={[0.6, 1.4, 6, 1, true]} />
          <meshBasicMaterial color="#ffb02e" toneMapped={false} />
        </mesh>
        <pointLight ref={campfire} position={[0, 2, 0]} color="#ff9a2e" intensity={14} distance={30} />
        {[
          [5, 0, -3],
          [-4, 0, 5],
          [6, 0, 4],
        ].map((p, i) => (
          <mesh key={i} position={[p[0], 0.7, p[2]]} rotation={[0, i, 0]}>
            <boxGeometry args={[1.4, 1.4, 1.4]} />
            <meshStandardMaterial color="#7a5232" flatShading />
          </mesh>
        ))}
        <mesh position={[-9, 5, -9]}>
          <cylinderGeometry args={[0.3, 0.35, 10, 5]} />
          <meshStandardMaterial color="#5c3d22" />
        </mesh>
        <mesh position={[-9, 10, -9]}>
          <boxGeometry args={[3, 0.4, 3]} />
          <meshStandardMaterial color="#6b4a2b" flatShading />
        </mesh>
        <mesh position={[-9, 11.8, -9]} rotation={[0, 0, 0]}>
          <planeGeometry args={[2.2, 1.4]} />
          <meshStandardMaterial color="#111827" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}
