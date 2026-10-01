import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { House } from '../townLayout'

/**
 * Half-timbered medieval houses, generated from the town layout and merged
 * into one geometry per material (a handful of draw calls for the whole
 * town). Materials are procedural: lime plaster with weathering, dark oak
 * beams, clay/slate shingles and fieldstone plinths.
 */

type Part = 'plaster' | 'timber' | 'roof' | 'stone' | 'door' | 'glass'

class Builder {
  parts: Record<Part, THREE.BufferGeometry[]> = { plaster: [], timber: [], roof: [], stone: [], door: [], glass: [] }
  m = new THREE.Matrix4()
  color = new THREE.Color()

  box(part: Part, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, rotZ = 0) {
    const g = new THREE.BoxGeometry(sx, sy, sz)
    if (rotZ) g.rotateZ(rotZ)
    g.translate(cx, cy, cz)
    this.push(part, g)
  }

  push(part: Part, g: THREE.BufferGeometry) {
    g.applyMatrix4(this.m)
    const n = g.attributes.position.count
    const c = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) c.set([this.color.r, this.color.g, this.color.b], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(c, 3))
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    this.parts[part].push(g.index ? g.toNonIndexed() : g)
  }
}

/** Gable roof: two sloped slabs with overhang, ridge along local X. */
function roof(b: Builder, w: number, d: number, wallTop: number, pitch: number) {
  const over = 0.6
  const halfD = d / 2 + over
  const rise = (d / 2) * pitch
  const len = w + over * 2
  const slope = Math.hypot(halfD, rise + over * pitch)
  const ang = Math.atan2(rise + over * pitch, halfD)
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(len, 0.22, slope)
    // uv: x along the ridge, y down the slope (metres) for the shingle shader
    const uv = g.attributes.uv as THREE.BufferAttribute
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i) * s)
    g.rotateX(s * ang)
    g.translate(0, wallTop + rise / 2 - over * pitch / 2 + 0.1, (s * halfD) / 2)
    b.push('roof', g)
  }
  // ridge cap
  b.box('timber', 0, wallTop + rise + 0.18, 0, len, 0.2, 0.3)
  return rise
}

/** Triangle gable wall on each end. */
function gables(b: Builder, w: number, d: number, wallTop: number, rise: number) {
  for (const s of [-1, 1]) {
    const shape = new THREE.Shape()
    shape.moveTo(-d / 2, 0)
    shape.lineTo(d / 2, 0)
    shape.lineTo(0, rise)
    shape.closePath()
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false })
    g.rotateY(Math.PI / 2)
    g.translate(s > 0 ? w / 2 - 0.25 : -w / 2, wallTop, 0)
    b.push('plaster', g)
    // timber outline along the gable edges
    const t = Math.atan2(rise, d / 2)
    const L = Math.hypot(d / 2, rise)
    for (const k of [-1, 1]) {
      const g2 = new THREE.BoxGeometry(0.16, L, 0.18)
      g2.rotateX(-k * (Math.PI / 2 - t))
      g2.translate(s * (w / 2 + 0.03), wallTop + rise / 2, (k * d) / 4)
      b.push('timber', g2)
    }
  }
}

