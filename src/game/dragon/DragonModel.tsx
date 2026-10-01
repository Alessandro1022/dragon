import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { DragonPalette } from '../../systems/genetics'

/**
 * Procedural low-poly dragon. Forward is -Z, origin at the body centre.
 * Built from primitives so the game runs without downloaded assets;
 * appearance is driven entirely by the dragon's genes.
 */

export interface DragonAnim {
  mode: 'fly' | 'parked' | 'hover'
  flapping: boolean
  boosting: boolean
  pitch: number
  bank: number
  /** head turn for looking at things (radians) */
  look: number
}

export interface DragonLook {
  palette: DragonPalette
  wingspan: number
  hornLength: number
  twinHorns: boolean
}

/** Height from the body centre to the feet when standing. */
export const STANDING_HEIGHT = 2.5

function Bone({ from, to, radius, material }: { from: THREE.Vector3; to: THREE.Vector3; radius: number; material: THREE.Material }) {
  const { position, quaternion, length } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(to, from)
    const len = dir.length()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
    return { position: mid, quaternion: q, length: len }
  }, [from, to])
  return (
    <mesh position={position} quaternion={quaternion} material={material}>
      <cylinderGeometry args={[radius * 0.6, radius, length, 6]} />
    </mesh>
  )
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

// Wing skeleton in the right wing's local space (+X = outward)
const W = {
  root: V(0, 0, -0.5),
  elbow: V(2.4, 0.35, -1.0),
  wrist: V(4.3, 0.5, -0.4),
  f1: V(7.6, 0.15, 0.3),
  f2: V(6.6, 0, 2.1),
  f3: V(4.6, 0, 3.2),
  back: V(0.3, 0, 2.6),
}

const membraneGeometry = (() => {
  const scallop = (a: THREE.Vector3, b: THREE.Vector3, inward: number) => {
    const m = a.clone().add(b).multiplyScalar(0.5)
    return m.add(V(1.6, 0, 0.9).sub(m).multiplyScalar(inward))
  }
  const rim = [W.root, W.elbow, W.wrist, W.f1, scallop(W.f1, W.f2, 0.28), W.f2, scallop(W.f2, W.f3, 0.25), W.f3, scallop(W.f3, W.back, 0.22), W.back]
  const center = V(2.2, 0.15, 0.9)
  const verts: number[] = []
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i]
    const b = rim[(i + 1) % rim.length]
    verts.push(center.x, center.y, center.z, a.x, a.y, a.z, b.x, b.y, b.z)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  g.computeVertexNormals()
  return g
})()

function Wing({ side, wingRef, mats, span }: { side: 1 | -1; wingRef: React.RefObject<THREE.Group | null>; mats: Mats; span: number }) {
  return (
    <group position={[side * 1.0, 0.75, -1.1]}>
      <group ref={wingRef} scale={[side * span, 1, span]}>
        <mesh geometry={membraneGeometry} material={mats.membrane} />
        <Bone from={W.root} to={W.elbow} radius={0.32} material={mats.back} />
        <Bone from={W.elbow} to={W.wrist} radius={0.24} material={mats.back} />
        <Bone from={W.wrist} to={W.f1} radius={0.12} material={mats.back} />
        <Bone from={W.wrist} to={W.f2} radius={0.11} material={mats.back} />
        <Bone from={W.wrist} to={W.f3} radius={0.1} material={mats.back} />
        <mesh position={W.wrist} rotation={[0, 0, -0.6]} material={mats.horn}>
          <coneGeometry args={[0.14, 0.7, 4]} />
        </mesh>
      </group>
    </group>
  )
}

interface Mats {
  body: THREE.MeshStandardMaterial
  back: THREE.MeshStandardMaterial
  belly: THREE.MeshStandardMaterial
  horn: THREE.MeshStandardMaterial
  eye: THREE.MeshStandardMaterial
  claw: THREE.MeshStandardMaterial
  membrane: THREE.MeshStandardMaterial
}

function useMaterials(p: DragonPalette): Mats {
  const mats = useMemo<Mats>(
    () => ({
      body: new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.55, metalness: 0.1 }),
      back: new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.5 }),
      belly: new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.4, metalness: 0.35 }),
      horn: new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.4 }),
      eye: new THREE.MeshStandardMaterial({ emissiveIntensity: 3 }),
      claw: new THREE.MeshStandardMaterial({ color: '#2a2320', flatShading: true }),
      membrane: new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, flatShading: true, roughness: 0.7, transparent: true, opacity: 0.94, emissiveIntensity: 0.18 }),
    }),
    [],
  )
  useEffect(() => {
    mats.body.color.set(p.body)
    mats.back.color.set(p.back)
    mats.back.emissive.set(p.glow ? p.eye : '#000000')
    mats.back.emissiveIntensity = p.glow ? 0.9 : 0
    mats.belly.color.set(p.belly)
    mats.horn.color.set(p.horn)
    mats.eye.color.set(p.eye)
    mats.eye.emissive.set(p.eye)
    mats.membrane.color.set(p.membrane)
    mats.membrane.emissive.set(p.membrane)
  }, [p, mats])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  return mats
}

