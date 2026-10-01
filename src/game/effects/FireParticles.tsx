import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { pool, MAX_PARTICLES } from './particles'

/** Soft round sprite generated once on a canvas — no texture download. */
function makeSprite() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.65)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const vertex = /* glsl */ `
  attribute float aSize;
  attribute vec4 aColor;
  varying vec4 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (420.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`
const fragment = /* glsl */ `
  uniform sampler2D uMap;
  varying vec4 vColor;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
    if (gl_FragColor.a < 0.01) discard;
  }
`

const FIRE_HOT = new THREE.Color('#fff3c4')
const mid = new THREE.Color()
const cool = new THREE.Color()
const SMOKE = new THREE.Color('#3f3f46')
const c = new THREE.Color()

/** Draws every live particle from the shared pool: additive fire, alpha-blended smoke. */
export function FireParticles() {
  const { fire, smoke } = useMemo(() => {
    const map = makeSprite()
    const build = (blending: THREE.Blending) => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(THREE.DynamicDrawUsage))
      geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1).setUsage(THREE.DynamicDrawUsage))
      geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 4), 4).setUsage(THREE.DynamicDrawUsage))
      const mat = new THREE.ShaderMaterial({
        uniforms: { uMap: { value: map } },
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending,
      })
      const pts = new THREE.Points(geo, mat)
      pts.frustumCulled = false
      return pts
    }
    return { fire: build(THREE.AdditiveBlending), smoke: build(THREE.NormalBlending) }
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const fp = fire.geometry.attributes.position.array as Float32Array
    const fs = fire.geometry.attributes.aSize.array as Float32Array
    const fc = fire.geometry.attributes.aColor.array as Float32Array
    const sp = smoke.geometry.attributes.position.array as Float32Array
    const ss = smoke.geometry.attributes.aSize.array as Float32Array
    const sc = smoke.geometry.attributes.aColor.array as Float32Array
    let nf = 0
    let ns = 0
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (pool.age[i] >= pool.life[i]) continue
      pool.age[i] += dt
      const k = Math.min(1, pool.age[i] / pool.life[i])
      const smokeP = pool.kind[i] === 1
      // fire slows quickly and rises; smoke drifts up lazily
      const drag = smokeP ? 0.6 : 2.2
      pool.vel[i * 3] *= 1 - drag * dt
      pool.vel[i * 3 + 1] = pool.vel[i * 3 + 1] * (1 - drag * dt) + (smokeP ? 3 : 6) * dt
      pool.vel[i * 3 + 2] *= 1 - drag * dt
      pool.pos[i * 3] += pool.vel[i * 3] * dt
      pool.pos[i * 3 + 1] += pool.vel[i * 3 + 1] * dt
      pool.pos[i * 3 + 2] += pool.vel[i * 3 + 2] * dt
      if (smokeP) {
        sp.set(pool.pos.subarray(i * 3, i * 3 + 3), ns * 3)
        ss[ns] = pool.size[i] * (0.6 + k * 1.8)
        sc.set([SMOKE.r, SMOKE.g, SMOKE.b, 0.45 * (1 - k)], ns * 4)
        ns++
      } else {
        fp.set(pool.pos.subarray(i * 3, i * 3 + 3), nf * 3)
        fs[nf] = pool.size[i] * (0.5 + k * 1.3)
        mid.setRGB(pool.tint[i * 3], pool.tint[i * 3 + 1], pool.tint[i * 3 + 2])
        cool.copy(mid).multiplyScalar(0.55)
        if (k < 0.3) c.copy(FIRE_HOT).lerp(mid, k / 0.3)
        else c.copy(mid).lerp(cool, (k - 0.3) / 0.7)
        fc.set([c.r, c.g, c.b, 1 - k], nf * 4)
        nf++
      }
    }
    for (const [pts, n] of [
      [fire, nf],
      [smoke, ns],
    ] as const) {
      pts.geometry.setDrawRange(0, n)
      pts.geometry.attributes.position.needsUpdate = true
      pts.geometry.attributes.aSize.needsUpdate = true
      pts.geometry.attributes.aColor.needsUpdate = true
    }
  })

  return (
    <>
      <primitive object={smoke} />
      <primitive object={fire} />
    </>
  )
}
