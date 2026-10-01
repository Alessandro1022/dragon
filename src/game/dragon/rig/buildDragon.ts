import * as THREE from 'three'
import type { DragonMaterials } from './materials'

/**
 * Procedural dragon rig.
 *
 * The neck, body and tail are one smooth lofted surface skinned to a bone
 * chain, so the whole creature bends organically. Wings are skinned
 * membranes on a shoulder → elbow → wrist skeleton so they can beat, glide
 * and fold. Legs, horns, jaw, eyes and back spines hang off the bones.
 *
 * Forward is −Z, the origin is the centre of the chest.
 */

export interface DragonShape {
  wingspan: number
  hornLength: number
  twinHorns: boolean
}

export interface DragonRig {
  root: THREE.Group
  bones: {
    chest: THREE.Bone
    neck: THREE.Bone[]
    head: THREE.Bone
    tail: THREE.Bone[]
  }
  jaw: THREE.Object3D
  /** at the tip of the snout, for fire */
  mouth: THREE.Object3D
  wings: {
    root: THREE.Bone
    elbow: THREE.Bone
    wrist: THREE.Bone
    side: 1 | -1
    /** bind-pose directions of upper arm, forearm and middle finger */
    rest: { arm: THREE.Vector3; fore: THREE.Vector3; finger: THREE.Vector3 }
  }[]
  legs: { hip: THREE.Object3D; knee: THREE.Object3D; front: boolean; side: 1 | -1 }[]
  saddle: THREE.Object3D
  dispose: () => void
}

// --- spine profile: z, y, half-width, half-height ---------------------------
const SPINE: [number, number, number, number][] = [
  [-7.95, 1.52, 0.1, 0.08],
  [-7.6, 1.6, 0.3, 0.24],
  [-7.1, 1.72, 0.45, 0.36],
  [-6.5, 1.86, 0.57, 0.47],
  [-5.95, 1.84, 0.5, 0.45],
  [-5.35, 1.6, 0.36, 0.38],
  [-4.5, 1.24, 0.42, 0.44],
  [-3.6, 0.88, 0.56, 0.56],
  [-2.65, 0.56, 0.95, 0.88],
  [-1.6, 0.36, 1.3, 1.12],
  [-0.4, 0.26, 1.36, 1.14],
  [0.8, 0.26, 1.2, 1.04],
  [1.9, 0.3, 1.02, 0.92],
  [3.0, 0.26, 0.72, 0.64],
  [4.3, 0.16, 0.5, 0.44],
  [5.8, 0.06, 0.36, 0.32],
  [7.4, -0.04, 0.24, 0.22],
  [9.0, -0.12, 0.15, 0.14],
  [10.6, -0.18, 0.08, 0.08],
  [12.1, -0.2, 0.015, 0.015],
]

const NECK_Z = [-3.6, -4.5, -5.35]
const HEAD_Z = -6.2
const CHEST_Z = -1.4
const TAIL_Z = [2.4, 3.6, 4.9, 6.3, 7.8, 9.3, 10.8]

function catmull(points: THREE.Vector4[], t: number, out: THREE.Vector4) {
  const n = points.length - 1
  const f = t * n
  const i = Math.min(n - 1, Math.floor(f))
  const u = f - i
  const p0 = points[Math.max(0, i - 1)]
  const p1 = points[i]
  const p2 = points[i + 1]
  const p3 = points[Math.min(n, i + 2)]
  const u2 = u * u
  const u3 = u2 * u
  for (const k of ['x', 'y', 'z', 'w'] as const) {
    out[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3)
  }
  return out
}

