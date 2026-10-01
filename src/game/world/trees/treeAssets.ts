import * as THREE from 'three'
import { Tree, TreePreset } from '@dgreenheck/ez-tree'

/**
 * Tree variants generated with EZ-Tree (MIT, textures CC0), each in three
 * levels of detail:
 *   LOD0 – the full procedural tree with wind-blown leaves
 *   LOD1 – the same tree regenerated with fewer sections and leaf cards
 *   LOD2 – an impostor: the tree rendered once to a texture and drawn as a
 *          camera-facing card
 */

export type VariantId = 'pineS' | 'pineM' | 'pineL' | 'oak' | 'aspen' | 'ash' | 'bush1' | 'bush2'

const PRESETS: Record<VariantId, { preset: string; seed: number; scale: number }> = {
  pineS: { preset: 'Pine Small', seed: 101, scale: 0.34 },
  pineM: { preset: 'Pine Medium', seed: 202, scale: 0.32 },
  pineL: { preset: 'Pine Large', seed: 303, scale: 0.3 },
  oak: { preset: 'Oak Medium', seed: 404, scale: 0.27 },
  aspen: { preset: 'Aspen Medium', seed: 505, scale: 0.26 },
  ash: { preset: 'Ash Medium', seed: 606, scale: 0.24 },
  bush1: { preset: 'Bush 1', seed: 707, scale: 0.16 },
  bush2: { preset: 'Bush 2', seed: 808, scale: 0.16 },
}

export const VARIANTS = Object.keys(PRESETS) as VariantId[]

export interface TreeLOD {
  bark: THREE.BufferGeometry
  leaves: THREE.BufferGeometry
}

export interface TreeVariant {
  id: VariantId
  /** world scale applied to the generated tree */
  scale: number
  lod0: TreeLOD
  lod1: TreeLOD
  barkMaterial: THREE.MeshStandardMaterial
  leafMaterial: THREE.MeshStandardMaterial
  impostor: { texture: THREE.Texture; width: number; height: number; bottom: number }
  trunkRadius: number
}

/** Shared wind clock for every leaf material. */
export const windUniforms = { uTime: { value: 0 } }

function cloneOptions<T>(o: T): T {
  return JSON.parse(JSON.stringify(o))
}

function generate(options: object) {
  const t = new Tree()
  t.loadFromJson(options as never)
  t.generate()
  return t
}

/** Leaf cards get normals pointing away from the crown centre: soft, volumetric foliage shading. */
function softenLeafNormals(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  const c = new THREE.Vector3()
  bb.getCenter(c)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const nor = new Float32Array(pos.count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(c)
    v.y *= 0.6
    v.normalize()
    nor.set([v.x, v.y * 0.7 + 0.3, v.z], i * 3)
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  geo.normalizeNormals()
}

function scaleGeometry(geo: THREE.BufferGeometry, s: number) {
  geo.scale(s, s, s)
  geo.computeBoundingSphere()
  geo.computeBoundingBox()
  return geo
}

function makeLeafMaterial(src: THREE.MeshPhongMaterial) {
  const m = new THREE.MeshStandardMaterial({
    map: src.map,
    color: src.color,
    side: THREE.DoubleSide,
    alphaTest: 0.45,
    roughness: 0.75,
    metalness: 0,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 iPos = instanceMatrix[3].xyz;
        #else
          vec3 iPos = vec3(0.0);
        #endif
        float ph = dot(iPos.xz, vec2(0.13, 0.17));
        float sway = transformed.y * transformed.y * 0.0009;
        transformed.x += sin(uTime * 0.9 + ph) * sway * 1.2;
        transformed.z += cos(uTime * 0.7 + ph * 1.3) * sway;
        // individual leaf cards flutter at their tips
        float flutter = sin(uTime * 4.0 + ph * 7.0 + transformed.x * 2.0 + transformed.z * 1.7) * 0.06 * uv.y;
        transformed += vec3(flutter, flutter * 0.4, flutter * 0.7);`,
      )
    // a little translucency: back-lit leaves glow green
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.12;`,
    )
  }
  m.customProgramCacheKey = () => 'ez-leaf'
  return m
}

function makeBarkMaterial(src: THREE.MeshPhongMaterial) {
  const m = new THREE.MeshStandardMaterial({
    map: src.map,
    normalMap: src.normalMap,
    aoMap: src.aoMap,
    roughnessMap: (src as unknown as { roughnessMap?: THREE.Texture }).roughnessMap ?? null,
    color: src.color,
    roughness: 1,
    metalness: 0,
  })
  return m
}

/** Render the tree from the side into a texture for distant impostors. */
function captureImpostor(renderer: THREE.WebGLRenderer, group: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(group)
  const size = new THREE.Vector3()
  box.getSize(size)
  const w = Math.max(size.x, size.z) * 1.05
  const h = size.y * 1.03
  const res = 256
  const rt = new THREE.WebGLRenderTarget(res, Math.round(res * Math.min(2, h / w)), {
    samples: 4,
    colorSpace: THREE.SRGBColorSpace,
  })
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h, 0, 0.1, 1000)
  cam.position.set(0, box.min.y, 500)
  cam.lookAt(0, box.min.y, 0)
  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 1.6))
  const sun = new THREE.DirectionalLight(0xffffff, 1.4)
  sun.position.set(0.4, 1, 0.8)
  scene.add(sun)
  const parent = group.parent
  scene.add(group)
  const prevTarget = renderer.getRenderTarget()
  const prevClear = renderer.getClearAlpha()
  const prevTone = renderer.toneMapping
  renderer.toneMapping = THREE.NoToneMapping
  renderer.setRenderTarget(rt)
  renderer.setClearColor(0x000000, 0)
  renderer.clear()
  renderer.render(scene, cam)
  renderer.setRenderTarget(prevTarget)
  renderer.setClearAlpha(prevClear)
  renderer.toneMapping = prevTone
  scene.remove(group)
  if (parent) parent.add(group)
  rt.texture.generateMipmaps = true
  return { texture: rt.texture, width: w, height: h, bottom: box.min.y }
}

