import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { TOWN, HATCHERY, GUARD_TOWER, QUEST_GIVER } from './worldSpots'
import { HOUSES, LANTERNS } from './townLayout'
import { daylight } from './time'
import { useGame } from '../../store/gameStore'
import { MISSIONS } from '../../systems/missions'
import { buildTown, createTownMaterials, createCobbleMaterial } from './town/buildings'

const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const v = new THREE.Vector3()
const s3 = new THREE.Vector3()

/** Draksten: streets, houses, lanterns, the guard tower, the royal hatchery and Hedda's stall. */
export function Town() {
  return (
    <group>
      <Ground />
      <Houses />
      <Lanterns />
      <Palisade />
      <GuardTower />
      <Hatchery />
      <QuestGiver />
    </group>
  )
}

function Ground() {
  const y = TOWN.y + 0.06
  const cobble = useMemo(() => createCobbleMaterial(), [])
  return (
    <group>
      {/* plaza */}
      <mesh position={[TOWN.x, y, TOWN.z]} rotation={[-Math.PI / 2, 0, 0]} material={cobble} receiveShadow>
        <circleGeometry args={[20, 48]} />
      </mesh>
      {/* streets */}
      <mesh position={[TOWN.x, y - 0.02, TOWN.z]} rotation={[-Math.PI / 2, 0, 0]} material={cobble} receiveShadow>
        <planeGeometry args={[176, 9]} />
      </mesh>
      <mesh position={[TOWN.x, y - 0.02, TOWN.z]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={cobble} receiveShadow>
        <planeGeometry args={[176, 9]} />
      </mesh>
      {/* fountain */}
      <group position={[TOWN.x, TOWN.y, TOWN.z]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[3.2, 3.4, 1, 12]} />
          <meshStandardMaterial color="#9ca3af" flatShading />
        </mesh>
        <mesh position={[0, 0.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.9, 12]} />
          <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.25} roughness={0.1} />
        </mesh>
        <mesh position={[0, 2.4, 0]}>
          <cylinderGeometry args={[0.4, 0.6, 3, 8]} />
          <meshStandardMaterial color="#9ca3af" flatShading />
        </mesh>
        {/* stone dragon statue on top */}
        <mesh position={[0, 4.4, 0]} rotation={[0, 0.6, 0]}>
          <coneGeometry args={[0.9, 2, 4]} />
          <meshStandardMaterial color="#b0a999" flatShading />
        </mesh>
      </group>
    </group>
  )
}

function Houses() {
  const geos = useMemo(() => buildTown(HOUSES, TOWN.y), [])
  const mats = useMemo(() => createTownMaterials(), [])
  useEffect(
    () => () => {
      Object.values(geos).forEach((g) => g?.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geos, mats],
  )
  useFrame(() => {
    mats.glass.emissiveIntensity = 0.1 + (1 - daylight()) * 2.6
  })
  return (
    <group>
      {(Object.keys(geos) as (keyof typeof geos)[]).map((k) => (
        <mesh key={k} geometry={geos[k]!} material={mats[k]} castShadow={k !== 'glass'} receiveShadow />
      ))}
    </group>
  )
}

function Lanterns() {
  const posts = useRef<THREE.InstancedMesh>(null)
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const bulbMat = useRef<THREE.MeshStandardMaterial>(null)
  useLayoutEffect(() => {
    LANTERNS.forEach(([x, z], i) => {
      m4.compose(v.set(x, TOWN.y + 2, z), q.identity(), s3.set(1, 1, 1))
      posts.current!.setMatrixAt(i, m4)
      m4.compose(v.set(x, TOWN.y + 4.2, z), q.identity(), s3.set(1, 1, 1))
      bulbs.current!.setMatrixAt(i, m4)
    })
    posts.current!.instanceMatrix.needsUpdate = true
    bulbs.current!.instanceMatrix.needsUpdate = true
  }, [])
  useFrame(() => {
    if (bulbMat.current) bulbMat.current.emissiveIntensity = 0.3 + (1 - daylight()) * 3.5
  })
  return (
    <group>
      <instancedMesh ref={posts} args={[undefined, undefined, LANTERNS.length]}>
        <cylinderGeometry args={[0.12, 0.16, 4, 5]} />
        <meshStandardMaterial color="#2b2b2b" flatShading />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, LANTERNS.length]}>
        <octahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial ref={bulbMat} color="#ffd8a0" emissive="#ffb347" emissiveIntensity={0.3} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

function Palisade() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const posts = useMemo(() => {
    const out: [number, number, number][] = []
    const R = TOWN.radius + 4
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2
      // four gates where the streets leave town
      const gate = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.07)
      if (gate) continue
      out.push([TOWN.x + Math.cos(a) * R, TOWN.z + Math.sin(a) * R, 2.8 + ((i * 7) % 5) * 0.25])
    }
    return out
  }, [])
  useLayoutEffect(() => {
    posts.forEach(([x, z, h], i) => {
      m4.compose(v.set(x, TOWN.y + h / 2 - 0.3, z), q.identity(), s3.set(1, h, 1))
      ref.current!.setMatrixAt(i, m4)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [posts])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, posts.length]}>
      <cylinderGeometry args={[0.45, 0.5, 1, 5]} />
      <meshStandardMaterial color="#6b4a2b" flatShading />
    </instancedMesh>
  )
}