/** Smooth body loft with skin weights to the spine bones. */
function buildBody(boneZ: number[]) {
  const RINGS = 140
  const SEG = 28
  const ctrl = SPINE.map(([z, y, w, h]) => new THREE.Vector4(z, y, w, h))
  // sample the spine densely and parametrise by arc length
  const samples: THREE.Vector4[] = []
  const tmp = new THREE.Vector4()
  for (let i = 0; i <= RINGS; i++) samples.push(catmull(ctrl, i / RINGS, tmp).clone())
  const ry = (s: THREE.Vector4) => s.w

  const pos: number[] = []
  const nrm: number[] = []
  const uv: number[] = []
  const side: number[] = []
  const skinIndex: number[] = []
  const skinWeight: number[] = []
  let arc = 0
  for (let r = 0; r <= RINGS; r++) {
    const s = samples[r]
    if (r > 0) arc += Math.hypot(s.x - samples[r - 1].x, s.y - samples[r - 1].y)
    const prev = samples[Math.max(0, r - 1)]
    const next = samples[Math.min(RINGS, r + 1)]
    const tan = new THREE.Vector3(next.x - prev.x, next.y - prev.y, 0)
    // loft direction is mostly along z; tangent in the (z, y) plane
    const tz = tan.x
    const ty = tan.y
    const tl = Math.hypot(tz, ty) || 1
    const up = new THREE.Vector3(0, tz / tl, -ty / tl) // perpendicular to the tangent, pointing up
    if (up.y < 0) up.negate()
    const perim = Math.PI * (3 * (s.z + ry(s)) - Math.sqrt((3 * s.z + ry(s)) * (s.z + 3 * ry(s))))

    // bone weights from position along the spine
    const z = s.x
    let bi = 0
    while (bi < boneZ.length - 1 && z > boneZ[bi + 1]) bi++
    const za = boneZ[bi]
    const zb = boneZ[Math.min(boneZ.length - 1, bi + 1)]
    let wB = zb === za ? 0 : THREE.MathUtils.clamp((z - za) / (zb - za), 0, 1)
    wB = wB * wB * (3 - 2 * wB)

    for (let k = 0; k <= SEG; k++) {
      const a = (k / SEG) * Math.PI * 2 // 0 = top
      const cx = Math.sin(a)
      const cy = Math.cos(a)
      // flatter belly, a ridge along the spine
      const ridge = 1 + 0.12 * Math.exp(-(a * a) / 0.04) + 0.12 * Math.exp(-((a - Math.PI * 2) ** 2) / 0.04)
      const belly = cy < 0 ? 0.82 : 1
      const ox = cx * s.z
      const oy = cy * ry(s) * ridge * belly
      pos.push(ox, s.y + up.y * oy, s.x + up.z * oy)
      const nx = cx / s.z
      const ny = (cy / ry(s)) * up.y
      const nz = (cy / ry(s)) * up.z
      const nl = Math.hypot(nx, ny, nz) || 1
      nrm.push(nx / nl, ny / nl, nz / nl)
      uv.push((k / SEG) * perim, arc)
      side.push(Math.min(a, Math.PI * 2 - a) / Math.PI)
      skinIndex.push(bi, Math.min(boneZ.length - 1, bi + 1), 0, 0)
      skinWeight.push(1 - wB, wB, 0, 0)
    }
  }
  const index: number[] = []
  for (let r = 0; r < RINGS; r++)
    for (let k = 0; k < SEG; k++) {
      const a = r * (SEG + 1) + k
      const b = a + SEG + 1
      index.push(a, b, a + 1, a + 1, b, b + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1))
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4))
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4))
  g.setIndex(index)
  g.computeVertexNormals() // smooth and seam-consistent
  return g
}

/** Spine height/half-height at a given z, for attaching things to the surface. */
export function spineAt(z: number) {
  const ctrl = SPINE.map(([sz, y, w, h]) => new THREE.Vector4(sz, y, w, h))
  // find t by z (monotonic)
  let lo = 0
  let hi = 1
  const v = new THREE.Vector4()
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2
    catmull(ctrl, m, v)
    if (v.x < z) lo = m
    else hi = m
  }
  return { y: v.y, w: v.z, h: v.w }
}

/** A tapered, optionally curved tube from a polyline — horns, claws, wing bones. */
function tube(points: THREE.Vector3[], r0: number, r1: number, radial = 10, colorBase?: THREE.Color, colorTip?: THREE.Color) {
  const curve = new THREE.CatmullRomCurve3(points)
  const tubular = Math.max(8, points.length * 6)
  const g = new THREE.TubeGeometry(curve, tubular, 1, radial, false)
  const pos = g.attributes.position as THREE.BufferAttribute
  const frames = curve.computeFrenetFrames(tubular, false)
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.9))
    const p = curve.getPointAt(t)
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j
      const a = (j / radial) * Math.PI * 2
      const n = frames.normals[i].clone().multiplyScalar(-Math.cos(a)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(a)))
      pos.setXYZ(k, p.x + n.x * r, p.y + n.y * r, p.z + n.z * r)
      if (colorBase && colorTip) {
        c.copy(colorBase).lerp(colorTip, Math.pow(t, 1.6))
        colors.set([c.r, c.g, c.b], k * 3)
      } else colors.set([1, 1, 1], k * 3)
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  // cap the base so tubes don't look hollow
  return g
}

