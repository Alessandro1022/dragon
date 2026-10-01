import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { WILD_EGG_SPOTS } from './worldSpots'
import { useGame } from '../../store/gameStore'
import { flight } from '../dragon/flightState'
import { player } from '../player/playerState'
import { randomGenome, express, eggColors } from '../../systems/genetics'
import { uid } from '../../systems/dragons'

/** Rare eggs on the three highest peaks, each marked by a pillar of light. */
export function WildEggs() {
  const found = useGame((s) => s.foundWildEggs)
  return (
    <group>
      {WILD_EGG_SPOTS.map((p, i) => (found.includes(i) ? null : <WildEgg key={i} index={i} position={p} />))}
    </group>
  )
}

function WildEgg({ index, position }: { index: number; position: [number, number, number] }) {
  const egg = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Mesh>(null)
  const pos = useMemo(() => new THREE.Vector3(position[0], position[1] + 1.2, position[2]), [position])
  // the genome is rolled once per spot and session; quality rises per peak
  const genome = useMemo(() => randomGenome(Math.random, 0.55 + index * 0.15), [index])
  const [shell, speck] = useMemo(() => eggColors(express(genome)), [genome])
  const taken = useRef(false)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (egg.current) {
      egg.current.rotation.y = t * 0.8
      egg.current.position.y = 1.2 + Math.sin(t * 1.5) * 0.2
    }
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 2) * 0.06

    const s = useGame.getState()
    if (taken.current || s.phase !== 'playing') return
    const d = s.mode === 'walking' ? player.position.distanceTo(pos) : flight.position.distanceTo(pos)
    if (d < (s.mode === 'walking' ? 3.5 : 14)) {
      taken.current = true
      s.findWildEgg(index, { id: uid(), genome, progress: 0, foundAt: Date.now(), source: 'vild' })
    }
  })

  return (
    <group position={position}>
      <group ref={egg} position={[0, 1.2, 0]}>
        <mesh scale={[0.85, 1.15, 0.85]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={shell} emissive={speck} emissiveIntensity={0.9} metalness={0.4} roughness={0.25} flatShading />
        </mesh>
      </group>
      <mesh ref={beam} position={[0, 160, 0]}>
        <cylinderGeometry args={[2.2, 3.5, 320, 12, 1, true]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.2} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, 4, 0]} color="#ffd166" intensity={30} distance={40} />
    </group>
  )
}
