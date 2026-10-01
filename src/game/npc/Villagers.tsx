import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { STROLL_POINTS } from '../world/townLayout'
import { TOWN } from '../world/worldSpots'
import { terrainHeight } from '../world/terrainHeight'
import { resolve } from '../world/colliders'
import { flight } from '../dragon/flightState'
import { player } from '../player/playerState'
import { heat } from '../heat'
import { useGame } from '../../store/gameStore'
import { RiderModel, type RiderAnim } from '../player/RiderModel'

const COUNT = 16
const TUNICS = ['#9a3412', '#1d4ed8', '#15803d', '#a16207', '#6b21a8', '#be123c', '#0f766e', '#57534e']
const HAIR = ['#2b1a10', '#4a2f1d', '#d6b370', '#111827', '#9ca3af']

interface Villager {
  pos: THREE.Vector3
  target: number
  speed: number
  yaw: number
  phase: number
  anim: RiderAnim
  colors: { tunic: string; leather: string; cape: string; skin: string; trim: string; boots: string }
  wait: number
  tunic: string
  hair: string
  scale: number
}

const tmp = new THREE.Vector3()
const threat = new THREE.Vector3()

/** Townsfolk stroll between the plaza and the streets — and scatter when fire or guards appear. */
export function Villagers() {
  const people = useMemo<Villager[]>(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const [x, z] = STROLL_POINTS[(i * 5) % STROLL_POINTS.length]
        return {
          pos: new THREE.Vector3(x + (i % 3), terrainHeight(x, z), z + (i % 2)),
          target: (i * 7 + 3) % STROLL_POINTS.length,
          speed: 1.3 + (i % 4) * 0.25,
          yaw: 0,
          phase: i,
          anim: { speed: 0, grounded: true, seated: false },
          colors: {
            tunic: TUNICS[i % TUNICS.length],
            leather: ['#6b4a2b', '#4a3526', '#7a5a3a'][i % 3],
            cape: TUNICS[(i + 3) % TUNICS.length],
            skin: ['#c68e5f', '#e0b48c', '#8d5a3b', '#a8714a'][i % 4],
            trim: '#b08d57',
            boots: '#2a1f17',
          },
          wait: (i % 5) * 0.8,
          tunic: TUNICS[i % TUNICS.length],
          hair: HAIR[i % HAIR.length],
          scale: 0.88 + (i % 3) * 0.07,
        }
      }),
    [],
  )
  const refs = useRef<(THREE.Group | null)[]>([])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const s = useGame.getState()
    // the threat is your dragon (flying or parked) when the town is on alert, or any fire nearby
    threat.copy(s.mode === 'flying' ? flight.position : player.position)
    const alarmed = heat.level > 0 || flight.firing

    people.forEach((p, i) => {
      let moving = false
      tmp.subVectors(p.pos, threat).setY(0)
      const fleeing = alarmed && tmp.length() < 45
      if (fleeing) {
        tmp.normalize()
        p.pos.addScaledVector(tmp, 6.5 * dt)
        p.yaw = Math.atan2(-tmp.x, -tmp.z)
        moving = true
      } else if (p.wait > 0) {
        p.wait -= dt
      } else {
        const [tx, tz] = STROLL_POINTS[p.target]
        tmp.set(tx - p.pos.x, 0, tz - p.pos.z)
        const d = tmp.length()
        if (d < 1) {
          p.target = (p.target + 1 + ((i * 3) % 5)) % STROLL_POINTS.length
          p.wait = 1 + ((i * 13) % 7) * 0.5
        } else {
          tmp.divideScalar(d)
          p.pos.addScaledVector(tmp, p.speed * dt)
          const yaw = Math.atan2(-tmp.x, -tmp.z)
          let diff = yaw - p.yaw
          diff = Math.atan2(Math.sin(diff), Math.cos(diff))
          p.yaw += diff * Math.min(1, dt * 6)
          moving = true
        }
      }
      // stay inside the palisade and out of houses
      tmp.set(p.pos.x - TOWN.x, 0, p.pos.z - TOWN.z)
      if (tmp.length() > TOWN.radius - 3) p.pos.set(TOWN.x, 0, TOWN.z).addScaledVector(tmp.normalize(), TOWN.radius - 3)
      resolve(p.pos, 0.4)
      p.pos.y = terrainHeight(p.pos.x, p.pos.z)

      p.phase += dt * (fleeing ? 14 : moving ? 8 : 0)
      p.anim.speed = fleeing ? 9 : moving ? p.speed * 3 : 0
      const g = refs.current[i]
      if (g) {
        g.position.copy(p.pos)
        g.rotation.y = p.yaw
      }

    })
  })

  return (
    <group>
      {people.map((p, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          scale={p.scale}
        >
          <RiderModel anim={p.anim} colors={p.colors} plain />
        </group>
      ))}
    </group>
  )
}
