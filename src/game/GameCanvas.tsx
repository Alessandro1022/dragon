import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, N8AO, SMAA, ToneMapping, HueSaturation, BrightnessContrast } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Suspense, useEffect } from 'react'
import * as THREE from 'three'
import { Environment } from './world/Environment'
import { Terrain } from './world/Terrain'
import { Grass } from './world/Grass'
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
import { RemotePlayers } from './npc/RemotePlayers'
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
      gl={{ antialias: quality === 'low', powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 60, near: 0.5, far: 9000, position: [0, 160, 940] }}
      shadows
    >
      <ToneMappingSwitch postFx={quality !== 'low'} />
      <Suspense fallback={null}>
        <Environment />
        <Terrain />
        <Grass />
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
        <RemotePlayers />
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
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <N8AO
              aoRadius={3.5}
              distanceFalloff={1.2}
              intensity={quality === 'high' ? 3 : 2.2}
              halfRes={quality !== 'high'}
              quality={quality === 'high' ? 'medium' : 'low'}
              color="#10141f"
            />
            <Bloom intensity={0.55} luminanceThreshold={0.9} luminanceSmoothing={0.25} mipmapBlur />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <HueSaturation saturation={0.05} />
            <BrightnessContrast contrast={0.06} />
            <SMAA />
            <Vignette offset={0.3} darkness={0.5} />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  )
}

/** Tone mapping happens in the post stack when it's on, otherwise on the renderer. */
function ToneMappingSwitch({ postFx }: { postFx: boolean }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__three = { gl, scene, camera }
  }, [gl, scene, camera])
  useEffect(() => {
    gl.toneMapping = postFx ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1
  }, [gl, postFx])
  return null
}
