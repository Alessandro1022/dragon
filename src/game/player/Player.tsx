import { useRef } from 'react'
import * as THREE from 'three'
import { RiderModel, type RiderAnim } from './RiderModel'
import { usePlayer } from './usePlayer'
import { useGame } from '../../store/gameStore'

/** The rider on foot. Hidden while flying — then the rider sits on the dragon. */
export function Player() {
  const group = useRef<THREE.Group>(null)
  const anim = useRef<RiderAnim>({ speed: 0, grounded: true, seated: false }).current
  const mode = useGame((s) => s.mode)
  usePlayer(group, anim)
  return (
    <group ref={group} visible={mode === 'walking'}>
      <RiderModel anim={anim} />
    </group>
  )
}
