import { useMemo } from 'react'
import * as THREE from 'three'
import { terrainHeight, WORLD_SIZE } from './terrainHeight'

const SEGMENTS = 220

const SAND = new THREE.Color('#d9c38f')
const GRASS = new THREE.Color('#4f8a3c')
const DARK_GRASS = new THREE.Color('#2f6b35')
const ROCK = new THREE.Color('#8a8076')
const SNOW = new THREE.Color('#f2f4f7')
const SEABED = new THREE.Color('#2b5d6b')

function colorFor(h: number, slope: number, out: THREE.Color) {
  if (h < 2) return out.copy(SEABED).lerp(SAND, THREE.MathUtils.clamp((h + 20) / 22, 0, 1))
  if (h < 9) return out.copy(SAND)
  if (slope > 0.55 || h > 150) {
    if (h > 230) return out.copy(ROCK).lerp(SNOW, THREE.MathUtils.clamp((h - 230) / 40, 0, 1))
    return out.copy(ROCK)
  }
  return out.copy(GRASS).lerp(DARK_GRASS, THREE.MathUtils.clamp((h - 20) / 110, 0, 1))
}

export function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)))
    }
    // Flat-shaded low-poly look: one colour per face.
    const flat = geo.toNonIndexed()
    flat.computeVertexNormals()
    const p = flat.attributes.position as THREE.BufferAttribute
    const n = flat.attributes.normal as THREE.BufferAttribute
    const colors = new Float32Array(p.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < p.count; i += 3) {
      const h = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3
      const slope = 1 - n.getY(i)
      colorFor(h, slope, c)
      // tiny per-face variation keeps large areas alive
      const v = 0.94 + Math.random() * 0.1
      for (let k = 0; k < 3; k++) {
        colors[(i + k) * 3] = c.r * v
        colors[(i + k) * 3 + 1] = c.g * v
        colors[(i + k) * 3 + 2] = c.b * v
      }
    }
    flat.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.dispose()
    return flat
  }, [])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
    </mesh>
  )
}
