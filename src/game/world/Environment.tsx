import { Sky } from '@react-three/drei'

export const SUN_DIRECTION: [number, number, number] = [-0.5, 0.55, 0.35]
const FOG_COLOR = '#c8d8e6'

/** Sky dome, sunlight and atmospheric fog. */
export function Environment() {
  const sun = SUN_DIRECTION.map((v) => v * 1000) as [number, number, number]
  return (
    <>
      <Sky
        distance={20000}
        sunPosition={sun}
        turbidity={6}
        rayleigh={1.4}
        mieCoefficient={0.006}
        mieDirectionalG={0.85}
      />
      <fog attach="fog" args={[FOG_COLOR, 400, 2600]} />
      <hemisphereLight args={['#dbe9ff', '#6b7a45', 1.25]} />
      <directionalLight position={sun} intensity={2.4} color="#fff1d6" />
      <ambientLight intensity={0.3} />
    </>
  )
}
