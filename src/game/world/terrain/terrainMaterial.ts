import * as THREE from 'three'
import type { Quality } from '../../../store/gameStore'

/**
 * PBR terrain material: moss/grass on flat ground, forest soil on gentle
 * slopes and in patches, lichen rock on cliffs (triplanar), sand at the
 * shore and snow on the peaks. Built on MeshStandardMaterial so it gets
 * three.js lighting, shadows, fog and IBL for free.
 *
 * Every texture is a CC0 scan (Poly Haven / ambientCG), see CREDITS.md.
 * `*-orh` textures pack AO (R), roughness (G) and height (B).
 */

const loader = new THREE.TextureLoader()
const cache = new Map<string, THREE.Texture>()

function tex(url: string, srgb: boolean, anisotropy: number) {
  const key = `${url}|${anisotropy}`
  const hit = cache.get(key)
  if (hit) return hit
  const t = loader.load(url)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = anisotropy
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  cache.set(key, t)
  return t
}

const base = import.meta.env.BASE_URL + 'textures/'

export function createTerrainMaterial(quality: Quality, maxAnisotropy: number) {
  const aniso = quality === 'high' ? Math.min(8, maxAnisotropy) : quality === 'medium' ? Math.min(4, maxAnisotropy) : 1
  const uniforms = {
    tMossC: { value: tex(base + 'moss-color.jpg', true, aniso) },
    tMossN: { value: tex(base + 'moss-normal.jpg', false, aniso) },
    tMossS: { value: tex(base + 'moss-orh.webp', false, aniso) },
    tSoilC: { value: tex(base + 'soil-color.jpg', true, aniso) },
    tSoilN: { value: tex(base + 'soil-normal.jpg', false, aniso) },
    tSoilS: { value: tex(base + 'soil-orh.webp', false, aniso) },
    tRockC: { value: tex(base + 'rock-color.jpg', true, aniso) },
    tRockN: { value: tex(base + 'rock-normal.jpg', false, aniso) },
    tRockS: { value: tex(base + 'rock-orh.webp', false, aniso) },
    uSnowLine: { value: 240 },
  }

  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, envMapIntensity: 0.6 })
  mat.defines = { TRIPLANAR: quality === 'low' ? 0 : 1, DETAIL: quality === 'high' ? 1 : 0 }

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNormal;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNormal;
        uniform sampler2D tMossC, tMossN, tMossS, tSoilC, tSoilN, tSoilS, tRockC, tRockN, tRockS;
        uniform float uSnowLine;

        float hash12(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm2(vec2 p) {
          return vnoise(p) * 0.55 + vnoise(p * 2.07) * 0.28 + vnoise(p * 4.13) * 0.17;
        }

        // planar sample on XZ, two scales blended by noise to hide tiling
        struct Layer { vec3 c; vec3 n; vec3 s; };
        Layer samplePlanar(sampler2D tc, sampler2D tn, sampler2D ts, vec2 uv, float mixK) {
          Layer a, b;
          vec2 uv2 = uv * 0.37 + vec2(0.31, 0.77);
          a.c = texture2D(tc, uv).rgb;  a.n = texture2D(tn, uv).xyz * 2.0 - 1.0;  a.s = texture2D(ts, uv).rgb;
          #if DETAIL
          b.c = texture2D(tc, uv2).rgb; b.n = texture2D(tn, uv2).xyz * 2.0 - 1.0; b.s = texture2D(ts, uv2).rgb;
          a.c = mix(a.c, b.c, mixK); a.n = mix(a.n, b.n, mixK); a.s = mix(a.s, b.s, mixK);
          #endif
          return a;
        }

        // Ben Golus' whiteout triplanar for the rock
        Layer sampleTriplanar(vec3 p, vec3 N, float scale) {
          Layer r;
          #if TRIPLANAR
          vec3 w = pow(abs(N), vec3(4.0));
          w /= (w.x + w.y + w.z);
          vec2 uvX = p.zy * scale, uvY = p.xz * scale, uvZ = p.xy * scale;
          vec3 tnX = texture2D(tRockN, uvX).xyz * 2.0 - 1.0;
          vec3 tnY = texture2D(tRockN, uvY).xyz * 2.0 - 1.0;
          vec3 tnZ = texture2D(tRockN, uvZ).xyz * 2.0 - 1.0;
          tnX = vec3(tnX.xy + N.zy, abs(tnX.z) * N.x);
          tnY = vec3(tnY.xy + N.xz, abs(tnY.z) * N.y);
          tnZ = vec3(tnZ.xy + N.xy, abs(tnZ.z) * N.z);
          r.n = normalize(tnX.zyx * w.x + tnY.xzy * w.y + tnZ.xyz * w.z);
          r.c = texture2D(tRockC, uvX).rgb * w.x + texture2D(tRockC, uvY).rgb * w.y + texture2D(tRockC, uvZ).rgb * w.z;
          r.s = texture2D(tRockS, uvX).rgb * w.x + texture2D(tRockS, uvY).rgb * w.y + texture2D(tRockS, uvZ).rgb * w.z;
          #else
          vec2 uv = p.xz * scale;
          vec3 tn = texture2D(tRockN, uv).xyz * 2.0 - 1.0;
          r.n = normalize(N + vec3(tn.x, 0.0, tn.y));
          r.c = texture2D(tRockC, uv).rgb;
          r.s = texture2D(tRockS, uv).rgb;
          #endif
          return r;
        }

        vec3 planarNormal(vec3 N, vec3 tn, float strength) {
          return normalize(N + vec3(tn.x, 0.0, tn.y) * strength);
        }

        // height-aware blend: the taller material wins at the border
        float hblend(float w, float hA, float hB) {
          return smoothstep(0.0, 1.0, clamp(w + (hB - hA) * 0.6 * (1.0 - abs(w * 2.0 - 1.0)), 0.0, 1.0));
        }

        vec3 gTerrainNormal;
        float gTerrainRough;
        float gTerrainAO;`,
      )
      .replace(
        '#include <map_fragment>',
        `
        vec3 N = normalize(vWNormal);
        float slope = 1.0 - N.y;
        float h = vWPos.y;
        vec2 wp = vWPos.xz;
        float macro = fbm2(wp * 0.012);
        float macro2 = fbm2(wp * 0.047 + 13.0);
        float tileMix = smoothstep(0.35, 0.65, fbm2(wp * 0.02 + 7.0));

        Layer moss = samplePlanar(tMossC, tMossN, tMossS, wp * 0.24, tileMix);
        Layer soil = samplePlanar(tSoilC, tSoilN, tSoilS, wp * 0.2, tileMix);
        Layer rock = sampleTriplanar(vWPos, N, 0.07);
        #if DETAIL
        // a second, much larger projection breaks up the repetition on big cliffs
        Layer rockBig = sampleTriplanar(vWPos + vec3(37.0, 11.0, 53.0), N, 0.018);
        float rk = smoothstep(0.3, 0.7, fbm2(vWPos.xz * 0.008 + vWPos.y * 0.01));
        rock.c = mix(rock.c, rockBig.c, rk * 0.7);
        rock.n = normalize(mix(rock.n, rockBig.n, rk * 0.5));
        rock.s = mix(rock.s, rockBig.s, rk * 0.6);
        #endif

        // grass colour varies across meadows (dry/lush patches)
        float mossL = dot(moss.c, vec3(0.333));
        moss.c = mix(vec3(mossL), moss.c, 1.25);
        moss.c = pow(moss.c, vec3(1.2)) * vec3(0.42, 0.56, 0.26);
        moss.c *= mix(vec3(0.8, 0.96, 0.7), vec3(1.1, 1.05, 0.85), macro);
        moss.c = mix(moss.c, moss.c * vec3(1.1, 0.95, 0.6), smoothstep(0.55, 0.85, macro2) * 0.45);
        // brighten the dark lichen rock into a mountain grey
        rock.c = mix(rock.c, vec3(dot(rock.c, vec3(0.333))), 0.6) * 1.35 * vec3(1.0, 0.96, 0.9) + vec3(0.025, 0.022, 0.018);
        rock.c *= mix(0.75, 1.15, macro);
        float strata = sin(vWPos.y * 0.35 + fbm2(vWPos.xz * 0.01) * 6.0) * 0.5 + 0.5;
        rock.c *= mix(vec3(0.92, 0.88, 0.82), vec3(1.06, 1.04, 1.0), strata);

        // --- weights ---
        float soilW = smoothstep(0.18, 0.34, slope) + smoothstep(0.68, 0.85, macro2) * 0.75;
        // alpine: grass thins out into scree above the tree line
        soilW += smoothstep(120.0, 175.0, h + macro * 25.0);
        soilW = clamp(soilW, 0.0, 1.0);
        float rockW = smoothstep(0.36, 0.52, slope + (macro - 0.5) * 0.12) + smoothstep(160.0, 210.0, h + macro * 30.0) * 0.6;
        rockW = clamp(rockW, 0.0, 1.0);
        float sandW = (1.0 - smoothstep(4.0, 10.0, h + macro * 4.0)) * (1.0 - rockW);
        float snowW = smoothstep(uSnowLine - 15.0, uSnowLine + 20.0, h + macro * 30.0) * (1.0 - smoothstep(0.35, 0.55, slope));

        // moss → soil
        float k1 = hblend(soilW, moss.s.b, soil.s.b);
        vec3 col = mix(moss.c, soil.c, k1);
        vec3 tnm = mix(moss.n, soil.n, k1);
        vec3 orh = mix(moss.s, soil.s, k1);
        vec3 nrm = planarNormal(N, tnm, 1.7);

        // sand at the shore
        vec3 sandC = soil.c * vec3(1.35, 1.22, 0.98) + vec3(0.12, 0.1, 0.06);
        col = mix(col, sandC, sandW);
        orh.g = mix(orh.g, 0.92, sandW);

        // → rock
        float k2 = hblend(rockW, orh.b, rock.s.b);
        col = mix(col, rock.c, k2);
        nrm = normalize(mix(nrm, rock.n, k2));
        orh = mix(orh, rock.s, k2);

        // → snow (rests on top, keeps a hint of the rock relief)
        col = mix(col, vec3(0.8, 0.83, 0.88), snowW);
        nrm = normalize(mix(nrm, normalize(N + (nrm - N) * 0.35), snowW));
        orh.g = mix(orh.g, 0.55, snowW);

        // wet darkening right at the waterline
        float wet = 1.0 - smoothstep(0.0, 1.6, h);
        col *= 1.0 - wet * 0.45;
        orh.g = mix(orh.g, 0.25, wet);

        // fade fine detail with distance to kill shimmer
        float dist = length(vWPos - cameraPosition);
        float detailFade = smoothstep(260.0, 900.0, dist);
        nrm = normalize(mix(nrm, N, detailFade * 0.8));

        gTerrainNormal = nrm;
        gTerrainRough = orh.g;
        gTerrainAO = mix(orh.r, 1.0, detailFade);
        diffuseColor.rgb *= col;
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = clamp(gTerrainRough * 1.05, 0.3, 1.0);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `normal = normalize((viewMatrix * vec4(gTerrainNormal, 0.0)).xyz);`,
      )
      .replace(
        '#include <aomap_fragment>',
        `
        float ambientOcclusion = gTerrainAO;
        reflectedLight.indirectDiffuse *= ambientOcclusion;
        reflectedLight.indirectSpecular *= ambientOcclusion;
        `,
      )
  }
  mat.customProgramCacheKey = () => `terrain-${quality}`
  return mat
}