let cache: TreeVariant[] | null = null

export function buildTreeVariants(renderer: THREE.WebGLRenderer): TreeVariant[] {
  if (cache) return cache
  cache = VARIANTS.map((id) => {
    const cfg = PRESETS[id]
    const base = cloneOptions(TreePreset[cfg.preset as keyof typeof TreePreset]) as unknown as {
      seed: number
      branch: { sections: Record<string, number>; segments: Record<string, number>; radius: Record<string, number> }
      leaves: { count: number; size: number }
    }
    base.seed = cfg.seed
    const full = generate(base)

    const lite = cloneOptions(base)
    for (const k of Object.keys(lite.branch.sections)) lite.branch.sections[k] = Math.max(3, Math.round(lite.branch.sections[k] * 0.45))
    for (const k of Object.keys(lite.branch.segments)) lite.branch.segments[k] = Math.max(3, Math.round(lite.branch.segments[k] * 0.6))
    lite.leaves.count = Math.max(4, Math.round(lite.leaves.count * 0.45))
    lite.leaves.size *= 1.45
    const low = generate(lite)

    const barkMaterial = makeBarkMaterial(full.branchesMesh.material as THREE.MeshPhongMaterial)
    const leafMaterial = makeLeafMaterial(full.leavesMesh.material as THREE.MeshPhongMaterial)

    const lod0 = {
      bark: scaleGeometry(full.branchesMesh.geometry.clone(), cfg.scale),
      leaves: scaleGeometry(full.leavesMesh.geometry.clone(), cfg.scale),
    }
    const lod1 = {
      bark: scaleGeometry(low.branchesMesh.geometry.clone(), cfg.scale),
      leaves: scaleGeometry(low.leavesMesh.geometry.clone(), cfg.scale),
    }
    softenLeafNormals(lod0.leaves)
    softenLeafNormals(lod1.leaves)

    // impostor from the full tree with game materials
    const g = new THREE.Group()
    g.add(new THREE.Mesh(lod0.bark, barkMaterial), new THREE.Mesh(lod0.leaves, leafMaterial))
    const impostor = captureImpostor(renderer, g)

    full.branchesMesh.geometry.dispose()
    full.leavesMesh.geometry.dispose()
    low.branchesMesh.geometry.dispose()
    low.leavesMesh.geometry.dispose()

    const trunkRadius = (base.branch.radius['0'] ?? 1) * cfg.scale
    return { id, scale: cfg.scale, lod0, lod1, barkMaterial, leafMaterial, impostor, trunkRadius }
  })
  return cache
}
