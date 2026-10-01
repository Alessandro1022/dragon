import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

export interface RiderAnim {
  /** horizontal speed in units/s */
  speed: number
  grounded: boolean
  seated: boolean
}

const COLORS = {
  tunic: '#2b3140',
  leather: '#6b4a2b',
  cape: '#8f1d22',
  skin: '#c68e5f',
  trim: '#f5b041',
  boots: '#2a1f17',
}

/** Dragon Guard uniform */
export const GUARD_COLORS: typeof COLORS = {
  tunic: '#cbd5e1',
  leather: '#334155',
  cape: '#1e3a8a',
  skin: '#c68e5f',
  trim: '#e5e7eb',
  boots: '#1f2937',
}

/** Low-poly dragon rider (~1.8 units tall, origin at the feet, facing -Z). */
export function RiderModel({ anim, colors = COLORS }: { anim: RiderAnim; colors?: typeof COLORS }) {
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const cape = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const phase = useRef(0)

  const m = useMemo(
    () => ({
      tunic: new THREE.MeshStandardMaterial({ color: colors.tunic, roughness: 0.85 }),
      leather: new THREE.MeshStandardMaterial({ color: colors.leather, roughness: 0.6, metalness: 0.05 }),
      cape: new THREE.MeshStandardMaterial({ color: colors.cape, side: THREE.DoubleSide, roughness: 0.92 }),
      skin: new THREE.MeshStandardMaterial({ color: colors.skin, roughness: 0.6 }),
      trim: new THREE.MeshStandardMaterial({ color: colors.trim, metalness: 0.85, roughness: 0.28 }),
      boots: new THREE.MeshStandardMaterial({ color: colors.boots, roughness: 0.55 }),
      steel: new THREE.MeshStandardMaterial({ color: '#9aa3ad', metalness: 0.9, roughness: 0.32 }),
      hair: new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.8 }),
    }),
    [colors],
  )
  const geo = useMemo(() => riderGeometry(), [])

  useFrame((_, dt) => {
    const moving = anim.speed > 0.5 && anim.grounded && !anim.seated
    const running = anim.speed > 8
    phase.current += dt * (moving ? (running ? 11 : 7.5) : 1.5)
    const swing = moving ? Math.sin(phase.current) * (running ? 0.85 : 0.55) : 0
    const air = !anim.grounded && !anim.seated

    const legTarget = anim.seated ? -1.35 : air ? -0.5 : 0
    if (legL.current) legL.current.rotation.x = THREE.MathUtils.damp(legL.current.rotation.x, legTarget + swing, 14, dt)
    if (legR.current) legR.current.rotation.x = THREE.MathUtils.damp(legR.current.rotation.x, legTarget - swing + (air ? 0.6 : 0), 14, dt)
    // legs spread around the dragon's neck when seated
    if (legL.current) legL.current.rotation.z = THREE.MathUtils.damp(legL.current.rotation.z, anim.seated ? -0.45 : 0, 10, dt)
    if (legR.current) legR.current.rotation.z = THREE.MathUtils.damp(legR.current.rotation.z, anim.seated ? 0.45 : 0, 10, dt)

    const armTarget = anim.seated ? -0.9 : air ? -2.4 : 0
    if (armL.current) armL.current.rotation.x = THREE.MathUtils.damp(armL.current.rotation.x, armTarget - swing * 0.8, 12, dt)
    if (armR.current) armR.current.rotation.x = THREE.MathUtils.damp(armR.current.rotation.x, armTarget + swing * 0.8, 12, dt)

    if (body.current) {
      const bob = moving ? Math.abs(Math.sin(phase.current)) * (running ? 0.12 : 0.06) : Math.sin(phase.current) * 0.01
      body.current.position.y = bob
      body.current.rotation.x = THREE.MathUtils.damp(body.current.rotation.x, running ? -0.18 : anim.seated ? -0.25 : 0, 8, dt)
    }
    if (cape.current) {
      const flow = anim.seated ? 1.1 : Math.min(1, anim.speed / 12) * 0.9 + (air ? 0.4 : 0)
      cape.current.rotation.x = THREE.MathUtils.damp(cape.current.rotation.x, 0.08 + flow + Math.sin(phase.current * 1.7) * 0.06, 6, dt)
    }
  })

  return (
    <group>
      <group ref={body}>
        {/* legs (pivot at hip) */}
        {[
          [-0.12, legL],
          [0.12, legR],
        ].map(([x, ref], i) => (
          <group key={i} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 0.95, 0]}>
            <mesh geometry={geo.thigh} material={m.leather} position={[0, -0.24, 0]} castShadow />
            <mesh geometry={geo.shin} material={m.boots} position={[0, -0.66, 0]} castShadow />
            <mesh geometry={geo.foot} material={m.boots} position={[0, -0.9, -0.06]} castShadow />
            <mesh geometry={geo.kneeCap} material={m.steel} position={[0, -0.46, -0.08]} />
          </group>
        ))}

        {/* torso: tunic, leather cuirass, belt */}
        <mesh geometry={geo.torso} material={m.tunic} position={[0, 1.2, 0]} castShadow />
        <mesh geometry={geo.cuirass} material={m.leather} position={[0, 1.32, 0]} castShadow />
        <mesh geometry={geo.belt} material={m.leather} position={[0, 0.98, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geo.buckle} material={m.trim} position={[0, 0.98, -0.16]} />
        {/* pauldrons */}
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geo.pauldron} material={m.steel} position={[s * 0.25, 1.56, 0]} rotation={[0, 0, s * -0.35]} castShadow />
        ))}

        {/* arms (pivot at shoulder) */}
        {[
          [-0.29, armL],
          [0.29, armR],
        ].map(([x, ref], i) => (
          <group key={i} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 1.5, 0]}>
            <mesh geometry={geo.upperArm} material={m.tunic} position={[0, -0.18, 0]} castShadow />
            <mesh geometry={geo.forearm} material={m.leather} position={[0, -0.44, 0]} castShadow />
            <mesh geometry={geo.hand} material={m.leather} position={[0, -0.6, 0]} />
          </group>
        ))}

        {/* neck, head, hair, hood */}
        <mesh geometry={geo.neck} material={m.skin} position={[0, 1.66, 0]} />
        <mesh geometry={geo.head} material={m.skin} position={[0, 1.8, -0.01]} castShadow />
        <mesh geometry={geo.hair} material={m.hair} position={[0, 1.86, 0.03]} />
        <mesh geometry={geo.hood} material={m.cape} position={[0, 1.79, 0.07]} castShadow />

        {/* cape (pivot at shoulders) */}
        <group ref={cape} position={[0, 1.58, 0.15]}>
          <mesh geometry={geo.cape} material={m.cape} position={[0, -0.6, 0]} castShadow />
        </group>
      </group>
    </group>
  )
}