function facadeFrame(b: Builder, w: number, d: number, h: number, floors: number, seed: number) {
  const floorH = (h - 0.8) / floors
  // horizontal beams at each floor line and under the eaves, all four sides
  for (let f = 0; f <= floors; f++) {
    const y = 0.8 + f * floorH
    b.box('timber', 0, y, -d / 2 - 0.05, w + 0.1, 0.2, 0.14)
    b.box('timber', 0, y, d / 2 + 0.05, w + 0.1, 0.2, 0.14)
    b.box('timber', -w / 2 - 0.05, y, 0, 0.14, 0.2, d + 0.1)
    b.box('timber', w / 2 + 0.05, y, 0, 0.14, 0.2, d + 0.1)
  }
  // corner posts
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) b.box('timber', sx * (w / 2 + 0.05), 0.8 + (h - 0.8) / 2, sz * (d / 2 + 0.05), 0.2, h - 0.8, 0.2)

  // front & back: posts between windows and diagonal braces
  const bays = Math.max(2, Math.round(w / 2.4))
  const bay = w / bays
  for (const sz of [-1, 1]) {
    for (let f = 0; f < floors; f++) {
      const y0 = 0.8 + f * floorH
      for (let i = 1; i < bays; i++) b.box('timber', -w / 2 + i * bay, y0 + floorH / 2, sz * (d / 2 + 0.06), 0.15, floorH, 0.12)
      for (let i = 0; i < bays; i++) {
        const cx = -w / 2 + (i + 0.5) * bay
        const isDoor = f === 0 && sz < 0 && i === Math.floor(bays / 2)
        if (isDoor) continue
        const hasWindow = (i + f + seed) % 3 !== 2
        if (hasWindow) {
          // window with frame and glowing glass
          const ww = Math.min(1.1, bay * 0.5)
          const wh = Math.min(1.25, floorH * 0.5)
          const wy = y0 + floorH * 0.52
          b.box('glass', cx, wy, sz * (d / 2 + 0.02), ww, wh, 0.06)
          b.box('timber', cx, wy - wh / 2 - 0.06, sz * (d / 2 + 0.1), ww + 0.3, 0.1, 0.18)
          b.box('timber', cx, wy + wh / 2 + 0.05, sz * (d / 2 + 0.08), ww + 0.2, 0.09, 0.12)
          b.box('timber', cx, wy, sz * (d / 2 + 0.07), 0.06, wh, 0.08)
          // shutters
          b.box('door', cx - ww / 2 - 0.22, wy, sz * (d / 2 + 0.1), 0.38, wh, 0.05)
          b.box('door', cx + ww / 2 + 0.22, wy, sz * (d / 2 + 0.1), 0.38, wh, 0.05)
        } else {
          // diagonal brace
          const L = Math.hypot(bay, floorH)
          const a = Math.atan2(floorH, bay) * ((i + f) % 2 ? 1 : -1)
          b.box('timber', cx, y0 + floorH / 2, sz * (d / 2 + 0.06), L * 0.92, 0.13, 0.1, a)
        }
      }
    }
  }
}

export function buildTown(houses: House[], baseY: number) {
  const b = new Builder()
  const Y = new THREE.Vector3(0, 1, 0)
  houses.forEach((h, idx) => {
    b.m.compose(new THREE.Vector3(h.x, baseY, h.z), new THREE.Quaternion().setFromAxisAngle(Y, h.rot), new THREE.Vector3(1, 1, 1))
    const floors = h.h > 6.2 ? 2 : 1
    const H = floors === 2 ? Math.max(h.h, 6.6) : Math.max(h.h, 4.2)
    // stone plinth
    b.color.setRGB(1, 1, 1)
    b.box('stone', 0, 0.4, 0, h.w + 0.3, 0.8, h.d + 0.3)
    // plaster walls (tinted per house)
    b.color.set(h.wall)
    b.box('plaster', 0, 0.8 + (H - 0.8) / 2, 0, h.w, H - 0.8, h.d)
    // upper floor jetties out a little over the street
    b.color.setRGB(1, 1, 1)
    facadeFrame(b, h.w, h.d, H, floors, idx)
    // door
    b.box('door', 0 + ((Math.max(2, Math.round(h.w / 2.4)) % 2 === 0 ? h.w / Math.max(2, Math.round(h.w / 2.4)) / 2 : 0)), 1.85, -h.d / 2 - 0.04, 1.15, 2.1, 0.1)
    b.color.set(h.roof)
    const pitch = 0.75 + (idx % 3) * 0.15
    const rise = roof(b, h.w, h.d, H, pitch)
    b.color.set(h.wall)
    gables(b, h.w, h.d, H, rise)
    // chimney
    if (idx % 2 === 0) {
      b.color.setRGB(1, 1, 1)
      const cx = (h.w / 2) * 0.55 * (idx % 4 === 0 ? 1 : -1)
      b.box('stone', cx, H + rise * 0.6 + 0.6, h.d * 0.12, 0.7, rise * 0.9 + 1.2, 0.7)
    }
  })

  const out: Partial<Record<Part, THREE.BufferGeometry>> = {}
  for (const k of Object.keys(b.parts) as Part[]) {
    if (!b.parts[k].length) continue
    const merged = mergeGeometries(b.parts[k], false)
    b.parts[k].forEach((g) => g.dispose())
    if (merged) {
      merged.computeVertexNormals()
      merged.computeBoundingSphere()
      out[k] = merged
    }
  }
  return out
}

// --- materials ---------------------------------------------------------------------

const NOISE = /* glsl */ `
  float th(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float tn(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(th(i), th(i + vec3(1,0,0)), f.x), mix(th(i + vec3(0,1,0)), th(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(th(i + vec3(0,0,1)), th(i + vec3(1,0,1)), f.x), mix(th(i + vec3(0,1,1)), th(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`

