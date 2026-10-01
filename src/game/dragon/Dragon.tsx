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

const toPlayer = new THREE.Vector3()

/** The ridden dragon: flies with the rider on its back, or stands parked. */
export function Dragon() {
  const group = useRef<THREE.Group>(null)
  const flame = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const riderGroup = useRef<THREE.Group>(null)
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
    anim.boosting = flight.boosting
    anim.pitch = flight.pitch
    anim.bank = flight.bank

    if (group.current) {
      group.current.position.copy(flight.position)
      group.current.rotation.set(flight.pitch, flight.yaw, flight.bank, 'YXZ')
    }
    if (riderGroup.current) riderGroup.current.visible = !parked

    const on = flight.boosting
    const flicker = 0.85 + Math.sin(clock.elapsedTime * 40) * 0.1 + Math.random() * 0.1
    if (flame.current) {
      const sc = on ? flicker : 0.0001
      flame.current.scale.setScalar(THREE.MathUtils.lerp(flame.current.scale.x, sc, 0.35))
    }
    if (light.current) light.current.intensity = on ? 60 * flicker : 0
  })

  if (!look) return null
  const [fireOuter, fireInner] = look.palette.fire

  return (
    <group ref={group}>
      <DragonModel look={look} anim={anim} />
      {/* rider in the saddle */}
      <group ref={riderGroup} position={[0, 0.3, -1.35]}>
        <RiderModel anim={riderAnim} />
      </group>
      {/* breath from the mouth */}
      <group ref={flame} position={[0, 1.6, -7.6]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.6]}>
          <coneGeometry args={[0.55, 3.2, 8, 1, true]} />
          <meshBasicMaterial color={fireOuter} transparent opacity={0.85} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.1]}>
          <coneGeometry args={[0.3, 2.1, 8, 1, true]} />
          <meshBasicMaterial color={fireInner} toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, 1.6, -9]} color={fireOuter} distance={40} decay={1.6} />
    </group>
  )
}
