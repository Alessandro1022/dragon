import * as THREE from 'three'
import { PLAYER_SPAWN } from '../world/worldSpots'

/** Mutable state of the on-foot player, read by camera, interaction and companion. */
export const player = {
  position: new THREE.Vector3(...PLAYER_SPAWN),
  yaw: Math.PI * 0.75,
  vy: 0,
  speed: 0,
  grounded: true,
  running: false,
}

export const WALK = {
  walkSpeed: 6,
  runSpeed: 13,
  turnRate: 2.6,
  jump: 9.5,
  gravity: 26,
  accel: 10,
}

export function placePlayerNear(pos: THREE.Vector3, yaw: number) {
  // step off to the dragon's left side
  const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(-5)
  player.position.copy(pos).add(side)
  player.yaw = yaw
  player.vy = 0
  player.speed = 0
}