function withWorldPos(m: THREE.MeshStandardMaterial, key: string, colorCode: string, extraUniforms: Record<string, THREE.IUniform> = {}) {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, extraUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTW;\nvarying vec2 vTUv;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vTW;\nvarying vec2 vTUv;\n${NOISE}\nfloat gRough = 0.9;\n${Object.keys(extraUniforms).map((u) => `uniform float ${u};`).join('\n')}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${colorCode}`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
  }
  m.customProgramCacheKey = () => key
  return m
}

export function createTownMaterials() {
  const plaster = withWorldPos(
    new THREE.MeshStandardMaterial({ vertexColors: true }),
    'town-plaster',
    `
    float n = tn(vTW * 1.7) * 0.5 + tn(vTW * 6.0) * 0.3 + tn(vTW * 0.35) * 0.2;
    diffuseColor.rgb *= mix(0.82, 1.06, n);
    gRough = 0.92;
    `,
  )
  const timber = withWorldPos(
    new THREE.MeshStandardMaterial({ color: '#3a2618' }),
    'town-timber',
    `
    float grain = tn(vec3(vTW.x * 0.6, vTW.y * 9.0, vTW.z * 0.6)) * 0.6 + tn(vTW * 3.0) * 0.4;
    diffuseColor.rgb *= mix(0.7, 1.15, grain);
    gRough = 0.78;
    `,
  )
  const roof = withWorldPos(
    new THREE.MeshStandardMaterial({ vertexColors: true }),
    'town-roof',
    `
    // shingle rows down the slope, staggered every other row
    float rowH = 0.32;
    float row = floor(vTUv.y / rowH);
    float fy = fract(vTUv.y / rowH);
    float fx = fract(vTUv.x / 0.42 + mod(row, 2.0) * 0.5);
    float edge = smoothstep(0.0, 0.08, fx) * smoothstep(1.0, 0.92, fx);
    float lip = smoothstep(0.0, 0.25, fy);
    float tileId = th(vec3(floor(vTUv.x / 0.42 + mod(row, 2.0) * 0.5), row, 3.0));
    diffuseColor.rgb *= mix(0.55, 1.0, edge * lip) * mix(0.85, 1.12, tileId);
    diffuseColor.rgb *= mix(0.9, 1.05, tn(vTW * 0.4));
    gRough = mix(0.65, 0.85, tileId);
    `,
  )
  const stone = withWorldPos(
    new THREE.MeshStandardMaterial({ color: '#8d8a84' }),
    'town-stone',
    `
    // irregular fieldstones with dark mortar
    vec3 p = vTW * vec3(1.6, 2.6, 1.6);
    float a = tn(p) ; float b2 = tn(p * 2.3 + 5.0);
    float cells = abs(fract(p.y + a * 0.6) - 0.5) * 2.0;
    float mortar = smoothstep(0.82, 0.95, cells) + smoothstep(0.86, 0.97, abs(fract(p.x + p.z + floor(p.y) * 0.5 + a * 0.4) - 0.5) * 2.0);
    diffuseColor.rgb *= mix(0.75, 1.15, b2);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45, clamp(mortar, 0.0, 1.0));
    gRough = 0.9;
    `,
  )
  const door = withWorldPos(
    new THREE.MeshStandardMaterial({ color: '#5a3a22' }),
    'town-door',
    `
    float plank = smoothstep(0.0, 0.06, fract((vTW.x + vTW.z) * 3.2));
    diffuseColor.rgb *= mix(0.55, 1.0, plank) * mix(0.85, 1.1, tn(vTW * vec3(1.0, 8.0, 1.0)));
    gRough = 0.75;
    `,
  )
  const glass = new THREE.MeshStandardMaterial({ color: '#2a2a2a', emissive: '#ffb058', emissiveIntensity: 0.2, roughness: 0.15, metalness: 0.2 })
  return { plaster, timber, roof, stone, door, glass }
}

export function createCobbleMaterial() {
  return withWorldPos(
    new THREE.MeshStandardMaterial({ color: '#8d867b' }),
    'town-cobble',
    `
    vec2 p = vTW.xz * 2.2;
    vec2 cell = floor(p);
    p.x += mod(cell.y, 2.0) * 0.5;
    cell = floor(p);
    vec2 f = fract(p) - 0.5;
    float d = max(abs(f.x), abs(f.y) * 1.1);
    float stoneK = 1.0 - smoothstep(0.36, 0.48, d + tn(vec3(p * 3.0, 0.0)) * 0.08);
    float id = th(vec3(cell, 1.0));
    diffuseColor.rgb *= mix(0.42, mix(0.82, 1.15, id), stoneK);
    diffuseColor.rgb *= mix(0.88, 1.06, tn(vTW * 0.2));
    gRough = mix(0.98, 0.72, stoneK);
    `,
  )
}