function GuardTower() {
  const [x, y, z] = GUARD_TOWER
  const stone = useMemo(() => createTownMaterials().stone, [])
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 14, 0]} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[4.2, 5.2, 28, 32]} />
      </mesh>
      <mesh position={[0, 28.6, 0]} material={stone} castShadow>
        <cylinderGeometry args={[6.2, 5, 1.4, 32]} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 5.8, 30, Math.sin(a) * 5.8]} material={stone} castShadow>
            <boxGeometry args={[1.4, 1.6, 1.4]} />
          </mesh>
        )
      })}
      {/* banner of the Dragon Guard */}
      <mesh position={[0, 36, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 12, 5]} />
        <meshStandardMaterial color="#3f3f46" />
      </mesh>
      <mesh position={[1.6, 39.5, 0]}>
        <planeGeometry args={[3.2, 4.2]} />
        <meshStandardMaterial color="#1e3a8a" side={THREE.DoubleSide} emissive="#1e40af" emissiveIntensity={0.25} />
      </mesh>
    </group>
  )
}

function Hatchery() {
  const [x, y, z] = HATCHERY
  const royalEggDay = useGame((s) => s.royalEggDay)
  const day = useGame((s) => s.day)
  const eggs = useRef<THREE.Group>(null)
  // one royal egg per in-game day
  const taken = royalEggDay === day
  useFrame(({ clock }) => {
    if (eggs.current) eggs.current.children.forEach((c, i) => (c.rotation.y = clock.elapsedTime * 0.6 + i))
  })
  return (
    <group position={[x, y, z]}>
      {/* hall */}
      <mesh position={[0, 5, -8]}>
        <boxGeometry args={[18, 10, 12]} />
        <meshStandardMaterial color="#d6cfc2" flatShading />
      </mesh>
      <mesh position={[0, 10, -8]}>
        <sphereGeometry args={[6.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e5b84a" metalness={0.7} roughness={0.3} flatShading />
      </mesh>
      {[-7.5, -2.5, 2.5, 7.5].map((cx) => (
        <mesh key={cx} position={[cx, 4, -1.6]}>
          <cylinderGeometry args={[0.6, 0.7, 8, 8]} />
          <meshStandardMaterial color="#efe9dd" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 8.4, -1.6]}>
        <boxGeometry args={[18, 0.9, 1.6]} />
        <meshStandardMaterial color="#efe9dd" flatShading />
      </mesh>
      {/* pedestals with royal eggs */}
      <group ref={eggs}>
        {[-4, 0, 4].map((px, i) => (
          <group key={px} position={[px, 0, 3]}>
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.9, 1.1, 1.4, 8]} />
              <meshStandardMaterial color="#9ca3af" flatShading />
            </mesh>
            {!taken && (
              <mesh position={[0, 2.25, 0]} scale={[0.75, 1, 0.75]}>
                <sphereGeometry args={[0.85, 10, 8]} />
                <meshStandardMaterial
                  color={['#fde68a', '#c4b5fd', '#99f6e4'][i]}
                  emissive={['#f59e0b', '#8b5cf6', '#14b8a6'][i]}
                  emissiveIntensity={0.8}
                  metalness={0.6}
                  roughness={0.2}
                  toneMapped={false}
                />
              </mesh>
            )}
          </group>
        ))}
      </group>
      {!taken && <pointLight position={[0, 4, 3]} color="#fde68a" intensity={25} distance={22} />}
    </group>
  )
}

function QuestGiver() {
  const [x, y, z] = QUEST_GIVER
  const completed = useGame((s) => s.completedMissions)
  const active = useGame((s) => s.activeMission)
  const marker = useRef<THREE.Group>(null)
  const available = MISSIONS.some((m) => !completed.includes(m.id) && (!m.requires || completed.includes(m.requires)))
  const turnIn = active && MISSIONS.find((m) => m.id === active.id)?.deliver
  const showMarker = !active ? available : !!turnIn

  useFrame(({ clock }) => {
    if (marker.current) {
      marker.current.position.y = 3.6 + Math.sin(clock.elapsedTime * 2.5) * 0.18
      marker.current.rotation.y = clock.elapsedTime * 1.5
    }
  })

  return (
    <group position={[x, y, z]}>
      {/* market stall */}
      <mesh position={[0, 1, -1.6]}>
        <boxGeometry args={[4, 1.1, 1.4]} />
        <meshStandardMaterial color="#7a5232" flatShading />
      </mesh>
      {[-1.8, 1.8].map((px) => (
        <mesh key={px} position={[px, 1.6, -2.2]}>
          <cylinderGeometry args={[0.1, 0.1, 3.2, 5]} />
          <meshStandardMaterial color="#5c3d22" />
        </mesh>
      ))}
      <mesh position={[0, 3.3, -1.6]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[4.6, 0.15, 2.6]} />
        <meshStandardMaterial color="#b91c1c" flatShading />
      </mesh>
      {/* Hedda */}
      <group position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0.5, 0]} scale={[0.4, 1, 0.3]}>
          <boxGeometry />
          <meshStandardMaterial color="#3f2a1d" flatShading />
        </mesh>
        <mesh position={[0, 1.35, 0]} scale={[0.55, 0.85, 0.36]}>
          <boxGeometry />
          <meshStandardMaterial color="#0f766e" flatShading />
        </mesh>
        <mesh position={[0, 1.98, 0]} scale={[0.19, 0.22, 0.2]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#d1a374" flatShading />
        </mesh>
        <mesh position={[0, 2.18, 0.05]} scale={[0.22, 0.12, 0.22]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#e5e7eb" flatShading />
        </mesh>
      </group>
      {showMarker && (
        <group ref={marker} position={[0, 3.6, 0]}>
          <mesh position={[0, 0.35, 0]}>
            <boxGeometry args={[0.28, 0.9, 0.28]} />
            <meshBasicMaterial color={turnIn ? '#7dd3fc' : '#fbbf24'} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.45, 0]}>
            <boxGeometry args={[0.28, 0.28, 0.28]} />
            <meshBasicMaterial color={turnIn ? '#7dd3fc' : '#fbbf24'} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  )
}