/**
 * Give a limb/bone mesh the attributes the scale shader expects: uv in
 * metres (x around, y along) and a body-zone value (0 spine … 1 belly).
 */
function scaleAttrs(g: THREE.BufferGeometry, side: number, around: number, along: number, swap = false) {
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i)
    const v = uv.getY(i)
    if (swap) uv.setXY(i, v * around, u * along)
    else uv.setXY(i, u * around, v * along)
  }
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(new Array(uv.count).fill(side), 1))
  return g
}

function capsule(r: number, len: number, seg = 12) {
  const g = new THREE.CapsuleGeometry(r, len, 6, seg)
  return g
}

// --- wings -------------------------------------------------------------------

const WING = {
  elbow: new THREE.Vector3(2.5, 0.35, -0.9),
  wrist: new THREE.Vector3(4.5, 0.55, -0.35),
  fingers: [new THREE.Vector3(7.9, 0.15, 0.35), new THREE.Vector3(7.0, -0.05, 2.2), new THREE.Vector3(5.0, -0.1, 3.4)],
  trailing: new THREE.Vector3(0.4, -0.05, 2.7),
}

/**
 * Membrane as a quad grid between consecutive "rays" (leading edge → fingers
 * → body). Each vertex is skinned to shoulder/elbow/wrist by its span.
 */
function buildMembrane(span: number) {
  const s = (v: THREE.Vector3) => new THREE.Vector3(v.x * span, v.y, v.z * Math.sqrt(span))
  const hub = s(WING.wrist)
  const rim = [s(WING.fingers[0]), s(WING.fingers[1]), s(WING.fingers[2]), s(WING.trailing), new THREE.Vector3(0.2, 0, 1.1), new THREE.Vector3(0, 0, -0.45), s(WING.elbow)]
  const pos: number[] = []
  const uv: number[] = []
  const si: number[] = []
  const sw: number[] = []
  const index: number[] = []
  const N = 9 // subdivisions from hub to rim
  const M = 7 // subdivisions along each rim edge
  const elbowX = WING.elbow.x * span
  const wristX = WING.wrist.x * span
  const verts: THREE.Vector3[] = []
  const weights = (p: THREE.Vector3): [number, number, number] => {
    // 0 shoulder, 1 elbow, 2 wrist
    const x = p.x
    if (x >= wristX - 0.2) return [0, 0, 1]
    if (x >= elbowX) {
      const k = THREE.MathUtils.smoothstep(x, elbowX, wristX - 0.2)
      return [0, 1 - k, k]
    }
    const k = THREE.MathUtils.smoothstep(x, elbowX * 0.35, elbowX)
    return [1 - k, k, 0]
  }
  for (let e = 0; e < rim.length - 1; e++) {
    const a = rim[e]
    const b = rim[e + 1]
    const base = verts.length
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= M; j++) {
        const tRim = j / M
        const edge = a.clone().lerp(b, tRim)
        // scalloped trailing edge between finger tips
        if (e < 3) {
          const sag = Math.sin(tRim * Math.PI) * 0.22
          const mid = hub.clone().sub(edge).multiplyScalar(sag)
          edge.add(mid)
        }
        const t = i / N
        const p = hub.clone().lerp(edge, t)
        // the membrane billows downward between the bones
        const billow = Math.sin(t * Math.PI) * Math.sin(tRim * Math.PI) * 0.35 * (e < 3 ? 1 : 0.6)
        p.y -= billow
        verts.push(p)
        pos.push(p.x, p.y, p.z)
        uv.push(p.x / (8 * span), (e + tRim) / (rim.length - 1))
        const w = weights(p)
        si.push(0, 1, 2, 0)
        sw.push(w[0], w[1], w[2], 0)
      }
    }
    for (let i = 0; i < N; i++)
      for (let j = 0; j < M; j++) {
        const q = base + i * (M + 1) + j
        index.push(q, q + M + 1, q + 1, q + 1, q + M + 1, q + M + 2)
      }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

