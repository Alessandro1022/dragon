import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { terrainHeight, WATER_LEVEL } from './terrainHeight'
import { focusPosition } from '../focus'
import { useGame } from '../../store/gameStore'

/**
 * Ocean: physically-based reflective surface (sky reflections come from the
 * environment map), two scrolling normal maps for ripples, colour that goes
 * from turquoise shallows to deep blue using a baked depth map of the
 * seabed, soft transparency at the shore and animated foam lines.
 */

const DEPTH_RES = 256
const DEPTH_SIZE = 4000

function bakeDepthMap() {
  const data = new Float32Array(DEPTH_RES * DEPTH_RES * 4)
  for (let j = 0; j < DEPTH_RES; j++) {
    for (let i = 0; i < DEPTH_RES; i++) {
      const x = (i / (DEPTH_RES - 1) - 0.5) * DEPTH_SIZE
      const z = (j / (DEPTH_RES - 1) - 0.5) * DEPTH_SIZE
      data[(j * DEPTH_RES + i) * 4] = WATER_LEVEL - terrainHeight(x, z)
    }
  }
  const tex = new THREE.DataTexture(data, DEPTH_RES, DEPTH_RES, THREE.RGBAFormat, THREE.FloatType)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

export function Water() {
  const quality = useGame((s) => s.settings.quality)
  const { material, uniforms, geometry } = useMemo(() => {
    const normals = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'textures/waternormals.jpg')
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping
    normals.colorSpace = THREE.NoColorSpace
    normals.anisotropy = 4

    const uniforms = {
      uTime: { value: 0 },
      uNormals: { value: normals },
      uDepth: { value: bakeDepthMap() },
      uDepthSize: { value: DEPTH_SIZE },
    }
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      envMapIntensity: 1.6,
    })
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec3 wp0 = (modelMatrix * vec4(transformed, 1.0)).xyz;
          // long, gentle swell
          transformed.z += sin(wp0.x * 0.018 + uTime * 0.7) * 0.35 + cos(wp0.z * 0.023 + uTime * 0.55) * 0.3;`,
        )
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWPos;
          uniform float uTime, uDepthSize;
          uniform sampler2D uNormals, uDepth;
          vec3 gWaterN;
          float gFoam;`,
        )
        .replace(
          '#include <map_fragment>',
          `
          vec2 wp = vWPos.xz;
          vec2 duv = wp / uDepthSize + 0.5;
          float depth = texture2D(uDepth, duv).r;
          // outside the baked area it's all deep sea
          if (duv.x < 0.0 || duv.x > 1.0 || duv.y < 0.0 || duv.y > 1.0) depth = 60.0;

          vec3 n1 = texture2D(uNormals, wp * 0.012 + vec2(uTime * 0.012, uTime * 0.008)).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(uNormals, wp * 0.041 - vec2(uTime * 0.018, -uTime * 0.011)).xyz * 2.0 - 1.0;
          vec3 n3 = texture2D(uNormals, wp * 0.0025 + vec2(uTime * 0.004, 0.0)).xyz * 2.0 - 1.0;
          vec2 slope = n1.xy * 0.55 + n2.xy * 0.35 + n3.xy * 0.6;
          float dist = length(vWPos - cameraPosition);
          slope *= mix(1.0, 0.35, smoothstep(150.0, 1500.0, dist));
          gWaterN = normalize(vec3(slope.x, 1.0, slope.y));

          vec3 shallow = vec3(0.1, 0.45, 0.42);
          vec3 mid = vec3(0.02, 0.18, 0.24);
          vec3 deep = vec3(0.004, 0.035, 0.07);
          vec3 wcol = mix(shallow, mid, smoothstep(0.0, 6.0, depth));
          wcol = mix(wcol, deep, smoothstep(6.0, 35.0, depth));

          // foam: a wobbling band hugging the shoreline, broken up by noise
          float band = 1.0 - smoothstep(0.0, 1.6, depth + sin(uTime * 1.3 + wp.x * 0.08 + wp.y * 0.05) * 0.35);
          float breakup = texture2D(uNormals, wp * 0.09 + uTime * 0.02).b;
          gFoam = clamp(band * smoothstep(0.35, 0.75, breakup + band * 0.4), 0.0, 1.0) * step(-0.5, depth);
          wcol = mix(wcol, vec3(0.92, 0.96, 0.97), gFoam);

          diffuseColor.rgb = wcol;
          diffuseColor.a = mix(0.45, 0.97, smoothstep(0.0, 4.0, depth));
          diffuseColor.a = max(diffuseColor.a, gFoam);
          `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `float roughnessFactor = mix(0.04, 0.6, gFoam) + smoothstep(400.0, 2500.0, length(vWPos - cameraPosition)) * 0.12;`,
        )
        .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(gWaterN, 0.0)).xyz);`)
    }
    material.customProgramCacheKey = () => 'ocean'
    const geometry = new THREE.PlaneGeometry(12000, 12000, 160, 160)
    return { material, uniforms, geometry }
  }, [])

  useEffect(
    () => () => {
      material.dispose()
      geometry.dispose()
      uniforms.uDepth.value.dispose()
    },
    [material, geometry, uniforms],
  )

  useFrame((_, dt) => {
    uniforms.uTime.value += dt
  })

  // the plane follows the camera in big steps so it never ends
  const ref = useMemo(() => ({ mesh: null as THREE.Mesh | null }), [])
  useFrame(() => {
    if (!ref.mesh) return
    const f = focusPosition()
    ref.mesh.position.set(Math.round(f.x / 500) * 500, WATER_LEVEL, Math.round(f.z / 500) * 500)
  })

  return (
    <mesh
      ref={(m) => {
        ref.mesh = m
      }}
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow={quality !== 'low'}
      renderOrder={1}
    />
  )
}
