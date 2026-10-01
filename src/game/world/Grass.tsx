import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { terrainHeight } from './terrainHeight'
import { TOWN, NEST } from './worldSpots'
import { focusPosition } from '../focus'
import { player } from '../player/playerState'
import { flight } from '../dragon/flightState'
import { useGame } from '../../store/gameStore'

/**
 * GPU grass: up to ~150k wind-blown blades around the player in a single
 * draw call. Blade positions are fixed in world space (they wrap around
 * the player instead of following it), and each blade reads the ground
 * height and a grass-density mask from a small float texture that's
 * recomputed in the background as you move.
 */

/** Two rings: a dense carpet right around you and a sparser field further out. */
const SETTINGS = {
  low: [],
  medium: [
    { count: 55000, radius: 16 },
    { count: 50000, radius: 48 },
  ],
  high: [
    { count: 110000, radius: 20 },
    { count: 110000, radius: 75 },
  ],
} as const

const MAP_RES = 128
const SEGMENTS = 5

function bladeGeometry() {
  const g = new THREE.InstancedBufferGeometry()
  const pos: number[] = []
  const uv: number[] = []
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS
    const w = 0.042 * (1 - t * 0.92)
    pos.push(-w, t, 0, w, t, 0)
    uv.push(0, t, 1, t)
  }
  const idx: number[] = []
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3))
  g.setIndex(idx)
  return g
}

/** 0..1: how much grass grows here. */
function density(x: number, z: number, h: number, hx: number, hz: number, step: number) {
  if (h < 7 || h > 165) return 0
  const slope = Math.hypot(hx - h, hz - h) / step
  if (slope > 0.55) return 0
  let d = 1 - Math.max(0, (slope - 0.25) / 0.3)
  d *= Math.min(1, (h - 7) / 4) * Math.min(1, (165 - h) / 20)
  // trampled ground in town and around the nest
  const dt = Math.hypot(x - TOWN.x, z - TOWN.z)
  if (dt < TOWN.radius + 6) d *= Math.abs(x - TOWN.x) < 6 || Math.abs(z - TOWN.z) < 6 || dt < 22 ? 0 : 0.35
  const dn = Math.hypot(x - NEST[0], z - NEST[2])
  if (dn < 5) d *= dn / 5
  return d
}

export function Grass() {
  const quality = useGame((s) => s.settings.quality)
  const rings: readonly { count: number; radius: number }[] = SETTINGS[quality]
  return (
    <>
      {rings.map((cfg, i) => (
        <GrassField key={`${quality}-${i}`} count={cfg.count} radius={cfg.radius} inner={i === 0 ? 0 : rings[0].radius * 0.8} />
      ))}
    </>
  )
}

