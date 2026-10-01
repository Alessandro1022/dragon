import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import skyHdr from '@pmndrs/assets/hdri/sky.exr'
import { DragonModel, STANDING_HEIGHT, type DragonAnim } from '../game/dragon/DragonModel'
import { lookFor } from '../game/dragon/look'
import { starterDragon, createDragon } from '../systems/dragons'
import { randomGenome } from '../systems/genetics'

/** Dev-only: /?lab — fast turntable for tuning the dragon rig. */
export function DragonLab() {
  const params = new URLSearchParams(location.search)
  const mode = (params.get('mode') ?? 'parked') as DragonAnim['mode']
  const view = params.get('view') ?? 'side'
  const seed = params.get('seed')
  const look = useMemo(() => {
    if (!seed) return lookFor(starterDragon())
    let s = Number(seed)
    const rng = () => {
      s = (s * 16807) % 2147483647
      return s / 2147483647
    }
    return lookFor(createDragon(randomGenome(rng, 0.8)))
  }, [seed])
  const anim = useRef<DragonAnim>({ mode, flapping: params.get('flap') === '1', boosting: params.get('boost') === '1', pitch: Number(params.get('pitch') ?? 0), bank: 0, look: 0 }).current
  const cams: Record<string, [number, number, number]> = {
    side: [16, 3, -2],
    front: [6, 3, -18],
    back: [0, 6, 22],
    top: [0, 22, 2],
    three: [13, 7, -13],
  }
  return (
    <Canvas shadows camera={{ position: cams[view] ?? cams.side, fov: 45 }} gl={{ toneMapping: THREE.ACESFilmicToneMapping }}>
      <color attach="background" args={['#8fb3d9']} />
      <Environment files={skyHdr} environmentIntensity={0.5} />
      <directionalLight position={[20, 30, 10]} intensity={2.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, mode === 'parked' ? -STANDING_HEIGHT : -4, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#5d6b45" />
      </mesh>
      <Spin anim={anim}>
        <DragonModel look={look} anim={anim} />
      </Spin>
      <OrbitControls target={[0, 1, -1]} />
    </Canvas>
  )
}

function Spin({ children, anim }: { children: React.ReactNode; anim: DragonAnim }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.rotation.set(anim.pitch, 0, anim.bank, 'YXZ')
  })
  return <group ref={g}>{children}</group>
}
