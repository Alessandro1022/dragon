import { useEffect, useRef, useState } from 'react'
import { terrainHeight, ISLAND_RADIUS } from '../game/world/terrainHeight'
import { NEST, WILD_EGG_SPOTS, TOWN, CAMP } from '../game/world/worldSpots'
import { missionTarget } from '../game/missionTarget'
import { guardDots } from '../game/npc/Guards'
import * as THREE from 'three'
import { COURSE } from '../game/world/Rings'
import { flight } from '../game/dragon/flightState'
import { player } from '../game/player/playerState'
import { useGame } from '../store/gameStore'
import { clockLabel, daylight } from '../game/world/time'

const RES = 140
const mt = new THREE.Vector3()
const EXTENT = ISLAND_RADIUS * 1.25 // world units from centre to map edge

function colorFor(h: number) {
  if (h < -12) return [22, 70, 96]
  if (h < 0) return [36, 104, 128]
  if (h < 9) return [214, 196, 146]
  if (h < 150) {
    const k = Math.min(1, (h - 9) / 140)
    return [79 - 30 * k, 138 - 40 * k, 60 - 8 * k]
  }
  if (h < 230) return [138, 128, 118]
  return [236, 238, 242]
}

let terrainImage: HTMLCanvasElement | null = null
function getTerrainImage() {
  if (terrainImage) return terrainImage
  const c = document.createElement('canvas')
  c.width = RES
  c.height = RES
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(RES, RES)
  for (let y = 0; y < RES; y++) {
    for (let x = 0; x < RES; x++) {
      const wx = (x / RES - 0.5) * 2 * EXTENT
      const wz = (y / RES - 0.5) * 2 * EXTENT
      const h = terrainHeight(wx, wz)
      // cheap hillshade from the east-west slope
      const shade = 1 + (terrainHeight(wx - 12, wz) - h) * 0.012
      const [r, g, b] = colorFor(h)
      const i = (y * RES + x) * 4
      img.data[i] = Math.min(255, r * shade)
      img.data[i + 1] = Math.min(255, g * shade)
      img.data[i + 2] = Math.min(255, b * shade)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  terrainImage = c
  return c
}

/** Circular north-up minimap with the nest, wild eggs, next ring and you. */
export function Minimap() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [clock, setClock] = useState(clockLabel())
  const [night, setNight] = useState(false)

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const base = getTerrainImage()
    const size = cv.width
    const toMap = (x: number, z: number): [number, number] => [((x / EXTENT) * 0.5 + 0.5) * size, ((z / EXTENT) * 0.5 + 0.5) * size]
    let frame = 0
    let raf = 0

    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (frame++ % 6) return // ~10 Hz is plenty
      const s = useGame.getState()
      const t = performance.now() / 1000
      ctx.clearRect(0, 0, size, size)
      ctx.save()
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(base, 0, 0, size, size)
      ctx.fillStyle = `rgba(10,14,30,${(1 - daylight()) * 0.45})`
      ctx.fillRect(0, 0, size, size)

      // wild eggs
      WILD_EGG_SPOTS.forEach((p, i) => {
        if (s.foundWildEggs.includes(i)) return
        const [x, y] = toMap(p[0], p[2])
        ctx.fillStyle = '#ffd166'
        ctx.globalAlpha = 0.5 + Math.sin(t * 3 + i) * 0.4
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.beginPath()
        ctx.ellipse(x, y, 2.6, 3.4, 0, 0, Math.PI * 2)
        ctx.fill()
      })

      // town & camp
      const [tx, ty] = toMap(TOWN.x, TOWN.z)
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(tx, ty, (TOWN.radius / EXTENT) * size * 0.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#e5e7eb'
      ctx.fillRect(tx - 3, ty - 2, 6, 5)
      ctx.beginPath()
      ctx.moveTo(tx - 4, ty - 2)
      ctx.lineTo(tx, ty - 6)
      ctx.lineTo(tx + 4, ty - 2)
      ctx.fill()
      const [cx, cy] = toMap(CAMP.x, CAMP.z)
      ctx.fillStyle = '#b45309'
      ctx.beginPath()
      ctx.moveTo(cx, cy - 5)
      ctx.lineTo(cx + 5, cy + 4)
      ctx.lineTo(cx - 5, cy + 4)
      ctx.fill()

      // mission objective
      if (missionTarget(mt)) {
        const [mx, my] = toMap(mt.x, mt.z)
        ctx.save()
        ctx.translate(mx, my)
        ctx.rotate(Math.PI / 4)
        ctx.fillStyle = '#67e8f9'
        ctx.shadowColor = '#67e8f9'
        ctx.shadowBlur = 8
        ctx.fillRect(-4, -4, 8, 8)
        ctx.restore()
      }

      // Dragon Guard
      ctx.fillStyle = '#ef4444'
      for (const g of guardDots) {
        const [gx, gy] = toMap(g.x, g.z)
        ctx.beginPath()
        ctx.arc(gx, gy, 3.2, 0, Math.PI * 2)
        ctx.fill()
      }

      // next ring while flying
      if (s.mode === 'flying') {
        const next = COURSE[s.collected.length]
        if (next) {
          const [x, y] = toMap(next.position[0], next.position[2])
          ctx.strokeStyle = '#f5c046'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // nest
      const [nx, ny] = toMap(NEST[0], NEST[2])
      ctx.fillStyle = s.hatchReady ? '#f5b041' : '#fef3c7'
      ctx.strokeStyle = '#0b0f1a'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(nx, ny, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // parked dragon
      if (s.mode === 'walking') {
        const [dx, dy] = toMap(flight.position.x, flight.position.z)
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(dx, dy, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // you
      const me = s.mode === 'flying' ? flight : player
      const [px, py] = toMap(me.position.x, me.position.z)
      ctx.translate(px, py)
      ctx.rotate(-me.yaw)
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#0b0f1a'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, -7)
      ctx.lineTo(5, 5)
      ctx.lineTo(0, 2.5)
      ctx.lineTo(-5, 5)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()

      if (frame % 60 === 1) {
        setClock(clockLabel())
        setNight(daylight() < 0.3)
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="pointer-events-none flex flex-col items-center gap-1">
      <div className="rounded-full p-1 glass">
        <canvas ref={canvas} width={160} height={160} className="block h-24 w-24 rounded-full sm:h-36 sm:w-36" />
      </div>
      <span className="glass rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/75">
        {night ? '☾' : '☀'} {clock}
      </span>
    </div>
  )
}
