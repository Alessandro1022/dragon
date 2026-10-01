import { useFrame } from '@react-three/fiber'
import type { RefObject } from 'react'
import * as THREE from 'three'
import { readPitch, readTurn, readBoost, readFlap } from '../input/controls'
import { terrainHeight } from '../world/terrainHeight'
import { resolve } from '../world/colliders'
import { useGame } from '../../store/gameStore'
import { player, WALK } from './playerState'
import type { RiderAnim } from './RiderModel'

const fwd = new THREE.Vector3()

/** Third-person movement: W/S forward/back, A/D turn, Shift run, Space jump. */
export function usePlayer(group: RefObject<THREE.Group | null>, anim: RiderAnim) {
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const s = useGame.getState()
    const active = s.phase === 'playing' && s.mode === 'walking' && s.panel === null
    const move = active ? readPitch() : 0
    const turn = active ? readTurn() : 0
    const run = active && readBoost()

    player.yaw -= turn * WALK.turnRate * dt
    const target = move * (run ? WALK.runSpeed : WALK.walkSpeed) * (move < 0 ? 0.55 : 1)
    player.speed = THREE.MathUtils.damp(player.speed, target, WALK.accel, dt)
    player.running = run && move > 0

    fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw))
    const nx = player.position.x + fwd.x * player.speed * dt
    const nz = player.position.z + fwd.z * player.speed * dt
    // the ocean is a wall on foot
    if (terrainHeight(nx, nz) > -0.6) {
      player.position.x = nx
      player.position.z = nz
    } else {
      player.speed = 0
    }
    resolve(player.position, 0.45)

    // gravity & jumping
    const ground = terrainHeight(player.position.x, player.position.z)
    if (player.grounded && active && readFlap()) {
      player.vy = WALK.jump
      player.grounded = false
    }
    player.vy -= WALK.gravity * dt
    player.position.y += player.vy * dt
    if (player.position.y <= ground) {
      player.position.y = ground
      player.vy = 0
      player.grounded = true
    } else if (player.position.y - ground > 0.3) {
      player.grounded = false
    }

    anim.speed = Math.abs(player.speed)
    anim.grounded = player.grounded
    anim.seated = false

    if (group.current) {
      group.current.position.copy(player.position)
      group.current.rotation.y = player.yaw
    }
  })
}
