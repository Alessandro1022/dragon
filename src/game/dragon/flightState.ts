import * as THREE from 'three'

/**
 * Single source of truth for the player's dragon in the 3D world.
 * Mutated every frame by useFlight; read by camera, rings and HUD.
 */
export const flight = {
  position: new THREE.Vector3(0, 140, 900),
  velocity: new THREE.Vector3(),
  forward: new THREE.Vector3(0, 0, -1),
  yaw: 0,
  pitch: 0,
  bank: 0,
  speed: 38,
  stamina: 1,
  boosting: false,
  flapping: false,
  grounded: false,
}

export const FLIGHT = {
  minSpeed: 14,
  cruiseSpeed: 38,
  maxSpeed: 120,
  boostAccel: 26,
  gravity: 22,
  drag: 0.35,
  turnRate: 1.15,
  pitchRate: 1.25,
  maxPitch: 1.15,
  maxBank: 0.95,
  flapLift: 30,
  staminaDrainBoost: 0.28,
  staminaDrainFlap: 0.22,
  staminaRegen: 0.12,
  groundClearance: 3.5,
  ceiling: 900,
}

export function resetFlight() {
  flight.position.set(0, 140, 900)
  flight.velocity.set(0, 0, 0)
  flight.yaw = 0
  flight.pitch = 0
  flight.bank = 0
  flight.speed = FLIGHT.cruiseSpeed
  flight.stamina = 1
}