function buildWing(side: 1 | -1, span: number, mats: DragonMaterials, disposables: THREE.BufferGeometry[]) {
  const holder = new THREE.Group()
  holder.position.set(side * 0.95, 0.85, -1.85)
  holder.scale.x = side // mirror the left wing

  const root = new THREE.Bone()
  const elbow = new THREE.Bone()
  const wrist = new THREE.Bone()
  const e = new THREE.Vector3(WING.elbow.x * span, WING.elbow.y, WING.elbow.z)
  const w = new THREE.Vector3(WING.wrist.x * span, WING.wrist.y, WING.wrist.z)
  elbow.position.copy(e)
  wrist.position.copy(w).sub(e)
  root.add(elbow)
  elbow.add(wrist)

  const memGeo = buildMembrane(span)
  disposables.push(memGeo)
  const membrane = new THREE.SkinnedMesh(memGeo, mats.membrane)
  membrane.add(root)
  membrane.updateMatrixWorld(true)
  membrane.bind(new THREE.Skeleton([root, elbow, wrist]))
  membrane.castShadow = true
  membrane.frustumCulled = false
  holder.add(membrane)

  // bones of the wing, rigid on their joints
  const arm = scaleAttrs(tube([new THREE.Vector3(0, 0, 0), e.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.12, 0)), e], 0.26, 0.17, 10), 0.35, 1.4, e.length(), true)
  const fore = scaleAttrs(tube([new THREE.Vector3(0, 0, 0), w.clone().sub(e)], 0.17, 0.12, 8), 0.35, 1.0, w.distanceTo(e), true)
  disposables.push(arm, fore)
  const armM = new THREE.Mesh(arm, mats.scales)
  const foreM = new THREE.Mesh(fore, mats.scales)
  armM.castShadow = foreM.castShadow = true
  root.add(armM)
  elbow.add(foreM)
  const sw = (v: THREE.Vector3) => new THREE.Vector3(v.x * span, v.y, v.z * Math.sqrt(span)).sub(w)
  for (const f of [...WING.fingers]) {
    const tip = sw(f)
    const g = scaleAttrs(tube([new THREE.Vector3(0, 0, 0), tip.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, 0.08, 0)), tip], 0.1, 0.025, 6), 0.3, 0.6, tip.length(), true)
    disposables.push(g)
    const m = new THREE.Mesh(g, mats.scales)
    m.castShadow = true
    wrist.add(m)
  }
  // thumb claw at the wrist
  const thumb = tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.25, 0.25, -0.35), new THREE.Vector3(0.2, 0.15, -0.75)], 0.09, 0.01, 6)
  disposables.push(thumb)
  wrist.add(new THREE.Mesh(thumb, mats.claw))

  const rest = {
    arm: e.clone().normalize(),
    fore: w.clone().sub(e).normalize(),
    finger: sw(WING.fingers[1]).normalize(),
  }
  return { holder, root, elbow, wrist, rest }
}

// --- legs ----------------------------------------------------------------------

function buildLeg(front: boolean, side: 1 | -1, mats: DragonMaterials, disposables: THREE.BufferGeometry[]) {
  const hip = new THREE.Group()
  const z = front ? -1.85 : 1.6
  hip.position.set(side * (front ? 0.95 : 1.0), front ? -0.2 : -0.1, z)

  // big muscle mass blending into the body
  const thighGeo = new THREE.SphereGeometry(1, 20, 14)
  if (front) thighGeo.scale(0.36, 0.85, 0.44)
  else thighGeo.scale(0.46, 1.02, 0.66)
  thighGeo.translate(0, front ? -0.45 : -0.5, 0)
  scaleAttrs(thighGeo, 0.45, 4.5, 2.4)
  disposables.push(thighGeo)
  const thigh = new THREE.Mesh(thighGeo, mats.scales)
  thigh.castShadow = true
  hip.add(thigh)

  const knee = new THREE.Group()
  knee.position.set(0, front ? -1.2 : -1.32, front ? 0.0 : 0.15)
  hip.add(knee)
  const shinGeo = capsule(front ? 0.2 : 0.24, front ? 0.62 : 0.66, 14)
  shinGeo.translate(0, -0.42, 0)
  scaleAttrs(shinGeo, 0.4, 1.4, 1.2)
  disposables.push(shinGeo)
  const shin = new THREE.Mesh(shinGeo, mats.scales)
  shin.castShadow = true
  knee.add(shin)

  const foot = new THREE.Group()
  foot.position.set(0, front ? -0.92 : -0.98, -0.02)
  knee.add(foot)
  const padGeo = new THREE.SphereGeometry(0.3, 16, 10)
  padGeo.scale(1, 0.42, 1.3)
  scaleAttrs(padGeo, 0.5, 1.8, 0.9)
  disposables.push(padGeo)
  const pad = new THREE.Mesh(padGeo, mats.scales)
  pad.castShadow = true
  foot.add(pad)
  for (const dx of [-0.18, 0, 0.18]) {
    const c = tube([new THREE.Vector3(dx, 0, -0.22), new THREE.Vector3(dx * 1.2, -0.02, -0.46), new THREE.Vector3(dx * 1.3, -0.14, -0.6)], 0.065, 0.008, 6)
    disposables.push(c)
    foot.add(new THREE.Mesh(c, mats.claw))
  }
  return { hip, knee, front, side }
}

