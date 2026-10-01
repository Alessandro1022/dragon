import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { DragonModel, type DragonAnim } from './DragonModel'
import { useDragonLook } from './look'
import { flight } from './flightState'
import { player } from '../player/playerState'
import { surfaceHeight } from '../world/terrainHeight'
import { useGame, selectCompanion } from '../../store/gameStore'
import { view } from '../../systems/dragons'

const target = new THREE.Vector3()
const right = new THREE.Vector3()
const back = new THREE.Vector3()
const prev = new THREE.Vector3()
const vel = new THREE.Vector3()

/** Your young dragon: flutters at your shoulder on foot, flies in formation in the air. */
export function Companion() {
  const group = useRef<THREE.Group>(null)
  const pos = useRef(new THREE.Vector3(player.position.x + 3, player.position.y + 3, player.position.z)).current
  const yaw = useRef(0)
  const companion = useGame(selectCompanion)
  const look = useDragonLook(companion)
  const anim = useRef<DragonAnim>({ mode: 'hover', flapping: true, boosting: false, pitch: 0, bank: 0, look: 0 }).current
  const placed = useRef(false)
  const placedFor = useRef<string | null>(null)

  useFrame(({ clock }, rawDt) => {
    if (!companion || !group.current) return
    const dt = Math.min(rawDt, 1 / 20)
    const s = useGame.getState()
    const scale = view(companion).stage.scale
    const flying = s.phase === 'playing' && s.mode === 'flying'
    const t = clock.elapsedTime

    if (flying) {
      right.set(Math.cos(flight.yaw), 0, -Math.sin(flight.yaw))
      target
        .copy(flight.position)
        .addScaledVector(right, 9 + scale * 10)
        .addScaledVector(flight.forward, -3)
      target.y += 2 + Math.sin(t * 1.3) * 1.2
    } else {
      right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw))
      back.set(Math.sin(player.yaw), 0, Math.cos(player.yaw))
      const spread = 1.4 + scale * 7
      target
        .copy(player.position)
        .addScaledVector(right, spread)
        .addScaledVector(back, 1 + scale * 4)
      target.y += 1.9 + scale * 3.2 + Math.sin(t * 2.4) * 0.25
    }

    if (placedFor.current !== companion.id) {
      placed.current = false
      placedFor.current = companion.id
    }
    if (!placed.current) {
      pos.copy(target)
      group.current.scale.setScalar(scale)
      placed.current = true
    }
    prev.copy(pos)
    pos.lerp(target, 1 - Math.exp(-(flying ? 3.5 : 4) * dt))
    const floor = surfaceHeight(pos.x, pos.z) + 1 + scale * 2
    if (pos.y < floor) pos.y = floor

    vel.subVectors(pos, prev).divideScalar(Math.max(dt, 1e-4))
    const horiz = Math.hypot(vel.x, vel.z)
    const desiredYaw = horiz > 1.5 ? Math.atan2(-vel.x, -vel.z) : flying ? flight.yaw : player.yaw
    let diff = desiredYaw - yaw.current
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    yaw.current += diff * Math.min(1, dt * 5)

    anim.mode = flying && horiz > 20 ? 'fly' : 'hover'
    anim.flapping = true
    anim.pitch = THREE.MathUtils.clamp(vel.y * 0.02, -0.4, 0.4)
    anim.bank = THREE.MathUtils.damp(anim.bank, -diff * 1.2, 4, dt)
    anim.boosting = flying && flight.boosting

    group.current.position.copy(pos)
    group.current.rotation.set(anim.pitch, yaw.current, anim.bank, 'YXZ')
    group.current.scale.setScalar(THREE.MathUtils.damp(group.current.scale.x, scale, 2, dt))
  })

  if (!companion || !look) return null
  return (
    <group ref={group} scale={view(companion).stage.scale}>
      <DragonModel look={look} anim={anim} />
    </group>
  )
}
