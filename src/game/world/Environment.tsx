import { Sky } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { worldTime, sunDirection, daylight } from './time'
import { flight } from '../dragon/flightState'

const FOG_DAY = new THREE.Color('#c8d8e6')
const FOG_DUSK = new THREE.Color('#e3a982')
const FOG_NIGHT = new THREE.Color('#141c30')
const SUN_DAY = new THREE.Color('#fff1d6')
const SUN_DUSK = new THREE.Color('#ffb070')
const HEMI_SKY_DAY = new THREE.Color('#dbe9ff')
const HEMI_SKY_NIGHT = new THREE.Color('#3a4a78')
const fogColor = new THREE.Color()
const sunPos = new THREE.Vector3()

/** Sky, sun/moon, stars, fog and lighting driven by a day–night cycle. */
export function Environment() {
  const { scene } = useThree()
  const sky = useRef<THREE.Mesh>(null)
  const sunLight = useRef<THREE.DirectionalLight>(null)
  const moonLight = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const stars = useRef<THREE.Points>(null)
  const moon = useRef<THREE.Mesh>(null)
  const ambient = useRef<THREE.AmbientLight>(null)

  const starGeometry = useMemo(() => {
    const n = 1800
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      const y = Math.abs(u) // upper hemisphere only
      pos.set([Math.cos(a) * r * 6000, y * 6000 + 200, Math.sin(a) * r * 6000], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  useFrame((_, dt) => {
    worldTime.t = (worldTime.t + Math.min(dt, 0.1) / worldTime.dayLength) % 1
    const dir = sunDirection()
    const day = daylight()
    const dusk = Math.max(0, 1 - Math.abs(dir.y) * 4) * (dir.y > -0.25 ? 1 : 0)

    sunPos.copy(dir).multiplyScalar(1000)
    const mat = sky.current?.material as THREE.ShaderMaterial | undefined
    if (mat?.uniforms?.sunPosition) mat.uniforms.sunPosition.value.copy(sunPos)
    if (sky.current) sky.current.visible = day > 0.02

    // lights follow the player so the shadowless world stays consistent
    if (sunLight.current) {
      sunLight.current.position.copy(flight.position).addScaledVector(dir, 800)
      sunLight.current.target.position.copy(flight.position)
      sunLight.current.target.updateMatrixWorld()
      sunLight.current.intensity = 2.4 * day
      sunLight.current.color.copy(SUN_DAY).lerp(SUN_DUSK, dusk)
    }
    if (moonLight.current) {
      moonLight.current.position.copy(flight.position).addScaledVector(dir, -800)
      moonLight.current.intensity = 0.55 * (1 - day)
    }
    if (hemi.current) {
      hemi.current.intensity = 0.28 + 0.97 * day
      hemi.current.color.copy(HEMI_SKY_NIGHT).lerp(HEMI_SKY_DAY, day)
    }

    if (ambient.current) ambient.current.intensity = 0.1 + 0.2 * day

    fogColor.copy(FOG_NIGHT).lerp(FOG_DAY, day).lerp(FOG_DUSK, dusk * 0.55)
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(fogColor)
    scene.background = day > 0.02 ? null : fogColor

    if (stars.current) {
      const m = stars.current.material as THREE.PointsMaterial
      m.opacity = 1 - day
      stars.current.visible = day < 0.98
      stars.current.position.set(flight.position.x, 0, flight.position.z)
    }
    if (moon.current) {
      moon.current.position.copy(flight.position).addScaledVector(dir, -3500)
      moon.current.visible = dir.y < 0.15
    }
  })

  return (
    <>
      <Sky ref={sky as never} distance={20000} sunPosition={[0, 1, 0]} turbidity={6} rayleigh={1.4} mieCoefficient={0.006} mieDirectionalG={0.85} />
      <fog attach="fog" args={['#c8d8e6', 400, 2600]} />
      <hemisphereLight ref={hemi} args={['#dbe9ff', '#6b7a45', 1.25]} />
      <directionalLight ref={sunLight} intensity={2.4} color="#fff1d6" />
      <directionalLight ref={moonLight} intensity={0} color="#9fb4ff" />
      <ambientLight ref={ambient} intensity={0.3} />
      <points ref={stars} geometry={starGeometry} frustumCulled={false}>
        <pointsMaterial color="#ffffff" size={2.2} sizeAttenuation={false} transparent opacity={0} fog={false} depthWrite={false} />
      </points>
      <mesh ref={moon}>
        <sphereGeometry args={[90, 16, 12]} />
        <meshBasicMaterial color="#f4f1e6" fog={false} toneMapped={false} />
      </mesh>
    </>
  )
}