function GrassField({ count, radius, inner }: { count: number; radius: number; inner: number }) {
  const cfg = { count, radius }
  const mesh = useRef<THREE.Mesh>(null)

  const { geometry, material, uniforms, mapState } = useMemo(() => {
    const geometry = bladeGeometry()
    const count = Math.max(1, cfg.count)
    const offsets = new Float32Array(count * 2)
    const rand = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      offsets[i * 2] = Math.random() * cfg.radius * 2
      offsets[i * 2 + 1] = Math.random() * cfg.radius * 2
      rand.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
    }
    geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 2))
    geometry.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 4))
    geometry.instanceCount = cfg.count

    const data = new Float32Array(MAP_RES * MAP_RES * 4)
    const tex = new THREE.DataTexture(data, MAP_RES, MAP_RES, THREE.RGBAFormat, THREE.FloatType)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true

    const uniforms = {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector2() },
      uRadius: { value: cfg.radius },
      uInner: { value: inner },
      uMap: { value: tex },
      uMapOrigin: { value: new THREE.Vector2(1e6, 1e6) },
      uMapSize: { value: cfg.radius * 2.6 },
      uPusher: { value: new THREE.Vector4(0, -1000, 0, 0) },
    }

    const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85, metalness: 0 })
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute vec2 aOffset;
          attribute vec4 aRand;
          uniform float uTime, uRadius, uMapSize, uInner;
          uniform vec2 uCenter, uMapOrigin;
          uniform vec4 uPusher;
          uniform sampler2D uMap;
          varying float vT;
          varying vec3 vTint;
          varying float vFlower;
          float h1(float n) { return fract(sin(n) * 43758.5453); }
          float vn(vec2 p) {
            vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
            float a = h1(dot(i, vec2(1.0, 57.0))), b = h1(dot(i + vec2(1, 0), vec2(1.0, 57.0)));
            float c = h1(dot(i + vec2(0, 1), vec2(1.0, 57.0))), d = h1(dot(i + vec2(1, 1), vec2(1.0, 57.0)));
            return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
          }`,
        )
        .replace(
          '#include <begin_vertex>',
          `
          // wrap the blade into the square around the player, fixed in world space
          float span = uRadius * 2.0;
          vec2 world = uCenter + mod(aOffset - uCenter, span) - uRadius;
          vec2 muv = (world - uMapOrigin) / uMapSize;
          vec4 cell = texture2D(uMap, muv);
          float dens = cell.g * step(0.0, muv.x) * step(muv.x, 1.0) * step(0.0, muv.y) * step(muv.y, 1.0);
          float dist = length(world - uCenter);
          float edge = (1.0 - smoothstep(uRadius * 0.7, uRadius, dist)) * smoothstep(uInner, uInner + 4.0, dist);
          float alive = step(aRand.w, dens);
          float clump = vn(world * 0.15);
          float height = (0.28 + aRand.x * 0.45 + clump * 0.4) * edge * alive;
          vFlower = step(0.975, aRand.z) * step(0.4, clump);
          height *= mix(1.0, 1.25, vFlower);

          float t = position.y;
          vT = t;
          float ang = aRand.y * 6.2831;
          vec2 dir = vec2(cos(ang), sin(ang));

          // wind: big slow gusts + fast flutter, bending more toward the tip
          float gust = vn(world * 0.04 + vec2(uTime * 0.35, uTime * 0.12));
          float flutter = sin(uTime * 2.8 + aRand.z * 6.28 + world.x * 0.3) * 0.12;
          float bend = (gust * 0.9 + flutter + 0.15 + aRand.x * 0.2) * t * t;
          vec2 windDir = normalize(vec2(1.0, 0.35));

          // pushed aside by the player / a landing dragon
          vec2 away = world - uPusher.xz;
          float pd = length(away);
          float push = (1.0 - smoothstep(uPusher.w * 0.4, uPusher.w, pd)) * step(0.0, uPusher.w) * step(abs(uPusher.y - cell.r), 3.0);
          vec2 pushDir = pd > 0.001 ? away / pd : vec2(0.0);

          vec3 transformed = vec3(0.0);
          vec2 side = vec2(-dir.y, dir.x);
          transformed.xz = side * position.x;
          transformed.y = t * height;
          vec2 lean = windDir * bend * height * 0.9 + pushDir * push * t * height * 1.3;
          transformed.xz += lean;
          transformed.y -= length(lean) * 0.35 * t;
          transformed.xz += world;
          transformed.y += cell.r;

          // colour: lush/dry variation, darker at the root
          vTint = mix(vec3(0.09, 0.2, 0.03), vec3(0.26, 0.36, 0.07), clump * 0.8 + aRand.x * 0.2);
          vTint = mix(vTint, vec3(0.38, 0.34, 0.12), smoothstep(0.65, 0.9, vn(world * 0.02 + 3.0)) * 0.55);
          `,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `vec3 objectNormal = vec3(0.0, 1.0, 0.0);`,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying float vT;
          varying vec3 vTint;
          varying float vFlower;`,
        )
        .replace(
          '#include <map_fragment>',
          `
          vec3 gcol = vTint * mix(0.3, 1.25, vT * vT);
          vec3 flower = mix(vec3(0.95, 0.85, 0.2), vec3(0.85, 0.3, 0.6), fract(vTint.r * 37.0));
          gcol = mix(gcol, flower, vFlower * smoothstep(0.8, 0.95, vT));
          diffuseColor.rgb = gcol;
          `,
        )
        // blades share the ground's up-normal so both faces light alike
        .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);`)
        // soft translucent look: grass is lit a little from behind too
        .replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
          reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.18 * vT;`,
        )
    }
    material.customProgramCacheKey = () => 'grass'
    material.userData.uniforms = uniforms

    return {
      geometry,
      material,
      uniforms,
      mapState: { data, tex, building: false, cx: 1e6, cz: 1e6, row: 0, pending: new Float32Array(MAP_RES * MAP_RES * 4), ox: 0, oz: 0 },
    }
  }, [cfg.count, cfg.radius, inner])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      mapState.tex.dispose()
    },
    [geometry, material, mapState],
  )

  useFrame((_, dt) => {
    if (!cfg.count || !mesh.current) return
    const s = useGame.getState()
    const f = focusPosition()
    const ground = terrainHeight(f.x, f.z)
    // grass is invisible from high up — skip it entirely
    const visible = f.y - ground < 90
    mesh.current.visible = visible
    uniforms.uTime.value += dt
    uniforms.uCenter.value.set(f.x, f.z)
    if (s.mode === 'walking') uniforms.uPusher.value.set(player.position.x, player.position.y, player.position.z, 1.4)
    else uniforms.uPusher.value.set(flight.position.x, flight.position.y - 2.5, flight.position.z, 9)

    // rebuild the height/density map when we drift away from its centre
    const ms = mapState
    const size = uniforms.uMapSize.value
    const step = size / MAP_RES
    const drift = Math.hypot(f.x - ms.cx, f.z - ms.cz)
    let urgent = false
    if (drift > size * 0.42) {
      // teleported (game start, respawn): rebuild right away
      ms.building = true
      urgent = true
      ms.row = 0
      ms.cx = Math.round(f.x / step) * step
      ms.cz = Math.round(f.z / step) * step
      ms.ox = ms.cx - size / 2
      ms.oz = ms.cz - size / 2
    } else if (!ms.building && drift > size * 0.15) {
      ms.building = true
      ms.row = 0
      ms.cx = Math.round(f.x / step) * step
      ms.cz = Math.round(f.z / step) * step
      ms.ox = ms.cx - size / 2
      ms.oz = ms.cz - size / 2
    }
    if (ms.building) {
      const start = performance.now()
      // first build is synchronous so grass appears immediately
      const budget = urgent || uniforms.uMapOrigin.value.x > 1e5 ? 1000 : 3
      while (ms.row < MAP_RES && performance.now() - start < budget) {
        const j = ms.row
        for (let i = 0; i < MAP_RES; i++) {
          const x = ms.ox + (i + 0.5) * step
          const z = ms.oz + (j + 0.5) * step
          const h = terrainHeight(x, z)
          const hx = terrainHeight(x + step, z)
          const hz = terrainHeight(x, z + step)
          const k = (j * MAP_RES + i) * 4
          ms.pending[k] = h
          ms.pending[k + 1] = density(x, z, h, hx, hz, step)
        }
        ms.row++
      }
      if (ms.row >= MAP_RES) {
        ms.data.set(ms.pending)
        ms.tex.needsUpdate = true
        uniforms.uMapOrigin.value.set(ms.ox, ms.oz)
        ms.building = false
      }
    }
  })

  if (!cfg.count) return null
  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} receiveShadow />
}
