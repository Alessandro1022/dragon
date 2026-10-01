import { Clouds as DreiClouds, Cloud } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import cloudTexture from '@pmndrs/assets/textures/cloud.webp'
import { daylight } from './time'
import { useGame } from '../../store/gameStore'

/** deterministic layout */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

const COUNT = { low: 6, medium: 12, high: 18 }

/**
 * Soft volumetric-looking cumulus: each cloud is a cluster of lit,
 * alpha-blended puffs (drei Clouds) that drift slowly and blush at dusk.
 */
export function Clouds() {
  const quality = useGame((s) => s.settings.quality)
  const n = COUNT[quality]
  const group = useRef<THREE.Group>(null)
  const layout = useMemo(() => {
    const r = rng(777)
    return Array.from({ length: 18 }, (_, i) => {
      const a = r() * Math.PI * 2
      const d = 300 + r() * 1700
      return {
        key: i,
        position: [Math.cos(a) * d, 330 + r() * 160, Math.sin(a) * d] as [number, number, number],
        bounds: [70 + r() * 70, 18 + r() * 14, 40 + r() * 40] as [number, number, number],
        segments: 14 + Math.floor(r() * 10),
        volume: 40 + r() * 30,
        seed: Math.floor(r() * 1000),
      }
    })
  }, [])

  const colorRef = useRef(new THREE.Color())
  useFrame((_, dt) => {
    if (group.current) group.current.position.x += dt * 1.6 // drift with the wind
    const day = daylight()
    colorRef.current.setRGB(0.25 + 0.75 * day, 0.27 + 0.73 * day, 0.32 + 0.68 * day)
    group.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined
      if (m && 'emissive' in m) m.emissive.copy(colorRef.current).multiplyScalar(0.25)
    })
  })

  return (
    <group ref={group}>
      <DreiClouds texture={cloudTexture} limit={n * 26} material={THREE.MeshLambertMaterial} frustumCulled={false}>
        {layout.slice(0, n).map((c) => (
          <Cloud
            key={c.key}
            position={c.position}
            bounds={c.bounds}
            segments={c.segments}
            volume={c.volume}
            seed={c.seed}
            smallestVolume={0.4}
            growth={4}
            speed={0.08}
            fade={600}
            opacity={0.9}
            color="#ffffff"
            concentrate="inside"
          />
        ))}
      </DreiClouds>
    </group>
  )
}