// --- head --------------------------------------------------------------------

function buildHead(headBone: THREE.Bone, shape: DragonShape, mats: DragonMaterials, disposables: THREE.BufferGeometry[]) {
  // parts are authored in body space; this group cancels the head bone's offset
  const head = new THREE.Group()
  head.position.set(0, -spineAt(HEAD_Z).y, -HEAD_Z)
  headBone.add(head)
  const hz = 0
  const hornBase = new THREE.Color().setRGB(1, 1, 1)
  const hornTip = new THREE.Color().setRGB(0.35, 0.3, 0.26)
  const L = shape.hornLength
  // main horns sweep back and curl up
  for (const s of [-1, 1]) {
    const pts = [
      new THREE.Vector3(s * 0.28, 2.18, -5.95),
      new THREE.Vector3(s * 0.42, 2.45, -5.4 + 0.1),
      new THREE.Vector3(s * 0.55, 2.55 + 0.1 * L, -4.7 - 0.0),
      new THREE.Vector3(s * 0.62, 2.75 + 0.35 * L, -4.0 + 0.2 * (L - 1)),
    ].map((p) => p.sub(new THREE.Vector3(0, 0, hz)))
    // stretch with the horn gene
    for (let i = 1; i < pts.length; i++) pts[i].sub(pts[0]).multiplyScalar(0.6 + 0.4 * L).add(pts[0])
    const g = tube(pts, 0.17, 0.015, 10, hornBase, hornTip)
    disposables.push(g)
    head.add(new THREE.Mesh(g, mats.horn))
    // smaller cheek horns
    const g2 = tube(
      [new THREE.Vector3(s * 0.42, 1.75, -5.75), new THREE.Vector3(s * 0.66, 1.78, -5.35), new THREE.Vector3(s * 0.82, 1.92, -4.95)].map((p) => p.sub(new THREE.Vector3(0, 0, hz))),
      0.08,
      0.01,
      8,
      hornBase,
      hornTip,
    )
    disposables.push(g2)
    head.add(new THREE.Mesh(g2, mats.horn))
    if (shape.twinHorns) {
      const g3 = tube(
        [new THREE.Vector3(s * 0.16, 2.2, -6.35), new THREE.Vector3(s * 0.2, 2.5, -6.0), new THREE.Vector3(s * 0.22, 2.75, -5.55)].map((p) => p.sub(new THREE.Vector3(0, 0, hz))),
        0.1,
        0.01,
        8,
        hornBase,
        hornTip,
      )
      disposables.push(g3)
      head.add(new THREE.Mesh(g3, mats.horn))
    }
    // eye with a brow ridge
    const eyeGeo = new THREE.SphereGeometry(0.11, 14, 10)
    eyeGeo.scale(0.55, 0.75, 1)
    disposables.push(eyeGeo)
    const eye = new THREE.Mesh(eyeGeo, mats.eye)
    eye.position.set(s * 0.5, 2.0, -6.62 - hz)
    eye.rotation.y = s * 0.35
    head.add(eye)
    const pupilGeo = new THREE.BoxGeometry(0.012, 0.15, 0.02)
    disposables.push(pupilGeo)
    const pupil = new THREE.Mesh(pupilGeo, mats.claw)
    pupil.position.set(s * 0.562, 2.0, -6.64 - hz)
    pupil.rotation.y = s * 0.35
    head.add(pupil)
    const brow = scaleAttrs(tube([new THREE.Vector3(s * 0.3, 2.13, -6.95), new THREE.Vector3(s * 0.46, 2.15, -6.6), new THREE.Vector3(s * 0.42, 2.12, -6.25)].map((p) => p.sub(new THREE.Vector3(0, 0, hz))), 0.07, 0.04, 8)
    , 0.2, 0.4, 0.7, true)
    disposables.push(brow)
    head.add(new THREE.Mesh(brow, mats.scales))
    // nostril
    const nos = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mats.claw)
    disposables.push(nos.geometry)
    nos.position.set(s * 0.12, 1.72, -7.82 - hz)
    head.add(nos)
  }

  // lower jaw, hinged at the back of the head
  const jaw = new THREE.Group()
  jaw.position.set(0, 1.58, -5.95 - hz)
  head.add(jaw)
  const jawGeo = tube(
    [new THREE.Vector3(0, 0, 0.05), new THREE.Vector3(0, -0.12, -0.7), new THREE.Vector3(0, -0.16, -1.35), new THREE.Vector3(0, -0.08, -1.85)],
    0.3,
    0.08,
    14,
  )
  jawGeo.scale(1.25, 0.55, 1)
  scaleAttrs(jawGeo, 0.75, 1.4, 1.9, true)
  disposables.push(jawGeo)
  const jawM = new THREE.Mesh(jawGeo, mats.scales)
  jawM.castShadow = true
  jaw.add(jawM)
  // teeth on both jaws
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = -0.35 - i * 0.3
      const tGeo = new THREE.ConeGeometry(0.028, 0.13, 5)
      disposables.push(tGeo)
      const lower = new THREE.Mesh(tGeo, mats.tooth)
      lower.position.set(s * (0.2 - i * 0.02), 0.02, z)
      jaw.add(lower)
      const upper = new THREE.Mesh(tGeo, mats.tooth)
      upper.rotation.x = Math.PI
      upper.position.set(s * (0.22 - i * 0.02), 1.42, -6.3 - i * 0.3 - hz)
      head.add(upper)
    }
  }
  const mouth = new THREE.Object3D()
  mouth.position.set(0, 1.5, -8.05)
  head.add(mouth)
  return { jaw, mouth }
}

