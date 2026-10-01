import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { flight, FLIGHT } from './dragon/flightState'
import { player } from './player/playerState'
import { useGame } from '../store/gameStore'
import { surfaceHeight } from './world/terrainHeight'
import { colliders } from './world/colliders'

const desired = new THREE.Vector3()
const look = new THREE.Vector3()
const smoothLook = new THREE.Vector3()
const offset = new THREE.Vector3()
const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)

/** Chase camera for flight, over-the-shoulder camera on foot, orbit on the menu. */
export function CameraRig() {
  const { camera } = useThree()
  const shake = useRef(0)
  const orbit = useRef(0)
  const walkYaw = useRef(player.yaw)

  useFrame((_, rawDt) => {
    // dev screenshots run at ~1 fps in software rendering: snap instead of easing
    const snap = import.meta.env.DEV && (window as unknown as { __snapCam?: boolean }).__snapCam
    const dt = snap ? 10 : Math.min(rawDt, 1 / 20)
    const cam = camera as THREE.PerspectiveCamera
    const s = useGame.getState()
    const playing = s.phase === 'playing'
    const walking = playing && s.mode === 'walking'
    const portrait = cam.aspect < 1 ? 1.5 : 1
    const speedK = (flight.speed - FLIGHT.minSpeed) / (FLIGHT.maxSpeed - FLIGHT.minSpeed)
    let targetFov = 60

    if (!playing) {
      orbit.current += dt * 0.18
      offset.set(Math.sin(orbit.current) * 26, 7, Math.cos(orbit.current) * 26)
      desired.copy(flight.position).add(offset)
      look.copy(flight.position).addScaledVector(flight.forward, 2)
      look.y += 2
    } else if (walking) {
      // camera yaw lags the player's for a smooth over-the-shoulder feel
      let diff = player.yaw - walkYaw.current
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      walkYaw.current += diff * Math.min(1, dt * 4)
      const dist = 7.5 * portrait + (player.running ? 1.5 : 0)
      offset.set(0, 3.2 * (portrait > 1 ? 1.2 : 1), dist).applyAxisAngle(Y, walkYaw.current)
      desired.copy(player.position).add(offset)
      look.set(-Math.sin(walkYaw.current), 0, -Math.cos(walkYaw.current)).multiplyScalar(3).add(player.position)
      look.y += 1.8
      targetFov = player.running ? 66 : 58
    } else {
      walkYaw.current = flight.yaw
      const dist = (22 + speedK * 10) * portrait
      offset.set(0, 6.5 - flight.pitch * 4, dist).applyAxisAngle(X, flight.pitch * 0.45).applyAxisAngle(Y, flight.yaw)
      desired.copy(flight.position).add(offset)
      look.copy(flight.position).addScaledVector(flight.forward, 12)
      look.y += 2
      targetFov = 60 + speedK * 22
    }

    // on foot: don't let walls and trees come between the camera and the rider
    if (walking) {
      const px = player.position.x
      const pz = player.position.z
      for (let k = 0; k < 12; k++) {
        const blocked = colliders.some((c) => {
          const dx = desired.x - c.x
          const dz = desired.z - c.z
          return dx * dx + dz * dz < (c.r + 0.4) * (c.r + 0.4)
        })
        if (!blocked) break
        desired.x = px + (desired.x - px) * 0.82
        desired.z = pz + (desired.z - pz) * 0.82
      }
    }

    const floor = surfaceHeight(desired.x, desired.z) + (walking ? 1.2 : 3)
    if (desired.y < floor) desired.y = floor

    cam.position.lerp(desired, 1 - Math.exp(-(playing ? (walking ? 6 : 5.5) : 2) * dt))
    smoothLook.lerp(look, 1 - Math.exp(-8 * dt))
    cam.lookAt(smoothLook)

    shake.current = THREE.MathUtils.damp(shake.current, flight.boosting && !walking ? 1 : 0, 6, dt)
    if (!walking) cam.rotateZ(flight.bank * 0.12)
    if (shake.current > 0.01) {
      cam.position.x += (Math.random() - 0.5) * 0.12 * shake.current
      cam.position.y += (Math.random() - 0.5) * 0.12 * shake.current
    }

    cam.fov = THREE.MathUtils.damp(cam.fov, targetFov + shake.current * 6, 3, dt)
    cam.updateProjectionMatrix()
  })

  return null
}
