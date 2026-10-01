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
import { Town } from './world/Town'
import { BanditCamp } from './world/BanditCamp'
import { MissionMarker } from './world/MissionMarker'
import { Guards } from './npc/Guards'
import { Villagers } from './npc/Villagers'
import { Dragon } from './dragon/Dragon'
import { Companion } from './dragon/Companion'
import { Player } from './player/Player'
import { CameraRig } from './CameraRig'
import { Systems } from './Systems'
import { FireParticles } from './effects/FireParticles'
import { AutoQuality } from './AutoQuality'
import { AudioDirector } from '../audio/AudioDirector'
import { useGame } from '../store/gameStore'

const DPR = { low: [0.6, 0.85], medium: [0.85, 1.25], high: [1, 1.75] } as const

export function GameCanvas() {
  const quality = useGame((s) => s.settings.quality)
  return (
    <Canvas
      dpr={DPR[quality] as [number, number]}
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
        <Town />
        <BanditCamp />
        <Villagers />
        <Guards />
        <MissionMarker />
        <Rings />
        <NextRingArrow />
        <Dragon />
        <Companion />
        <Player />
        <CameraRig />
        <Systems />
        <FireParticles />
        <AutoQuality />
        <AudioDirector />
        {quality !== 'low' && (
          <EffectComposer multisampling={0}>
            <Bloom intensity={0.7} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
            <Vignette offset={0.25} darkness={0.55} />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  )
}
