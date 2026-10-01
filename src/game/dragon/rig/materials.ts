import * as THREE from 'three'
import type { DragonPalette } from '../../../systems/genetics'

/**
 * Dragon materials. Scales, belly plates and wing veins are procedural
 * (no textures), so they stay crisp at any distance and recolour freely
 * from the dragon's genes.
 *
 * The body mesh carries `uv` in metres along/around the body and an
 * `aSide` attribute: 0 on the spine, 1 on the belly.
 */

export interface DragonMaterials {
  scales: THREE.MeshPhysicalMaterial
  membrane: THREE.MeshStandardMaterial
  horn: THREE.MeshStandardMaterial
  claw: THREE.MeshStandardMaterial
  eye: THREE.MeshStandardMaterial
  spike: THREE.MeshStandardMaterial
  tooth: THREE.MeshStandardMaterial
  saddle: THREE.MeshStandardMaterial
  /** world-space sun direction, for light shining through the wings */
  sunDir: THREE.Vector3
  setPalette: (p: DragonPalette) => void
  setGlow: (k: number) => void
  dispose: () => void
}

const SCALE_COMMON = /* glsl */ `
  vec2 dhash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }
  // overlapping "fish-scale" cells: returns (distance to cell centre, cell id hash, edge)
  vec3 scaleCells(vec2 uv) {
    vec2 cell = floor(uv);
    // offset every other row so scales interlock
    uv.x += mod(cell.y, 2.0) * 0.5;
    cell = floor(uv);
    vec2 f = fract(uv);
    // scales point backwards along the body: centre sits towards the front edge
    vec2 c = vec2(0.5, 0.35);
    vec2 d = (f - c) * vec2(1.0, 1.25);
    float r = length(d);
    return vec3(r, dhash22(cell).x, smoothstep(0.42, 0.62, r));
  }
`

