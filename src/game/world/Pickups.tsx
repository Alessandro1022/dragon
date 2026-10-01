import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { BERRY_SPOTS, FISH_SPOTS } from './worldSpots'
import { player } from '../player/playerState'
import { flight } from '../dragon/flightState'
import { useGame } from '../../store/gameStore'
import { FOOD, type FoodKind } from '../../systems/dragons'

const RESPAWN = 75 // seconds
const BERRIES_PER_BUSH = 6

interface Spot {
  kind: FoodKind
  pos: THREE.Vector3
  takenAt: number
}

const bushes: Spot[] = BERRY_SPOTS.map((p) => ({ kind: 'berries', pos: new THREE.Vector3(...p), takenAt: -Infinity }))
const fishes: Spot[] = FISH_SPOTS.map((p) => ({ kind: 'fish', pos: new THREE.Vector3(...p), takenAt: -Infinity }))

const m = new THREE.Matrix4()
const q = new THREE.Quaternion()
const e = new THREE.Euler()
const v = new THREE.Vector3()
const sc = new THREE.Vector3()
const fishPos = new THREE.Vector3()
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0)
// flat tail fin pointing backwards (+Z)
const tailGeometry = new THREE.ConeGeometry(0.45, 0.6, 3).rotateX(-Math.PI / 2).scale(0.25, 1, 1)

/**
 * Food in the world: berry bushes on meadows, fish leaping in the shallows.
 * Collected on foot or by skimming low over them on the dragon.
 * Everything is instanced: four draw calls for ~80 pickups.
 */
export function Pickups() {
  const bushMesh = useRef<THREE.InstancedMesh>(null)
  const berryMesh = useRef<THREE.InstancedMesh>(null)
  const fishBody = useRef<THREE.InstancedMesh>(null)
  const fishTail = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    bushes.forEach((b, i) => {
      m.compose(v.copy(b.pos).setY(b.pos.y + 0.6), q.identity(), sc.set(1.2, 0.9, 1.2))
      bushMesh.current!.setMatrixAt(i, m)
    })
    bushMesh.current!.instanceMatrix.needsUpdate = true
  }, [])

  const collect = (spot: Spot, at: THREE.Vector3, now: number, walking: boolean) => {
    const d = walking ? player.position.distanceTo(at) : flight.position.distanceTo(at)
    if (d < (walking ? 2.6 : 9)) {
      spot.takenAt = now
      const n = spot.kind === 'berries' ? 2 : 1
      const s = useGame.getState()
      s.addFood(spot.kind, n)
      s.toast(`+${n} ${FOOD[spot.kind].label}`)
    }
  }

  useFrame(({ clock }) => {
    const s = useGame.getState()
    const now = clock.elapsedTime
    const playing = s.phase === 'playing'
    const walking = s.mode === 'walking'

    bushes.forEach((b, i) => {
      const available = now - b.takenAt > RESPAWN
      for (let k = 0; k < BERRIES_PER_BUSH; k++) {
        const idx = i * BERRIES_PER_BUSH + k
        if (!available) {
          berryMesh.current!.setMatrixAt(idx, HIDDEN)
          continue
        }
        const a = k * 1.05 + now * 0.3 + i
        v.set(b.pos.x + Math.cos(a) * 0.95, b.pos.y + 0.55 + (k % 2) * 0.45, b.pos.z + Math.sin(a) * 0.95)
        m.compose(v, q.identity(), sc.setScalar(0.2))
        berryMesh.current!.setMatrixAt(idx, m)
      }
      if (available && playing) collect(b, b.pos, now, walking)
    })
    berryMesh.current!.instanceMatrix.needsUpdate = true

    fishes.forEach((f, i) => {
      const available = now - f.takenAt > RESPAWN
      if (!available) {
        fishBody.current!.setMatrixAt(i, HIDDEN)
        fishTail.current!.setMatrixAt(i, HIDDEN)
        return
      }
      const ph = (now * 0.9 + i * 1.7) % 4
      const jump = ph < 1 ? Math.sin(ph * Math.PI) : 0
      fishPos.set(f.pos.x, jump * 3 + 0.2, f.pos.z)
      q.setFromEuler(e.set(ph < 1 ? (ph - 0.5) * 2.4 : 0, i, 0))
      m.compose(fishPos, q, sc.set(0.45, 0.52, 1.3))
      fishBody.current!.setMatrixAt(i, m)
      v.set(0, 0, 1.35).applyQuaternion(q).add(fishPos)
      m.compose(v, q, sc.set(1.3, 1.3, 1.3))
      fishTail.current!.setMatrixAt(i, m)
      if (playing) collect(f, fishPos, now, walking)
    })
    fishBody.current!.instanceMatrix.needsUpdate = true
    fishTail.current!.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={bushMesh} args={[undefined, undefined, bushes.length]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#2f6b35" flatShading />
      </instancedMesh>
      <instancedMesh ref={berryMesh} args={[undefined, undefined, bushes.length * BERRIES_PER_BUSH]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ef4444" emissive="#ff2a1f" emissiveIntensity={1.4} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={fishBody} args={[undefined, undefined, fishes.length]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.25} emissive="#7dd3fc" emissiveIntensity={0.4} flatShading />
      </instancedMesh>
      <instancedMesh ref={fishTail} args={[tailGeometry, undefined, fishes.length]} frustumCulled={false}>
        <meshStandardMaterial color="#94a3b8" flatShading />
      </instancedMesh>
    </group>
  )
}
