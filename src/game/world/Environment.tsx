import { Sky, Environment as DreiEnvironment } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import skyHdr from '@pmndrs/assets/hdri/sky.exr'
import { worldTime, sunDirection, daylight } from './time'
import { focusPosition } from '../focus'
import { useGame } from '../../store/gameStore'

const FOG_DAY = new THREE.Color('#b9cde0')
const FOG_DUSK = new THREE.Color('#d9a07c')
const FOG_NIGHT = new THREE.Color('#0f1626')
const SUN_DAY = new THREE.Color('#fff4e0')
const SUN_DUSK = new THREE.Color('#ff9e5c')
const HEMI_SKY_DAY = new THREE.Color('#cfe0ff')
const HEMI_SKY_NIGHT = new THREE.Color('#2c3a64')
const fogColor = new THREE.Color()
const sunPos = new THREE.Vector3()
const center = new THREE.Vector3()
const lightSpace = new THREE.Matrix4()
const lightSpaceInv = new THREE.Matrix4()

export const debugLight = { env: 1 }
const ENV_STRENGTH_DEFAULT = 1
let ENV_STRENGTH = ENV_STRENGTH_DEFAULT
const SHADOW_MAP = { low: 0, medium: 1024, high: 2048 } as const

/**
 * Sky, sun/moon, stars, fog and image-based lighting driven by the
 * day–night cycle. The sun casts shadows in a box that follows the
 * player and is snapped to shadow-map texels so edges don't shimmer.
 */
export function Environment() {
  const { scene, gl } = useThree()
  const quality = useGame((s) => s.settings.quality)
  const mode = useGame((s) => s.mode)
  const sky = useRef<THREE.Mesh>(null)
  const sunLight = useRef<THREE.DirectionalLight>(null)
  const moonLight = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const stars = useRef<THREE.Points>(null)
  const moon = useRef<THREE.Mesh>(null)

  const shadowSize = SHADOW_MAP[quality]
  const extent = mode === 'walking' ? 70 : 170

  useEffect(() => {
    gl.shadowMap.enabled = shadowSize > 0
    gl.shadowMap.type = THREE.PCFShadowMap
    const l = sunLight.current
    if (!l) return
    l.castShadow = shadowSize > 0
    if (shadowSize > 0) {
      l.shadow.mapSize.set(shadowSize, shadowSize)
      l.shadow.map?.dispose()
      l.shadow.map = null as unknown as THREE.WebGLRenderTarget
      const cam = l.shadow.camera
      cam.left = -extent
      cam.right = extent
      cam.top = extent
      cam.bottom = -extent
      cam.near = 1
      cam.far = 2400
      cam.updateProjectionMatrix()
      l.shadow.bias = -0.0004
      l.shadow.normalBias = mode === 'walking' ? 0.04 : 0.25
    }
    // materials compiled without shadows need a recompile
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (!m) return
      ;(Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true))
    })
  }, [shadowSize, extent, mode, gl, scene])

  const starGeometry = useMemo(() => {
    const n = 2400
    const pos = new Float32Array(n * 3)
    const size = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const u = Math.random()
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      pos.set([Math.cos(a) * r * 6000, u * 6000 + 150, Math.sin(a) * r * 6000], i * 3)
      size[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  useFrame((_, dt) => {
    ENV_STRENGTH = debugLight.env
    worldTime.t = (worldTime.t + Math.min(dt, 0.1) / worldTime.dayLength) % 1
    const dir = sunDirection()
    const day = daylight()
    const dusk = Math.max(0, 1 - Math.abs(dir.y) * 4) * (dir.y > -0.25 ? 1 : 0)
    const focus = focusPosition()

    sunPos.copy(dir).multiplyScalar(1000)
    const mat = sky.current?.material as THREE.ShaderMaterial | undefined
    if (mat?.uniforms?.sunPosition) mat.uniforms.sunPosition.value.copy(sunPos)
    if (sky.current) sky.current.visible = day > 0.02

    const l = sunLight.current
    if (l) {
      // the moon takes over shadow duty at night
      const lightDir = dir.y > -0.05 ? dir : moonDirection(dir)
      center.copy(focus)
      if (l.castShadow) {
        // snap the shadow box to whole texels in light space
        lightSpace.lookAt(new THREE.Vector3(), lightDir.clone().negate(), new THREE.Vector3(0, 1, 0))
        lightSpaceInv.copy(lightSpace).invert()
        center.applyMatrix4(lightSpaceInv)
        const texel = (extent * 2) / l.shadow.mapSize.x
        center.x = Math.round(center.x / texel) * texel
        center.y = Math.round(center.y / texel) * texel
        center.applyMatrix4(lightSpace)
      }
      l.position.copy(center).addScaledVector(lightDir, 1000)
      l.target.position.copy(center)
      l.target.updateMatrixWorld()
      l.intensity = dir.y > -0.05 ? 2.7 * day : 0.35
      l.color.copy(dir.y > -0.05 ? SUN_DAY : new THREE.Color('#9fb4ff'))
      if (dir.y > -0.05) l.color.lerp(SUN_DUSK, dusk)
    }
    if (moonLight.current) moonLight.current.intensity = 0
    if (hemi.current) {
      hemi.current.intensity = 0.12 + 0.35 * day
      hemi.current.color.copy(HEMI_SKY_NIGHT).lerp(HEMI_SKY_DAY, day)
    }
    scene.environmentIntensity = (0.05 + 0.3 * day) * ENV_STRENGTH

    fogColor.copy(FOG_NIGHT).lerp(FOG_DAY, day).lerp(FOG_DUSK, dusk * 0.6)
    const fog = scene.fog as THREE.FogExp2 | null
    if (fog) {
      fog.color.copy(fogColor)
      // thicker haze while flying high gives depth to the landscape
      fog.density = 0.00042 + (1 - day) * 0.0002
    }
    scene.background = day > 0.02 ? null : fogColor

    if (stars.current) {
      ;(stars.current.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - day * 1.4)
      stars.current.visible = day < 0.7
      stars.current.position.set(focus.x, 0, focus.z)
    }
    if (moon.current) {
      moon.current.position.copy(focus).addScaledVector(moonDirection(dir), 3500)
      moon.current.visible = dir.y < 0.15
    }
  })

  return (
    <>
      <Sky ref={sky as never} distance={20000} sunPosition={[0, 1, 0]} turbidity={4.5} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.88} />
      <DreiEnvironment files={skyHdr} environmentIntensity={1} />
      <fogExp2 attach="fog" args={['#b9cde0', 0.00042]} />
      <hemisphereLight ref={hemi} args={['#cfe0ff', '#4b5a2e', 0.4]} />
      <directionalLight ref={sunLight} intensity={3.2} color="#fff4e0" />
      <directionalLight ref={moonLight} intensity={0} color="#9fb4ff" />
      <points ref={stars} geometry={starGeometry} frustumCulled={false}>
        <pointsMaterial color="#ffffff" size={2} sizeAttenuation={false} transparent opacity={0} fog={false} depthWrite={false} />
      </points>
      <mesh ref={moon}>
        <sphereGeometry args={[110, 24, 16]} />
        <meshBasicMaterial color="#f4f1e6" fog={false} toneMapped={false} />
      </mesh>
    </>
  )
}

const moonDir = new THREE.Vector3()
function moonDirection(sun: THREE.Vector3) {
  return moonDir.copy(sun).negate().setY(Math.abs(sun.y) * 0.9 + 0.15).normalize()
}

void worldTime
