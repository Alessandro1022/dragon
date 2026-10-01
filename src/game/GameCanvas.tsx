import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { Suspense } from 'react'
import * as THREE from 'three'
import { Environment } from './world/Environment'
import { Terrain } from './world/Terrain'
import { Forest } from './world/Forest'
import { Water } from './world/Water'
import { Clouds } from './world/Clouds'
import { Rings, NextRingArrow } from './world/Rings'
import { Nest } from './world/Nest'
import { Pickups } from './world/Pickups'
import { WildEggs } from './world/WildEggs'
import { Dragon } from './dragon/Dragon'
import { Companion } from './dragon/Companion'
import { Player } from './player/Player'
import { CameraRig } from './CameraRig'
import { Systems } from './Systems'

export function GameCanvas() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 60, near: 0.3, far: 9000, position: [0, 160, 940] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <Suspense fallback={null}>
        <Environment />
        <Terrain />
        <Forest />
        <Water />
        <Clouds />
        <Nest />
        <Pickups />
        <WildEggs />
        <Rings />
        <NextRingArrow />
        <Dragon />
        <Companion />
        <Player />
        <CameraRig />
        <Systems />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.7} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
          <Vignette offset={0.25} darkness={0.55} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