// --- assembly -------------------------------------------------------------------

export function buildDragon(shape: DragonShape, mats: DragonMaterials): DragonRig {
  const disposables: THREE.BufferGeometry[] = []
  const root = new THREE.Group()

  // bone chain, ordered head → tail along z for skinning
  const boneZ = [HEAD_Z, ...[...NECK_Z].reverse(), CHEST_Z, ...TAIL_Z]
  const bones = boneZ.map(() => new THREE.Bone())
  const iHead = 0
  const iChest = 1 + NECK_Z.length
  // hierarchy: chest → neck[0] → neck[1] → neck[2] → head ; chest → tail[0] → …
  const chest = bones[iChest]
  chest.position.set(0, spineAt(CHEST_Z).y, CHEST_Z)
  let parent: THREE.Bone = chest
  const neckBones: THREE.Bone[] = []
  for (let k = iChest - 1; k >= iHead; k--) {
    const b = bones[k]
    const z = boneZ[k]
    const pz = boneZ[k + 1]
    b.position.set(0, spineAt(z).y - spineAt(pz).y, z - pz)
    parent.add(b)
    parent = b
    if (k > iHead) neckBones.push(b)
  }
  const head = bones[iHead]
  parent = chest
  const tailBones: THREE.Bone[] = []
  for (let k = iChest + 1; k < bones.length; k++) {
    const b = bones[k]
    b.position.set(0, spineAt(boneZ[k]).y - spineAt(boneZ[k - 1]).y, boneZ[k] - boneZ[k - 1])
    parent.add(b)
    parent = b
    tailBones.push(b)
  }

  const bodyGeo = buildBody(boneZ)
  disposables.push(bodyGeo)
  const body = new THREE.SkinnedMesh(bodyGeo, mats.scales)
  body.add(chest)
  body.updateMatrixWorld(true)
  body.bind(new THREE.Skeleton(bones))
  body.castShadow = true
  body.receiveShadow = true
  body.frustumCulled = false
  root.add(body)

  // head details live in the head bone's space
  const { jaw, mouth } = buildHead(head, shape, mats, disposables)
  head.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true
  })

  // dorsal spines along the neck, back and tail (skipping the saddle)
  const spineBones: [THREE.Bone, number][] = [
    [neckBones[0], NECK_Z[0]],
    [neckBones[1], NECK_Z[1]],
    [neckBones[2], NECK_Z[2]],
    [chest, CHEST_Z],
    ...tailBones.map((b, i) => [b, TAIL_Z[i]] as [THREE.Bone, number]),
  ]
  body.updateMatrixWorld(true)
  const spikeGeo = new THREE.ConeGeometry(1, 1, 6)
  spikeGeo.translate(0, 0.5, 0)
  disposables.push(spikeGeo)
  for (let z = -5.6; z < 11.2; z += 0.42) {
    if (z > -2.3 && z < -0.4) continue // saddle
    const sp = spineAt(z)
    // attach to the closest bone at or in front of this point
    let host = spineBones[0]
    for (const sb of spineBones) if (Math.abs(sb[1] - z) < Math.abs(host[1] - z)) host = sb
    const size = THREE.MathUtils.clamp(sp.h * 0.55, 0.06, 0.5)
    const m = new THREE.Mesh(spikeGeo, mats.spike)
    m.castShadow = true
    m.scale.set(size * 0.32, size * 1.2, size * 0.55)
    m.rotation.x = -0.6
    // convert to the host bone's local space
    const world = new THREE.Vector3(0, sp.y + sp.h * 1.08, z)
    host[0].worldToLocal(world)
    m.position.copy(world)
    host[0].add(m)
  }

  // saddle and harness
  const saddle = new THREE.Group()
  const sp = spineAt(-1.35)
  const saddleGeo = new THREE.CylinderGeometry(0.62, 0.7, 0.85, 18, 1, false, -Math.PI * 0.62, Math.PI * 1.24)
  saddleGeo.rotateX(Math.PI / 2)
  saddleGeo.scale(1.15, 1, 1)
  disposables.push(saddleGeo)
  const saddleM = new THREE.Mesh(saddleGeo, mats.saddle)
  saddleM.position.set(0, sp.y + sp.h * 0.98 - 0.42, -1.35)
  saddleM.castShadow = true
  saddle.add(saddleM)
  const strapGeo = new THREE.TorusGeometry(1.0, 0.05, 6, 32)
  strapGeo.scale(1.12, 1, 1)
  disposables.push(strapGeo)
  const strap = new THREE.Mesh(strapGeo, mats.saddle)
  strap.rotation.y = Math.PI / 2
  strap.position.set(0, sp.y + 0.02, -1.25)
  saddle.add(strap)
  // move into chest bone space so it rides with the body
  chest.updateMatrixWorld(true)
  for (const c of [...saddle.children]) {
    const wp = c.position.clone()
    chest.worldToLocal(wp)
    c.position.copy(wp)
  }
  chest.add(saddle)

  const wings = ([1, -1] as const).map((side) => {
    const w = buildWing(side, shape.wingspan, mats, disposables)
    const wp = w.holder.position.clone()
    chest.worldToLocal(wp)
    w.holder.position.copy(wp)
    chest.add(w.holder)
    return { root: w.root, elbow: w.elbow, wrist: w.wrist, side, rest: w.rest }
  })

  const legs = ([
    [true, 1],
    [true, -1],
    [false, 1],
    [false, -1],
  ] as const).map(([front, side]) => {
    const l = buildLeg(front, side, mats, disposables)
    const host = front ? chest : tailBones[0]
    host.updateMatrixWorld(true)
    const wp = l.hip.position.clone()
    host.worldToLocal(wp)
    l.hip.position.copy(wp)
    host.add(l.hip)
    return l
  })

  return {
    root,
    bones: { chest, neck: neckBones, head, tail: tailBones },
    jaw,
    mouth,
    wings,
    legs,
    saddle,
    dispose: () => disposables.forEach((g) => g.dispose()),
  }
}
