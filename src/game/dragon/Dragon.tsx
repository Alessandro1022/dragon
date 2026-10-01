import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { DragonModel, STANDING_HEIGHT, type DragonAnim } from './DragonModel'
import { useFlight } from './useFlight'
import { flight } from './flightState'
import { useDragonLook } from './look'
import { useGame, selectActive } from '../../store/gameStore'
import { RiderModel, type RiderAnim } from '../player/RiderModel'
import { player } from '../player/playerState'
import { terrainHeight } from '../world/terrainHeight'
import { breathe } from '../combat'
import { emit } from '../effects/particles'
import { view } from '../../systems/dragons'
import { raiseHeat, heat } from '../heat'
import { TOWN } from '../world/worldSpots'

const toPlayer = new THREE.Vector3()
const mouth = new THREE.Vector3()
const MOUTH_OFFSET = new THREE.Vector3(0, 1.6, -7.6)
const fireVel = new THREE.Vector3()
const fireTint = new THREE.Color()

/** The ridden dragon: flies with the rider on its back, or stands parked. */
export function Dragon() {
  const group = useRef<THREE.Group>(null)
  const flame = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const riderGroup = useRef<THREE.Group>(null)
  const mouthRef = useRef<THREE.Object3D | null>(null)
  const active = useGame(selectActive)
  const look = useDragonLook(active)
  const anim = useRef<DragonAnim>({ mode: 'fly', flapping: false, boosting: false, pitch: 0, bank: 0, look: 0 }).current
  const riderAnim = useRef<RiderAnim>({ speed: 0, grounded: true, seated: true }).current
  useFlight()

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const s = useGame.getState()
    const parked = s.phase === 'playing' && s.mode === 'walking'

    if (parked) {
      // settle onto the ground
      const target = terrainHeight(flight.position.x, flight.position.z) + STANDING_HEIGHT
      flight.position.y = THREE.MathUtils.damp(flight.position.y, target, 2.5, dt)
      flight.pitch = THREE.MathUtils.damp(flight.pitch, 0, 4, dt)
      flight.bank = THREE.MathUtils.damp(flight.bank, 0, 4, dt)
      flight.boosting = false
      flight.flapping = false
      anim.mode = flight.position.y - target > 0.8 ? 'hover' : 'parked'

      // watch the rider when they're close
      toPlayer.subVectors(player.position, flight.position)
      const d = toPlayer.length()
      let lookAngle = 0
      if (d < 30) {
        const angle = Math.atan2(-toPlayer.x, -toPlayer.z) - flight.yaw
        lookAngle = THREE.MathUtils.clamp(Math.atan2(Math.sin(angle), Math.cos(angle)), -0.7, 0.7)
      }
      anim.look = THREE.MathUtils.damp(anim.look, lookAngle, 3, dt)
    } else {
      anim.mode = 'fly'
      anim.look = THREE.MathUtils.damp(anim.look, 0, 3, dt)
    }
    anim.flapping = flight.flapping
    anim.boosting = flight.boosting || flight.firing
    anim.pitch = flight.pitch
    anim.bank = flight.bank

    if (group.current) {
      group.current.position.copy(flight.position)
      group.current.rotation.set(flight.pitch, flight.yaw, flight.bank, 'YXZ')
    }
    if (riderGroup.current) riderGroup.current.visible = !parked

    // fire breath: damage whatever is in the cone; arson in town is a crime
    if (flight.firing && group.current) {
      if (mouthRef.current) mouthRef.current.getWorldPosition(mouth)
      else mouth.copy(MOUTH_OFFSET).applyQuaternion(group.current.quaternion).add(flight.position)
      const fp = active ? view(active).stats.firepower : 5
      breathe(mouth, flight.forward, 26 + fp * 5, dt)
      // a stream of flame particles that inherits the dragon's velocity
      fireTint.set(look?.palette.fire[0] ?? '#ff9a2e')
      const n = Math.ceil(dt * 160)
      for (let k = 0; k < n; k++) {
        fireVel.copy(flight.forward).multiplyScalar(55 + Math.random() * 20).add(flight.velocity)
        emit(mouth, fireVel, { spread: 14, life: 0.55, size: 3.2, tint: fireTint })
      }
      const inTown = Math.hypot(flight.position.x - TOWN.x, flight.position.z - TOWN.z) < TOWN.radius * 1.15
      if (inTown && clock.elapsedTime - heat.lastArson > 8) {
        heat.lastArson = clock.elapsedTime
        raiseHeat(1, 'Du sätter eld på Draksten! Drakgardet är efter dig.')
      }
    }

    const on = flight.firing
    const flicker = 0.85 + Math.sin(clock.elapsedTime * 40) * 0.1 + Math.random() * 0.1
    if (flame.current) {
      flame.current.visible = on
      flame.current.scale.setScalar(on ? flicker : 1)
      // keep the flame glued to the (moving) snout
      if (on && mouthRef.current && group.current) {
        mouthRef.current.getWorldPosition(mouth)
        group.current.worldToLocal(flame.current.position.copy(mouth))
      }
    }
    if (light.current) light.current.intensity = on ? 60 * flicker : 0
  })

  if (!look) return null
  const [fireOuter, fireInner] = look.palette.fire

  return (
    <group ref={group}>
      <DragonModel look={look} anim={anim} mouthRef={mouthRef} />
      {/* rider in the saddle */}
      <group ref={riderGroup} position={[0, 0.62, -1.35]}>
        <RiderModel anim={riderAnim} />
      </group>
      {/* breath from the mouth */}
      <group ref={flame} position={[0, 1.6, -7.6]} visible={false}>
        {/* cone tip at the mouth, widening forward */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -9]}>
          <coneGeometry args={[3.2, 18, 10, 1, true]} />
          <meshBasicMaterial color={fireOuter} transparent opacity={0.12} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -5.5]}>
          <coneGeometry args={[1.4, 11, 10, 1, true]} />
          <meshBasicMaterial color={fireInner} transparent opacity={0.22} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, 1.6, -14]} color={fireOuter} distance={60} decay={1.4} />
    </group>
  )
}
