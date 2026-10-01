import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { readFlightPitch, readTurn, readBoost, readFlap, readFire } from '../input/controls'
import { surfaceHeight, ISLAND_RADIUS } from '../world/terrainHeight'
import { flight, FLIGHT } from './flightState'
import { useGame, selectActive } from '../../store/gameStore'
import { flightMultipliers, view } from '../../systems/dragons'

const euler = new THREE.Euler(0, 0, 0, 'YXZ')
const tmp = new THREE.Vector3()
let hudTimer = 0

/**
 * Arcade flight model: diving trades altitude for speed, climbing bleeds it,
 * banking turns, Shift boosts and Space flaps for lift. Both cost stamina.
 * The ridden dragon's trained stats scale speed, stamina and boost.
 * Returns false when the dragon isn't flying (parked on the ground).
 */
export function useFlight() {
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const s = useGame.getState()
    const playing = s.phase === 'playing'
    if (s.panel === 'settings') return // paused
    if (playing && s.mode !== 'flying') {
      flight.firing = false
      return
    }
    const free = playing && s.panel === null

    const active = selectActive(s)
    const mul = flightMultipliers(active ? view(active) : null)
    const maxSpeed = FLIGHT.maxSpeed * mul.speed
    const cruise = FLIGHT.cruiseSpeed * mul.speed

    let pitchIn = free ? readFlightPitch() : 0
    const turnIn = playing ? (free ? readTurn() : 0) : 0.25 // gentle orbit on the menu screen

    // forced climb right after mounting
    if (flight.takeoff > 0) {
      flight.takeoff -= dt
      pitchIn = Math.max(pitchIn, 0.6)
    }

    // --- orientation ---
    flight.yaw -= turnIn * FLIGHT.turnRate * dt * (0.6 + 0.4 * Math.min(1, flight.speed / 60))
    flight.bank = THREE.MathUtils.damp(flight.bank, -turnIn * FLIGHT.maxBank, 4, dt)

    if (pitchIn !== 0) flight.pitch += pitchIn * FLIGHT.pitchRate * dt
    else flight.pitch = THREE.MathUtils.damp(flight.pitch, 0, 0.9, dt) // auto-level
    flight.pitch = THREE.MathUtils.clamp(flight.pitch, -FLIGHT.maxPitch, FLIGHT.maxPitch)

    euler.set(flight.pitch, flight.yaw, 0)
    flight.forward.set(0, 0, -1).applyEuler(euler)

    // --- energy: dive = faster, climb = slower ---
    const wantsBoost = free && readBoost() && flight.stamina > 0.02
    const wantsFlap = (free && readFlap() && flight.stamina > 0.02) || flight.takeoff > 0
    flight.boosting = wantsBoost
    flight.flapping = wantsFlap
    flight.firing = free && readFire() && flight.stamina > 0.02

    flight.speed += -Math.sin(flight.pitch) * FLIGHT.gravity * dt
    flight.speed += (cruise - flight.speed) * FLIGHT.drag * dt
    if (wantsBoost) flight.speed += FLIGHT.boostAccel * mul.boost * dt
    flight.speed = THREE.MathUtils.clamp(flight.speed, FLIGHT.minSpeed, maxSpeed)

    if (wantsBoost) flight.stamina -= (FLIGHT.staminaDrainBoost / mul.stamina) * dt
    if (wantsFlap && flight.takeoff <= 0) flight.stamina -= (FLIGHT.staminaDrainFlap / mul.stamina) * dt
    if (flight.firing) flight.stamina -= (0.16 / mul.stamina) * dt
    if (!wantsBoost && !wantsFlap && !flight.firing) flight.stamina += FLIGHT.staminaRegen * mul.stamina * dt
    flight.stamina = THREE.MathUtils.clamp(flight.stamina, 0, 1)

    // --- integrate ---
    flight.velocity.copy(flight.forward).multiplyScalar(flight.speed)
    if (wantsFlap) flight.velocity.y += FLIGHT.flapLift
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
      let diff = toCenter - flight.yaw
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      flight.yaw += diff * Math.min(1, (dist - limit) / 200) * dt * 2
    }

    // --- HUD telemetry at ~10 Hz ---
    hudTimer += dt
    if (hudTimer > 0.1 && playing) {
      hudTimer = 0
      s.setTelemetry({
        speed: flight.speed,
        altitude: flight.position.y - surfaceHeight(flight.position.x, flight.position.z),
        stamina: flight.stamina,
        boosting: flight.boosting,
      })
    }
  })
}
