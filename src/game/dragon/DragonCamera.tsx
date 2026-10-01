import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { flight, FLIGHT } from './flightState'
import { useGame } from '../../store/gameStore'
import { surfaceHeight } from '../world/terrainHeight'

const desired = new THREE.Vector3()
const look = new THREE.Vector3()
const smoothLook = new THREE.Vector3()
const offset = new THREE.Vector3()

/** Chase camera: trails behind the dragon, widens FOV with speed. */
export function DragonCamera() {
  const { camera } = useThree()
  const shake = useRef(0)
  const orbit = useRef(0)

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const cam = camera as THREE.PerspectiveCamera
    const playing = useGame.getState().phase === 'playing'
    const speedK = (flight.speed - FLIGHT.minSpeed) / (FLIGHT.maxSpeed - FLIGHT.minSpeed)

    if (!playing) {
      // cinematic orbit on the start screen
      orbit.current += dt * 0.18
      offset.set(Math.sin(orbit.current) * 26, 7, Math.cos(orbit.current) * 26)
      desired.copy(flight.position).add(offset)
    } else {
      // behind & above, following yaw and a fraction of pitch
      // portrait phones need the camera further back to fit the wingspan
      const portrait = cam.aspect < 1 ? 1.5 : 1
      const dist = (22 + speedK * 10) * portrait
      offset.set(0, 6.5 - flight.pitch * 4, dist)
      offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), flight.pitch * 0.45)
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), flight.yaw)
      desired.copy(flight.position).add(offset)
    }

    // never clip into the ground
    const floor = surfaceHeight(desired.x, desired.z) + 3
    if (desired.y < floor) desired.y = floor

    const posLerp = 1 - Math.exp(-(playing ? 5.5 : 2) * dt)
    cam.position.lerp(desired, posLerp)

    look.copy(flight.position).addScaledVector(flight.forward, playing ? 12 : 2)
    look.y += 2
    smoothLook.lerp(look, 1 - Math.exp(-8 * dt))
    cam.lookAt(smoothLook)

    // subtle roll with bank + speed shake while boosting
    shake.current = THREE.MathUtils.damp(shake.current, flight.boosting ? 1 : 0, 6, dt)
    cam.rotateZ(flight.bank * 0.12)
    if (shake.current > 0.01) {
      cam.position.x += (Math.random() - 0.5) * 0.12 * shake.current
      cam.position.y += (Math.random() - 0.5) * 0.12 * shake.current
    }

    const targetFov = 60 + speedK * 22 + shake.current * 6
    cam.fov = THREE.MathUtils.damp(cam.fov, targetFov, 3, dt)
    cam.updateProjectionMatrix()
  })

  return null
}
