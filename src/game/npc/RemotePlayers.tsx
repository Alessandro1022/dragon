import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { remoteRiders, type RemoteRider } from '../../lib/realtime'
import { DragonModel, STANDING_HEIGHT, type DragonAnim, type DragonLook } from '../dragon/DragonModel'
import { RiderModel, type RiderAnim } from '../player/RiderModel'
import { emit } from '../effects/particles'
import { online } from '../../lib/supabase'

const FALLBACK_LOOK: DragonLook = {
  palette: {
    body: '#3f6b5a',
    back: '#25443a',
    belly: '#d9b56a',
    membrane: '#2f7a62',
    horn: '#efe6d2',
    eye: '#4ade80',
    fire: ['#4ade80', '#f0fdf4'],
    glow: false,
  },
  wingspan: 1,
  hornLength: 1,
  twinHorns: false,
}

/** Other riders in the shared sky, smoothed between network updates. */
export function RemotePlayers() {
  const [ids, setIds] = useState<string[]>([])
  useEffect(() => {
    if (!online) return
    const id = setInterval(() => {
      const now = performance.now()
      for (const [k, r] of remoteRiders) if (now - r.lastSeen > 8000) remoteRiders.delete(k)
      const next = [...remoteRiders.keys()]
      setIds((cur) => (cur.length === next.length && cur.every((v, i) => v === next[i]) ? cur : next))
    }, 1000)
    return () => clearInterval(id)
  }, [])
  if (!online) return null
  return (
    <group>
      {ids.map((id) => {
        const r = remoteRiders.get(id)
        return r ? <Remote key={id} rider={r} /> : null
      })}
    </group>
  )
}

const mouth = new THREE.Vector3()
const fwd = new THREE.Vector3()
const vel = new THREE.Vector3()
const euler = new THREE.Euler(0, 0, 0, 'YXZ')
const tint = new THREE.Color()

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a
  d = Math.atan2(Math.sin(d), Math.cos(d))
  return a + d * t
}

function Remote({ rider }: { rider: RemoteRider }) {
  const dragon = useRef<THREE.Group>(null)
  const walker = useRef<THREE.Group>(null)
  const seat = useRef<THREE.Group>(null)
  const anim = useRef<DragonAnim>({ mode: 'fly', flapping: false, boosting: false, pitch: 0, bank: 0, look: 0 }).current
  const seated = useRef<RiderAnim>({ speed: 0, grounded: false, seated: true }).current
  const walking = useRef<RiderAnim>({ speed: 0, grounded: true, seated: false }).current
  const [look, setLook] = useState<DragonLook | null>(rider.look)
  const [name, setName] = useState(rider.name)

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    if (rider.look !== look) setLook(rider.look)
    if (rider.name !== name) setName(rider.name)
    const p = rider.pose
    const t = rider.target
    const k = 1 - Math.exp(-10 * dt)
    const prevX = p.px
    const prevZ = p.pz
    p.x += (t.x - p.x) * k
    p.y += (t.y - p.y) * k
    p.z += (t.z - p.z) * k
    p.px += (t.px - p.px) * k
    p.py += (t.py - p.py) * k
    p.pz += (t.pz - p.pz) * k
    p.yaw = lerpAngle(p.yaw, t.yaw, k)
    p.pyaw = lerpAngle(p.pyaw, t.pyaw, k)
    p.pitch += (t.pitch - p.pitch) * k
    p.bank += (t.bank - p.bank) * k
    p.mode = t.mode
    p.firing = t.firing

    const flying = p.mode === 'flying'
    anim.mode = flying ? 'fly' : 'parked'
    anim.pitch = p.pitch
    anim.bank = p.bank
    anim.flapping = flying && p.pitch > 0.2
    anim.boosting = p.firing
    if (dragon.current) {
      dragon.current.position.set(p.x, p.y, p.z)
      dragon.current.rotation.set(p.pitch, p.yaw, p.bank, 'YXZ')
    }
    if (seat.current) seat.current.visible = flying
    if (walker.current) {
      walker.current.visible = !flying
      walker.current.position.set(p.px, p.py, p.pz)
      walker.current.rotation.y = p.pyaw
      walking.speed = Math.hypot(p.px - prevX, p.pz - prevZ) / Math.max(dt, 1e-3)
    }

    if (p.firing && flying) {
      euler.set(p.pitch, p.yaw, 0)
      fwd.set(0, 0, -1).applyEuler(euler)
      mouth.set(0, 1.6, -7.6).applyEuler(euler).add(dragon.current!.position)
      tint.set((look ?? FALLBACK_LOOK).palette.fire[0])
      for (let i = 0; i < 2; i++) emit(mouth, vel.copy(fwd).multiplyScalar(60), { spread: 14, life: 0.5, size: 3.2, tint })
    }
  })

  return (
    <group>
      <group ref={dragon}>
        <DragonModel look={look ?? FALLBACK_LOOK} anim={anim} />
        <group ref={seat} position={[0, 0.3, -1.35]}>
          <RiderModel anim={seated} />
        </group>
        <Html position={[0, 6, 0]} center distanceFactor={60} zIndexRange={[10, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">{name}</div>
        </Html>
      </group>
      <group ref={walker} position={[0, -STANDING_HEIGHT, 0]}>
        <RiderModel anim={walking} />
      </group>
    </group>
  )
}