/** Smooth rider parts (built once, shared by every rider). */
let cachedGeo: ReturnType<typeof buildRiderGeometry> | null = null
function riderGeometry() {
  return (cachedGeo ??= buildRiderGeometry())
}

function buildRiderGeometry() {
  const cap = (r: number, l: number, sx = 1, sz = 1) => {
    const g = new THREE.CapsuleGeometry(r, l, 6, 14)
    g.scale(sx, 1, sz)
    return g
  }
  const torso = new THREE.CylinderGeometry(0.22, 0.18, 0.62, 18)
  torso.scale(1, 1, 0.7)
  const cuirass = new THREE.CylinderGeometry(0.245, 0.2, 0.42, 18)
  cuirass.scale(1, 1, 0.74)
  const belt = new THREE.TorusGeometry(0.2, 0.035, 8, 24)
  belt.scale(1, 0.72, 1)
  const pauldron = new THREE.SphereGeometry(0.12, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)
  pauldron.scale(1.2, 0.9, 1.1)
  const head = new THREE.SphereGeometry(0.115, 20, 16)
  head.scale(0.92, 1.08, 1)
  const hair = new THREE.SphereGeometry(0.12, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)
  const hood = new THREE.SphereGeometry(0.15, 18, 12, Math.PI * 0.15, Math.PI * 1.7, 0, Math.PI * 0.7)
  hood.rotateY(Math.PI)
  hood.scale(1, 1.05, 1.05)
  const cape = new THREE.PlaneGeometry(0.5, 1.1, 4, 8)
  // gentle drape: curve the cape around the back
  const p = cape.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    p.setZ(i, x * x * 0.6 + (0.55 - y) * 0.04)
    p.setX(i, x * (1 + (0.55 - y) * 0.35))
  }
  cape.computeVertexNormals()
  const foot = new THREE.SphereGeometry(0.075, 12, 8)
  foot.scale(1.1, 0.7, 2)
  return {
    thigh: cap(0.075, 0.32, 1, 1.1),
    shin: cap(0.068, 0.3),
    foot,
    kneeCap: new THREE.SphereGeometry(0.05, 10, 8),
    torso,
    cuirass,
    belt,
    buckle: new THREE.BoxGeometry(0.06, 0.05, 0.02),
    pauldron,
    upperArm: cap(0.058, 0.24),
    forearm: cap(0.052, 0.22),
    hand: new THREE.SphereGeometry(0.05, 10, 8),
    neck: new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10),
    head,
    hair,
    hood,
    cape,
  }
}
