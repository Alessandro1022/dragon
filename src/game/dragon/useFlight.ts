import { useFrame } from '@react-three/fiber'
import type { RefObject } from 'react'
import * as THREE from 'three'
import { readPitch, readTurn, readBoost, readFlap } from '../input/controls'
import { surfaceHeight, ISLAND_RADIUS } from '../world/terrainHeight'
import { flight, FLIGHT } from './flightState'
import { useGame } from '../../store/gameStore'

const euler = new THREE.Euler(0, 0, 0, 'YXZ')
const tmp = new THREE.Vector3()
let hudTimer = 0

/**
 * Arcade flight model: diving trades altitude for speed, climbing bleeds it,
 * banking turns, Shift boosts and Space flaps for lift. Both cost stamina.
 */
export function useFlight(group: RefObject<THREE.Group | null>) {
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const playing = useGame.getState().phase === 'playing'
    const pitchIn = playing ? readPitch() : 0
    const turnIn = playing ? readTurn() : 0.25 // gentle orbit on the menu screen

    // --- orientation ---
    flight.yaw -= turnIn * FLIGHT.turnRate * dt * (0.6 + 0.4 * Math.min(1, flight.speed / 60))
    const targetBank = -turnIn * FLIGHT.maxBank
    flight.bank = THREE.MathUtils.damp(flight.bank, targetBank, 4, dt)

    if (pitchIn !== 0) {
      flight.pitch += pitchIn * FLIGHT.pitchRate * dt
    } else {
      flight.pitch = THREE.MathUtils.damp(flight.pitch, 0, 0.9, dt) // auto-level
    }
    flight.pitch = THREE.MathUtils.clamp(flight.pitch, -FLIGHT.maxPitch, FLIGHT.maxPitch)

    euler.set(flight.pitch, flight.yaw, 0)
    flight.forward.set(0, 0, -1).applyEuler(euler)

    // --- energy: dive = faster, climb = slower ---
    const wantsBoost = playing && readBoost() && flight.stamina > 0.02
    const wantsFlap = playing && readFlap() && flight.stamina > 0.02
    flight.boosting = wantsBoost
    flight.flapping = wantsFlap

    flight.speed += -Math.sin(flight.pitch) * FLIGHT.gravity * dt
    flight.speed += (FLIGHT.cruiseSpeed - flight.speed) * FLIGHT.drag * dt
    if (wantsBoost) flight.speed += FLIGHT.boostAccel * dt
    flight.speed = THREE.MathUtils.clamp(flight.speed, FLIGHT.minSpeed, FLIGHT.maxSpeed)

    // stamina
    if (wantsBoost) flight.stamina -= FLIGHT.staminaDrainBoost * dt
    if (wantsFlap) flight.stamina -= FLIGHT.staminaDrainFlap * dt
    if (!wantsBoost && !wantsFlap) flight.stamina += FLIGHT.staminaRegen * dt
    flight.stamina = THREE.MathUtils.clamp(flight.stamina, 0, 1)

    // --- integrate position ---
    flight.velocity.copy(flight.forward).multiplyScalar(flight.speed)
    if (wantsFlap) flight.velocity.y += FLIGHT.flapLift
    // low speed = the dragon starts to sink
    const stall = THREE.MathUtils.clamp((26 - flight.speed) / 12, 0, 1)
    flight.velocity.y -= stall * 14

    flight.position.addScaledVector(flight.velocity, dt)

    // --- ground & water ---
    const ground = surfaceHeight(flight.position.x, flight.position.z) + FLIGHT.groundClearance
    flight.grounded = false
    if (flight.position.y < ground) {
      flight.position.y = ground
      flight.grounded = true
      if (flight.pitch < 0) flight.pitch = THREE.MathUtils.damp(flight.pitch, 0.15, 8, dt)
      flight.speed = Math.max(FLIGHT.minSpeed, flight.speed * (1 - 0.6 * dt))
    }
    if (flight.position.y > FLIGHT.ceiling) {
      flight.position.y = FLIGHT.ceiling
      flight.pitch = Math.min(flight.pitch, 0)
    }

    // --- soft world boundary: steer back toward the island ---
    tmp.set(flight.position.x, 0, flight.position.z)
    const dist = tmp.length()
    const limit = ISLAND_RADIUS * 1.55
    if (dist > limit) {
      const toCenter = Math.atan2(-flight.position.x, -flight.position.z)
      const desiredYaw = toCenter
      let diff = desiredYaw - flight.yaw
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      flight.yaw += diff * Math.min(1, (dist - limit) / 200) * dt * 2
    }

    // --- apply to the dragon mesh ---
    if (group.current) {
      group.current.position.copy(flight.position)
      group.current.rotation.set(flight.pitch, flight.yaw, flight.bank, 'YXZ')
    }

    // --- HUD telemetry at ~10 Hz to avoid re-rendering React every frame ---
    hudTimer += dt
    if (hudTimer > 0.1) {
      hudTimer = 0
      useGame.getState().setTelemetry({
        speed: flight.speed,
        altitude: flight.position.y - surfaceHeight(flight.position.x, flight.position.z),
        stamina: flight.stamina,
        boosting: flight.boosting,
      })
    }
  })
}
