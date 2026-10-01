import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { DragonPalette } from '../../systems/genetics'
import { buildDragon } from './rig/buildDragon'
import { createDragonMaterials } from './rig/materials'
import { sunDirection } from '../world/time'

/**
 * A fully rigged procedural dragon. Appearance comes from the genes
 * (palette, wingspan, horns); motion from `anim`, which callers mutate
 * every frame.
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
export const STANDING_HEIGHT = 2.45

const damp = THREE.MathUtils.damp

export function DragonModel({
  look,
  anim,
  mouthRef,
}: {
  look: DragonLook
  anim: DragonAnim
  mouthRef?: React.MutableRefObject<THREE.Object3D | null>
}) {
  const mats = useMemo(() => createDragonMaterials(look.palette), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => mats.setPalette(look.palette), [look.palette, mats])
  useEffect(() => () => mats.dispose(), [mats])

  const rig = useMemo(
    () => buildDragon({ wingspan: look.wingspan, hornLength: look.hornLength, twinHorns: look.twinHorns }, mats),
    [look.wingspan, look.hornLength, look.twinHorns, mats],
  )
  useEffect(() => () => rig.dispose(), [rig])
  useEffect(() => {
    if (mouthRef) mouthRef.current = rig.mouth
  }, [rig, mouthRef])

  const phase = useRef(Math.random() * 10)
  const glow = useRef(0)
  const fold = useRef(anim.mode === 'parked' ? 1 : 0)

  // folded-wing pose: upper arm up and back, forearm down along the flank, fingers trailing
  const foldPose = useMemo(() => {
    const r = rig.wings[0].rest
    const arm = new THREE.Vector3(0.32, 0.72, 0.62).normalize()
    const qRoot = new THREE.Quaternion().setFromUnitVectors(r.arm, arm)
    const fore = new THREE.Vector3(0.14, -0.55, 0.82).normalize().applyQuaternion(qRoot.clone().invert())
    const qElbow = new THREE.Quaternion().setFromUnitVectors(r.fore, fore)
    const qRE = qRoot.clone().multiply(qElbow)
    const finger = new THREE.Vector3(0.06, -0.22, 0.97).normalize().applyQuaternion(qRE.clone().invert())
    const qWrist = new THREE.Quaternion().setFromUnitVectors(r.finger, finger)
    return { qRoot, qElbow, qWrist }
  }, [rig])
  const qa = useMemo(() => ({ e: new THREE.Euler(), q: new THREE.Quaternion() }), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const t = performance.now() / 1000
    const parked = anim.mode === 'parked'
    const hover = anim.mode === 'hover'
    const active = anim.flapping || anim.boosting
    const climbing = anim.pitch > 0.25
    const freq = parked ? 0.5 : hover ? 8.5 : active ? 7 : climbing ? 4 : 1.2
    const amp = parked ? 0 : hover ? 0.75 : active ? 0.85 : climbing ? 0.5 : 0.08
    phase.current += dt * freq
    const beat = Math.sin(phase.current) * amp
    const dive = THREE.MathUtils.clamp((-anim.pitch - 0.35) * 1.6, 0, 1)

    mats.sunDir.copy(sunDirection())

    // --- wings: blend between the flight pose (beat/glide) and the folded pose ---
    fold.current = damp(fold.current, parked ? 1 : dive * 0.4, parked ? 2.5 : 5, dt)
    const f = fold.current
    for (const w of rig.wings) {
      qa.q.setFromEuler(qa.e.set(0, 0, beat + 0.06))
      w.root.quaternion.slerpQuaternions(qa.q, foldPose.qRoot, f)
      // the forearm and fingers trail the beat a little
      qa.q.setFromEuler(qa.e.set(0, 0, -beat * 0.4))
      w.elbow.quaternion.slerpQuaternions(qa.q, foldPose.qElbow, f)
      qa.q.setFromEuler(qa.e.set(0, 0, -beat * 0.25))
      w.wrist.quaternion.slerpQuaternions(qa.q, foldPose.qWrist, f)
    }

    // --- tail: travelling wave that leans into turns; curls when resting ---
    rig.bones.tail.forEach((b, i) => {
      const k = (i + 1) / rig.bones.tail.length
      const wave = Math.sin(t * (parked ? 0.9 : 2.0) - i * 0.6) * (parked ? 0.06 : 0.05 + k * 0.05)
      const curl = parked ? 0.12 * k : 0
      b.rotation.y = damp(b.rotation.y, wave + curl + anim.bank * 0.07, 6, dt)
      const sag = parked ? (i < 2 ? -0.1 : 0.04) : active ? Math.cos(phase.current - i * 0.5) * 0.035 : 0
      b.rotation.x = damp(b.rotation.x, sag, 6, dt)
    })

    // --- neck & head: look into turns / at things, rise when standing ---
    const look = -anim.bank * 0.22 + anim.look
    rig.bones.neck.forEach((b, i) => {
      b.rotation.y = damp(b.rotation.y, look * 0.33, 3, dt)
      const breathe = parked ? Math.sin(t * 0.8 + i) * 0.015 : 0
      b.rotation.x = damp(b.rotation.x, (parked ? 0.14 : -anim.pitch * 0.08) + breathe, 3, dt)
    })
    rig.bones.head.rotation.x = damp(rig.bones.head.rotation.x, parked ? -0.3 : -anim.pitch * 0.3, 4, dt)
    rig.jaw.rotation.x = damp(rig.jaw.rotation.x, anim.boosting ? -0.42 : parked ? -0.03 - Math.max(0, Math.sin(t * 0.37)) * 0.05 : -0.04, 10, dt)

    // --- legs: tucked in flight, planted on the ground ---
    for (const l of rig.legs) {
      // positive x swings a hanging leg forward; flight sweeps them back
      const hip = parked ? (l.front ? 0.1 : 0.32) : l.front ? -0.55 : -1.2
      const knee = parked ? (l.front ? -0.12 : -0.6) : l.front ? 1.9 : 0.35
      l.hip.rotation.x = damp(l.hip.rotation.x, hip, 5, dt)
      l.knee.rotation.x = damp(l.knee.rotation.x, knee, 5, dt)
    }

    // glowing veins pulse (only dragons with the 'glöd' trait)
    glow.current = 1.2 + Math.sin(t * 2) * 0.5
    mats.setGlow(glow.current)
  })

  return <primitive object={rig.root} />
}