export function createDragonMaterials(p: DragonPalette): DragonMaterials {
  const uniforms = {
    uBody: { value: new THREE.Color() },
    uBack: { value: new THREE.Color() },
    uBelly: { value: new THREE.Color() },
    uGlowColor: { value: new THREE.Color() },
    uGlow: { value: 0 },
    uScaleSize: { value: 0.19 },
  }

  const scales = new THREE.MeshPhysicalMaterial({
    roughness: 0.48,
    metalness: 0.05,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
    sheen: 0.25,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#ffffff'),
  })
  scales.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSide;\nvarying float vSide;\nvarying vec2 vScaleUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSide = aSide;\nvScaleUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vSide;
        varying vec2 vScaleUv;
        uniform vec3 uBody, uBack, uBelly, uGlowColor;
        uniform float uGlow, uScaleSize;
        ${SCALE_COMMON}
        float gScaleRough;
        vec3 gGlow;`,
      )
      .replace(
        '#include <map_fragment>',
        `
        // --- colour zones: dark dorsal stripe → body → pale belly plates ---
        float side = vSide;
        vec3 col = mix(uBack, uBody, smoothstep(0.08, 0.32, side));
        float bellyK = smoothstep(0.62, 0.78, side);

        // body scales, smaller on the head/tail (uv is in metres)
        vec2 suv = vScaleUv / uScaleSize;
        vec3 sc = scaleCells(vec2(suv.x, suv.y * 0.9));
        float dome = 1.0 - smoothstep(0.0, 0.55, sc.x);
        col *= mix(0.86, 1.06, dome) * mix(0.93, 1.06, sc.y);
        col = mix(col, col * 0.62, sc.z * 0.38);
        // larger mottling so the body isn't uniform
        float mott = sin(vScaleUv.y * 0.9 + sin(vScaleUv.x * 1.3) * 2.0) * 0.5 + 0.5;
        col *= mix(0.9, 1.07, mott);

        // belly: wide horizontal plates
        float plateV = fract(vScaleUv.y / 0.34);
        float plateEdge = smoothstep(0.0, 0.12, plateV) * (1.0 - smoothstep(0.82, 1.0, plateV));
        vec3 belly = uBelly * mix(0.72, 1.05, plateEdge);
        col = mix(col, belly, bellyK);

        gScaleRough = mix(0.42, 0.62, sc.z) + bellyK * 0.12;

        // glowing veins for the 'glöd' trait
        float vein = smoothstep(0.5, 0.62, sc.x) * (1.0 - bellyK);
        gGlow = uGlowColor * vein * uGlow;

        diffuseColor.rgb = col;
        `,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gScaleRough;')
      .replace(
        '#include <normal_fragment_maps>',
        `
        // bump from the scale dome using screen-space derivatives
        {
          vec2 suv2 = vScaleUv / uScaleSize;
          vec3 sc2 = scaleCells(vec2(suv2.x, suv2.y * 0.9));
          float hgt = (1.0 - smoothstep(0.0, 0.55, sc2.x)) * (1.0 - smoothstep(0.62, 0.78, vSide)) * 0.6
                    + (1.0 - smoothstep(0.0, 0.14, fract(vScaleUv.y / 0.34))) * smoothstep(0.62, 0.78, vSide) * 0.5;
          vec3 dpdx = dFdx(-vViewPosition);
          vec3 dpdy = dFdy(-vViewPosition);
          float dhx = dFdx(hgt);
          float dhy = dFdy(hgt);
          vec3 r1 = cross(dpdy, normal);
          vec3 r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          vec3 surfGrad = sign(det) * (dhx * r1 + dhy * r2);
          float fade = 1.0 - smoothstep(25.0, 90.0, length(vViewPosition));
          normal = normalize(abs(det) * normal - surfGrad * 0.018 * fade);
        }
        `,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gGlow;')
  }
  scales.customProgramCacheKey = () => 'dragon-scales'

  const membraneU = {
    uMem: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  }
  const membrane = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, metalness: 0 })
  membrane.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, membraneU)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMemUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMemUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vMemUv;
        uniform vec3 uMem;
        uniform vec3 uSunDir;`,
      )
      .replace(
        '#include <map_fragment>',
        `
        // veins branching across the membrane (uv.x along the span, uv.y across)
        float v1 = abs(sin(vMemUv.y * 14.0 + sin(vMemUv.x * 9.0) * 1.4));
        float v2 = abs(sin(vMemUv.y * 37.0 + vMemUv.x * 6.0 + sin(vMemUv.x * 23.0)));
        float veins = (1.0 - smoothstep(0.0, 0.07, v1)) * 0.6 + (1.0 - smoothstep(0.0, 0.05, v2)) * 0.25;
        vec3 col = uMem * mix(1.0, 0.55, veins);
        col *= mix(0.75, 1.05, vMemUv.x);
        diffuseColor.rgb = col;
        `,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        // light shining through the thin membrane from behind
        vec3 viewDirW = normalize(cameraPosition - vWorldPosMem);
        float through = pow(clamp(dot(-viewDirW, uSunDir), 0.0, 1.0), 3.0);
        reflectedLight.indirectDiffuse += diffuseColor.rgb * (0.25 + through * 2.2) * vec3(1.0, 0.85, 0.7);`,
      )
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosMem;')
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosMem;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPosMem = (modelMatrix * vec4(transformed, 1.0)).xyz;')
  }
  membrane.customProgramCacheKey = () => 'dragon-membrane'

  const horn = new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.05, vertexColors: true })
  const claw = new THREE.MeshStandardMaterial({ color: '#1d1916', roughness: 0.3, metalness: 0.1 })
  const eye = new THREE.MeshStandardMaterial({ roughness: 0.05, metalness: 0, emissiveIntensity: 2.2 })
  const saddle = new THREE.MeshStandardMaterial({ color: '#4a2e1c', roughness: 0.65, metalness: 0.05 })
  const spike = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 })
  const tooth = new THREE.MeshStandardMaterial({ color: '#efe9da', roughness: 0.3 })

  let glowEnabled = p.glow
  const setPalette = (pal: DragonPalette) => {
    glowEnabled = pal.glow
    uniforms.uBody.value.set(pal.body)
    uniforms.uBack.value.set(pal.back)
    uniforms.uBelly.value.set(pal.belly)
    uniforms.uGlowColor.value.set(pal.eye)
    uniforms.uGlow.value = pal.glow ? 1.6 : 0
    membraneU.uMem.value.set(pal.membrane)
    horn.color.set(pal.horn).multiplyScalar(0.78)
    spike.color.set(pal.back).lerp(new THREE.Color(pal.horn), 0.25)
    eye.color.set(pal.eye)
    eye.emissive.set(pal.eye)
  }
  setPalette(p)

  return {
    scales,
    membrane,
    horn,
    claw,
    eye,
    spike,
    tooth,
    saddle,
    sunDir: membraneU.uSunDir.value,
    setPalette,
    setGlow: (k) => {
      uniforms.uGlow.value = glowEnabled ? k : 0
    },
    dispose: () => [scales, membrane, horn, claw, eye, saddle, spike, tooth].forEach((m) => m.dispose()),
  }
}
