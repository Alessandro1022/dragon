import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { flight } from './flightState'

/**
 * Procedural low-poly dragon. Forward is -Z.
 * Built from primitives so the game runs without downloaded assets;
 * later swapped for a rigged GLB with the same API.
 */

export const DRAGON_COLORS = {
  body: '#9b1c1c',
  back: '#5c0e12',
  belly: '#d9a441',
  membrane: '#c2410c',
  horn: '#efe6d2',
  eye: '#ffcc33',
  claw: '#2a2320',
}

function Bone({ from, to, radius, color }: { from: THREE.Vector3; to: THREE.Vector3; radius: number; color: string }) {
  const { position, quaternion, length } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(to, from)
    const len = dir.length()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
    return { position: mid, quaternion: q, length: len }
  }, [from, to])
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius * 0.6, radius, length, 6]} />
      <meshStandardMaterial color={color} flatShading roughness={0.6} />
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

function useMembrane() {
  return useMemo(() => {
    const scallop = (a: THREE.Vector3, b: THREE.Vector3, inward: number) => {
      const m = a.clone().add(b).multiplyScalar(0.5)
      const towardRoot = V(1.6, 0, 0.9).sub(m).multiplyScalar(inward)
      return m.add(towardRoot)
    }
    const rim = [
      W.root,
      W.elbow,
      W.wrist,
      W.f1,
      scallop(W.f1, W.f2, 0.28),
      W.f2,
      scallop(W.f2, W.f3, 0.25),
      W.f3,
      scallop(W.f3, W.back, 0.22),
      W.back,
    ]
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
  }, [])
}

function Wing({ side, wingRef }: { side: 1 | -1; wingRef: React.RefObject<THREE.Group | null> }) {
  const membrane = useMembrane()
  const bone = DRAGON_COLORS.back
  return (
    <group position={[side * 1.0, 0.75, -1.1]}>
      <group ref={wingRef} scale={[side, 1, 1]}>
        <mesh geometry={membrane}>
          <meshStandardMaterial
            color={DRAGON_COLORS.membrane}
            emissive={DRAGON_COLORS.membrane}
            emissiveIntensity={0.18}
            side={THREE.DoubleSide}
            flatShading
            roughness={0.7}
            transparent
            opacity={0.94}
          />
        </mesh>
        <Bone from={W.root} to={W.elbow} radius={0.32} color={bone} />
        <Bone from={W.elbow} to={W.wrist} radius={0.24} color={bone} />
        <Bone from={W.wrist} to={W.f1} radius={0.12} color={bone} />
        <Bone from={W.wrist} to={W.f2} radius={0.11} color={bone} />
        <Bone from={W.wrist} to={W.f3} radius={0.1} color={bone} />
        <mesh position={W.wrist} rotation={[0, 0, -0.6]}>
          <coneGeometry args={[0.14, 0.7, 4]} />
          <meshStandardMaterial color={DRAGON_COLORS.horn} flatShading />
        </mesh>
      </group>
    </group>
  )
}

const TAIL_SEGMENTS = 9