const TAIL_SEGMENTS = 9

export function DragonModel({ look, anim }: { look: DragonLook; anim: DragonAnim }) {
  const leftWing = useRef<THREE.Group>(null)
  const rightWing = useRef<THREE.Group>(null)
  const tail = useRef<(THREE.Group | null)[]>([])
  const neck = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const jaw = useRef<THREE.Mesh>(null)
  const legs = useRef<(THREE.Group | null)[]>([])
  const phase = useRef(Math.random() * 10)
  const mat = useMaterials(look.palette)

  useFrame((_, dt) => {
    const parked = anim.mode === 'parked'
    const hover = anim.mode === 'hover'
    const active = anim.flapping || anim.boosting
    const climbing = anim.pitch > 0.25
    const freq = parked ? 0.6 : hover ? 9 : active ? 7.5 : climbing ? 4 : 1.4
    const amp = parked ? 0 : hover ? 0.75 : active ? 0.85 : climbing ? 0.5 : 0.12
    phase.current += dt * freq
    const beat = Math.sin(phase.current) * amp

    // wings: folded when parked, tucked in a steep dive
    const dive = THREE.MathUtils.clamp((-anim.pitch - 0.4) * 1.5, 0, 0.9)
    const sweep = parked ? 1.25 : dive * 0.9
    const lift = parked ? -0.55 + Math.sin(phase.current) * 0.03 : beat + 0.08 - dive * 0.3
    const wings: [THREE.Group | null, number][] = [
      [rightWing.current, 1],
      [leftWing.current, -1],
    ]
    for (const [w, side] of wings) {
      if (!w) continue
      w.rotation.z = THREE.MathUtils.damp(w.rotation.z, lift * side, parked ? 5 : 12, dt)
      w.rotation.y = THREE.MathUtils.damp(w.rotation.y, -sweep * side, 5, dt)
    }

    // tail: travelling wave, leans into turns, rests lower when parked
    const t = performance.now() / 1000
    tail.current.forEach((seg, i) => {
      if (!seg) return
      const k = (i + 1) / TAIL_SEGMENTS
      seg.rotation.y = Math.sin(t * (parked ? 1.1 : 2.2) - i * 0.55) * (parked ? 0.12 : 0.07) * k + anim.bank * 0.06
      const droop = parked ? (i < 3 ? 0.12 : -0.04) : 0
      seg.rotation.x = droop + Math.sin(t * 1.6 - i * 0.4) * 0.03 + (active ? Math.cos(phase.current - i * 0.5) * 0.04 : 0)
    })

    // legs: tucked in flight, standing when parked
    legs.current.forEach((leg) => {
      if (leg) leg.rotation.x = THREE.MathUtils.damp(leg.rotation.x, parked ? 0 : 0.9, 5, dt)
    })

    // neck/head: look into turns or at a target; breathe when parked
    if (neck.current) {
      neck.current.rotation.y = THREE.MathUtils.damp(neck.current.rotation.y, -anim.bank * 0.25 + anim.look, 3, dt)
      neck.current.rotation.x = THREE.MathUtils.damp(neck.current.rotation.x, parked ? -0.15 + Math.sin(t * 0.8) * 0.04 : 0, 3, dt)
    }
    if (head.current) head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, parked ? 0.25 : -anim.pitch * 0.35, 4, dt)
    if (jaw.current) jaw.current.rotation.x = THREE.MathUtils.damp(jaw.current.rotation.x, anim.boosting ? 0.45 : 0.05, 10, dt)

    if (look.palette.glow) mat.back.emissiveIntensity = 0.6 + Math.sin(t * 2) * 0.35
  })

  const tailChain = useMemo(() => {
    const build = (i: number): React.ReactNode => {
      if (i >= TAIL_SEGMENTS) {
        return (
          <mesh material={mat.back} position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.25]}>
            <coneGeometry args={[0.7, 1.6, 4]} />
          </mesh>
        )
      }
      const r = 0.75 * (1 - i / (TAIL_SEGMENTS + 1)) + 0.08
      return (
        <group
          ref={(el) => {
            tail.current[i] = el
          }}
          position={[0, i === 0 ? 0 : -0.05, i === 0 ? 0 : 0.95]}
        >
          <mesh material={mat.body} position={[0, 0, 0.5]} scale={[r, r * 0.85, 0.75]}>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
          <mesh material={mat.back} position={[0, r * 0.75, 0.45]} rotation={[-0.5, 0, 0]}>
            <coneGeometry args={[r * 0.35, r * 0.9, 4]} />
          </mesh>
          {build(i + 1)}
        </group>
      )
    }
    return build(0)
  }, [mat])

  const horn = look.hornLength

  return (
    <group>
      {/* torso */}
      <mesh material={mat.body} scale={[1.35, 1.15, 2.9]}>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
      <mesh material={mat.belly} position={[0, -0.42, -0.2]} scale={[1.05, 0.8, 2.5]}>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
      <mesh material={mat.body} position={[0, 0.25, -1.9]} scale={[1.25, 1.1, 1.3]}>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>

      {/* spine ridge */}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} material={mat.back} position={[0, 1.05 - Math.abs(i - 3) * 0.06, -2.2 + i * 0.8]} rotation={[-0.45, 0, 0]}>
          <coneGeometry args={[0.22, 0.75 - Math.abs(i - 3) * 0.06, 4]} />
        </mesh>
      ))}

      {/* saddle */}
      <mesh position={[0, 1.08, -1.25]} scale={[0.75, 0.16, 0.9]}>
        <boxGeometry />
        <meshStandardMaterial color="#4a3020" flatShading roughness={0.7} />
      </mesh>

      {/* neck + head */}
      <group ref={neck} position={[0, 0.5, -2.8]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} material={mat.body} position={[0, i * 0.38, -i * 0.72]} scale={[0.72 - i * 0.07, 0.68 - i * 0.06, 0.62]}>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={`r${i}`} material={mat.back} position={[0, 0.62 + i * 0.36, -i * 0.72]} rotation={[-0.5, 0, 0]}>
            <coneGeometry args={[0.14, 0.45, 4]} />
          </mesh>
        ))}
        <group ref={head} position={[0, 1.45, -3.2]}>
          <mesh material={mat.body} scale={[0.78, 0.62, 1.05]}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
          <mesh material={mat.body} position={[0, -0.08, -1.05]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, 0.75]}>
            <cylinderGeometry args={[0.28, 0.55, 1.2, 6]} />
          </mesh>
          <mesh ref={jaw} material={mat.belly} position={[0, -0.38, -0.5]} scale={[0.5, 0.18, 0.95]}>
            <boxGeometry args={[1, 1, 1.4]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh material={mat.horn} position={[s * 0.42, 0.42, 0.55]} rotation={[1.15, 0, s * -0.35]} scale={[1, horn, 1]}>
                <coneGeometry args={[0.15, 1.4, 5]} />
              </mesh>
              <mesh material={mat.horn} position={[s * 0.62, 0.12, 0.35]} rotation={[1.3, 0, s * -0.9]} scale={[1, horn, 1]}>
                <coneGeometry args={[0.09, 0.7, 4]} />
              </mesh>
              {look.twinHorns && (
                <mesh material={mat.horn} position={[s * 0.25, 0.5, -0.1]} rotation={[0.7, 0, s * -0.2]} scale={[1, horn, 1]}>
                  <coneGeometry args={[0.1, 0.9, 5]} />
                </mesh>
              )}
              <mesh material={mat.eye} position={[s * 0.5, 0.15, -0.45]} scale={[0.6, 0.45, 1]}>
                <sphereGeometry args={[0.15, 8, 6]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      <group position={[0, 0.05, 2.4]}>{tailChain}</group>

      <Wing side={1} wingRef={rightWing} mats={mat} span={look.wingspan} />
      <Wing side={-1} wingRef={leftWing} mats={mat} span={look.wingspan} />

      {/* legs: pivot at the hip, swing forward to tuck */}
      {[
        [-0.85, -0.6, -1.6],
        [0.85, -0.6, -1.6],
        [-0.9, -0.55, 1.4],
        [0.9, -0.55, 1.4],
      ].map((p, i) => (
        <group
          key={i}
          ref={(el) => {
            legs.current[i] = el
          }}
          position={p as [number, number, number]}
          rotation={[0.9, 0, 0]}
        >
          <mesh material={mat.body} position={[0, -0.6, 0]} scale={[0.36, 0.75, 0.38]}>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
          <mesh material={mat.body} position={[0, -1.35, 0.05]} scale={[0.22, 0.5, 0.24]}>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
          <mesh material={mat.claw} position={[0, -1.72, -0.15]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.2, 0.45, 4]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