export function DragonModel({ scale = 1 }: { scale?: number }) {
  const leftWing = useRef<THREE.Group>(null)
  const rightWing = useRef<THREE.Group>(null)
  const tail = useRef<(THREE.Group | null)[]>([])
  const neck = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const jaw = useRef<THREE.Mesh>(null)
  const phase = useRef(0)

  const mat = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: DRAGON_COLORS.body, flatShading: true, roughness: 0.55, metalness: 0.1 }),
      back: new THREE.MeshStandardMaterial({ color: DRAGON_COLORS.back, flatShading: true, roughness: 0.5 }),
      belly: new THREE.MeshStandardMaterial({ color: DRAGON_COLORS.belly, flatShading: true, roughness: 0.4, metalness: 0.35 }),
      horn: new THREE.MeshStandardMaterial({ color: DRAGON_COLORS.horn, flatShading: true, roughness: 0.4 }),
      eye: new THREE.MeshStandardMaterial({ color: DRAGON_COLORS.eye, emissive: DRAGON_COLORS.eye, emissiveIntensity: 3 }),
      claw: new THREE.MeshStandardMaterial({ color: DRAGON_COLORS.claw, flatShading: true }),
    }),
    [],
  )

  useFrame((_, dt) => {
    // flap frequency: powerful beats when flapping/boosting, slow glide otherwise
    const active = flight.flapping || flight.boosting
    const climbing = flight.pitch > 0.25
    const freq = active ? 7.5 : climbing ? 4 : 1.4
    const amp = active ? 0.85 : climbing ? 0.5 : 0.12
    phase.current += dt * freq
    const beat = Math.sin(phase.current) * amp
    // tuck wings back in a steep high-speed dive
    const dive = THREE.MathUtils.clamp((-flight.pitch - 0.4) * 1.5, 0, 0.9)
    const sweep = dive * 0.9
    // the left wing is mirrored on X, so its rotations are mirrored too
    const wings: [THREE.Group | null, number][] = [
      [rightWing.current, 1],
      [leftWing.current, -1],
    ]
    for (const [w, side] of wings) {
      if (!w) continue
      w.rotation.z = THREE.MathUtils.damp(w.rotation.z, (beat + 0.08 - dive * 0.3) * side, 12, dt)
      w.rotation.y = THREE.MathUtils.damp(w.rotation.y, -sweep * side, 6, dt)
    }

    // tail follows with a travelling wave and leans into turns
    const t = performance.now() / 1000
    tail.current.forEach((seg, i) => {
      if (!seg) return
      const k = (i + 1) / TAIL_SEGMENTS
      seg.rotation.y = Math.sin(t * 2.2 - i * 0.55) * 0.07 * k + flight.bank * 0.06
      seg.rotation.x = Math.sin(t * 1.6 - i * 0.4) * 0.03 + (active ? Math.cos(phase.current - i * 0.5) * 0.04 : 0)
    })

    // head looks into the turn, jaw opens when boosting
    if (neck.current) neck.current.rotation.y = THREE.MathUtils.damp(neck.current.rotation.y, -flight.bank * 0.25, 4, dt)
    if (head.current) head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, -flight.pitch * 0.35, 4, dt)
    if (jaw.current) jaw.current.rotation.x = THREE.MathUtils.damp(jaw.current.rotation.x, flight.boosting ? 0.45 : 0.05, 10, dt)
  })

  // Nested tail chain: each segment is a child of the previous one
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

  return (
    <group scale={scale}>
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
          {/* snout */}
          <mesh material={mat.body} position={[0, -0.08, -1.05]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, 0.75]}>
            <cylinderGeometry args={[0.28, 0.55, 1.2, 6]} />
          </mesh>
          {/* jaw */}
          <mesh ref={jaw} material={mat.belly} position={[0, -0.38, -0.5]} scale={[0.5, 0.18, 0.95]}>
            <boxGeometry args={[1, 1, 1.4]} />
          </mesh>
          {/* horns */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh material={mat.horn} position={[s * 0.42, 0.42, 0.55]} rotation={[1.15, 0, s * -0.35]}>
                <coneGeometry args={[0.15, 1.4, 5]} />
              </mesh>
              <mesh material={mat.horn} position={[s * 0.62, 0.12, 0.35]} rotation={[1.3, 0, s * -0.9]}>
                <coneGeometry args={[0.09, 0.7, 4]} />
              </mesh>
              <mesh material={mat.eye} position={[s * 0.5, 0.15, -0.45]} scale={[0.6, 0.45, 1]}>
                <sphereGeometry args={[0.15, 8, 6]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* tail */}
      <group position={[0, 0.05, 2.4]}>{tailChain}</group>

      {/* wings */}
      <Wing side={1} wingRef={rightWing} />
      <Wing side={-1} wingRef={leftWing} />

      {/* tucked legs */}
      {[
        [-0.8, -0.95, -1.6],
        [0.8, -0.95, -1.6],
        [-0.85, -0.9, 1.4],
        [0.85, -0.9, 1.4],
      ].map((p, i) => (
        <group key={i} position={p as [number, number, number]} rotation={[0.9, 0, 0]}>
          <mesh material={mat.body} scale={[0.32, 0.65, 0.32]}>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
          <mesh material={mat.claw} position={[0, -0.7, 0]}>
            <coneGeometry args={[0.18, 0.4, 4]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
