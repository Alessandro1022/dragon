import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DragonModel, type DragonAnim, type DragonLook } from '../dragon/DragonModel'
import { RiderModel, GUARD_COLORS, type RiderAnim } from '../player/RiderModel'
import { flight, parkAt } from '../dragon/flightState'
import { player } from '../player/playerState'
import { GUARD_TOWER, HATCHERY, DRAGON_SPAWN, PLAYER_SPAWN, NEST } from '../world/worldSpots'
import { surfaceHeight } from '../world/terrainHeight'
import { registerTarget, type Target } from '../combat'
import { heat, raiseHeat, clearHeat, COOL_SECONDS, CATCH_SECONDS, SIGHT_RANGE } from '../heat'
import { useGame } from '../../store/gameStore'
import { emit } from '../effects/particles'

const MAX_GUARDS = 5
const HP = 100
const CATCH_RANGE = 17

const GUARD_LOOK: DragonLook = {
  palette: {
    body: '#4b5f7a',
    back: '#28364b',
    belly: '#c9b37e',
    membrane: '#2f4f86',
    horn: '#e5e7eb',
    eye: '#93c5fd',
    fire: ['#93c5fd', '#eff6ff'],
    glow: false,
  },
  wingspan: 1,
  hornLength: 1.1,
  twinHorns: false,
}

type GuardState = 'off' | 'chase' | 'return' | 'down'

interface Guard {
  index: number
  state: GuardState
  pos: THREE.Vector3
  vel: THREE.Vector3
  yaw: number
  bank: number
  respawnAt: number
  downAt: number
  provoked: boolean
  target: Target
}

/** live positions of airborne guards, read by the minimap */
export const guardDots: THREE.Vector3[] = []

const towerTop = new THREE.Vector3(GUARD_TOWER[0], GUARD_TOWER[1] + 34, GUARD_TOWER[2])
const hatcheryEggs = new THREE.Vector3(HATCHERY[0], HATCHERY[1] + 2, HATCHERY[2] + 3)
const tmp = new THREE.Vector3()
const desired = new THREE.Vector3()
const quarry = new THREE.Vector3()

/** Send the player home after an arrest. */
function arrest() {
  clearHeat()
  useGame.getState().busted()
  const yaw = Math.atan2(-(NEST[0] - DRAGON_SPAWN[0]), -(NEST[2] - DRAGON_SPAWN[2]))
  parkAt(DRAGON_SPAWN[0], DRAGON_SPAWN[1], DRAGON_SPAWN[2], yaw)
  player.position.set(...PLAYER_SPAWN)
  player.vy = 0
  useGame.getState().setMode('walking')
}

/**
 * The Dragon Guard. One rider per star of heat launches from the tower and
 * hunts you; stay inside their reach for a few seconds and you're arrested.
 * They can be driven off with fire — at the price of more heat.
 */
export function Guards() {
  const guards = useMemo<Guard[]>(
    () =>
      Array.from({ length: MAX_GUARDS }, (_, index) => {
        const g: Guard = {
          index,
          state: 'off',
          pos: towerTop.clone(),
          vel: new THREE.Vector3(),
          yaw: 0,
          bank: 0,
          respawnAt: 0,
          downAt: 0,
          provoked: false,
          target: null as unknown as Target,
        }
        g.target = {
          id: `guard-${index}`,
          kind: 'guard',
          position: g.pos,
          radius: 4.5,
          hp: HP,
          maxHp: HP,
          alive: false,
          burning: 99,
          onHit: () => {
            if (!g.provoked) {
              g.provoked = true
              raiseHeat(1, 'Du attackerar Drakgardet!')
            }
          },
          onDestroyed: () => {
            g.state = 'down'
            g.downAt = performance.now() / 1000
            useGame.getState().bump('guardsDowned')
            useGame.getState().toast('En vaktryttare föll!', 'gold')
          },
        }
        return g
      }),
    [],
  )

  useEffect(() => {
    const offs = guards.map((g) => registerTarget(g.target))
    return () => offs.forEach((off) => off())
  }, [guards])

  const groups = useRef<(THREE.Group | null)[]>([])
  const bars = useRef<(THREE.Mesh | null)[]>([])
  const anims = useMemo(
    () => guards.map((): DragonAnim => ({ mode: 'fly', flapping: true, boosting: false, pitch: 0, bank: 0, look: 0 })),
    [guards],
  )
  const riderAnim = useRef<RiderAnim>({ speed: 0, grounded: false, seated: true }).current

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const now = clock.elapsedTime
    const s = useGame.getState()
    if (s.phase !== 'playing') return

    // --- crime: the royal hatchery ---
    if (s.royalEggDay !== s.day) {
      const thief = s.mode === 'walking' ? player.position : flight.position
      if (thief.distanceTo(hatcheryEggs) < (s.mode === 'walking' ? 5 : 13)) {
        s.stealRoyalEgg()
        heat.heist = true
        raiseHeat(3, 'Kungligt ägg stulet! Drakgardet jagar dig.')
      }
    }

    if (s.mode === 'flying') quarry.copy(flight.position)
    else quarry.copy(player.position).add(tmp.set(0, 1.5, 0))

    let seen = false
    let close = false
    guards.forEach((g, i) => {
      const wanted = i < heat.level
      if (g.state === 'off' && wanted && now >= g.respawnAt) {
        g.state = 'chase'
        g.pos.copy(towerTop).add(tmp.set((i - 2) * 4, 0, 0))
        g.vel.set(0, 10, 0)
        g.target.hp = HP
        g.target.alive = true
        g.provoked = false
      }
      if (g.state === 'chase' && !wanted) g.state = 'return'

      const speedCap = 52 + heat.level * 9
      if (g.state === 'chase') {
        // circle the quarry, each guard on its own slot
        const a = now * 0.6 + (i / MAX_GUARDS) * Math.PI * 2
        desired.copy(quarry).add(tmp.set(Math.cos(a) * 9, 4 + (i % 2) * 3, Math.sin(a) * 9))
        tmp.subVectors(desired, g.pos)
        const dist = tmp.length()
        const speed = dist > 160 ? speedCap * 1.35 : Math.min(speedCap, dist * 1.6 + 8)
        tmp.normalize().multiplyScalar(speed)
        g.vel.lerp(tmp, 1 - Math.exp(-2.4 * dt))

        const dq = g.pos.distanceTo(quarry)
        if (dq < SIGHT_RANGE) seen = true
        if (dq < CATCH_RANGE) close = true
      } else if (g.state === 'return') {
        tmp.subVectors(towerTop, g.pos)
        if (tmp.length() < 10) {
          g.state = 'off'
          g.target.alive = false
        }
        g.vel.lerp(tmp.normalize().multiplyScalar(45), 1 - Math.exp(-2 * dt))
      } else if (g.state === 'down') {
        g.vel.y -= 30 * dt
        if (Math.random() < dt * 40) emit(g.pos, tmp.set(0, 4, 0), { spread: 4, life: 2.2, size: 5, kind: 1 })
        g.vel.multiplyScalar(1 - 0.5 * dt)
        if (now - g.downAt > 3.2 || g.pos.y < surfaceHeight(g.pos.x, g.pos.z) + 1) {
          g.state = 'off'
          g.target.alive = false
          g.respawnAt = now + 25
        }
      }

      if (g.state !== 'off') {
        g.pos.addScaledVector(g.vel, dt)
        const floor = surfaceHeight(g.pos.x, g.pos.z) + 5
        if (g.state !== 'down' && g.pos.y < floor) g.pos.y = floor
        const hs = Math.hypot(g.vel.x, g.vel.z)
        if (hs > 2) {
          const yaw = Math.atan2(-g.vel.x, -g.vel.z)
          let diff = yaw - g.yaw
          diff = Math.atan2(Math.sin(diff), Math.cos(diff))
          g.yaw += diff * Math.min(1, dt * 4)
          g.bank = THREE.MathUtils.damp(g.bank, -diff * 1.5, 4, dt)
        }
        const an = anims[i]
        an.pitch = THREE.MathUtils.clamp(g.vel.y / 60, -0.6, 0.6)
        an.bank = g.bank
        an.flapping = g.state !== 'down'
      }

      const grp = groups.current[i]
      if (grp) {
        grp.visible = g.state !== 'off'
        grp.position.copy(g.pos)
        const spin = g.state === 'down' ? (now - g.downAt) * 4 : 0
        grp.rotation.set(anims[i].pitch, g.yaw + spin, g.bank + spin * 0.3, 'YXZ')
      }
      const bar = bars.current[i]
      if (bar) {
        bar.scale.x = Math.max(0.001, g.target.hp / HP)
        ;(bar.parent as THREE.Object3D).visible = g.state === 'chase' && g.target.hp < HP
      }
    })

    guardDots.length = 0
    guards.forEach((g) => g.state === 'chase' && guardDots.push(g.pos))

    // --- catching ---
    if (close) heat.catchProgress += dt
    else heat.catchProgress = Math.max(0, heat.catchProgress - dt * 0.6)
    if (heat.level > 0 && heat.catchProgress >= CATCH_SECONDS) {
      arrest()
      guards.forEach((g) => g.state === 'chase' && (g.state = 'return'))
      return
    }

    // --- cooling down when out of sight ---
    if (heat.level > 0) {
      const anyActive = guards.some((g) => g.state === 'chase')
      if (seen || !anyActive) heat.unseen = seen ? 0 : heat.unseen + dt * 0.5
      else heat.unseen += dt
      if (!seen && heat.unseen > COOL_SECONDS) {
        heat.unseen = 0
        heat.level -= 1
        if (heat.level === 0) {
          s.toast('Du skakade av dig Drakgardet.', 'gold')
          if (heat.heist) {
            heat.heist = false
            s.bump('heistEscapes')
          }
        }
      }
    }
    s.setHeat(heat.level, close)
  })

  return (
    <group>
      {guards.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el
          }}
          visible={false}
        >
          <group scale={0.8}>
            <DragonModel look={GUARD_LOOK} anim={anims[i]} />
            <group position={[0, 0.3, -1.35]}>
              <RiderModel anim={riderAnim} colors={GUARD_COLORS} />
            </group>
          </group>
          <Billboard position={[0, 5.5, 0]}>
            <mesh>
              <planeGeometry args={[4.2, 0.45]} />
              <meshBasicMaterial color="#111827" transparent opacity={0.7} />
            </mesh>
            <mesh
              ref={(el) => {
                bars.current[i] = el
              }}
              position={[0, 0, 0.01]}
            >
              <planeGeometry args={[4, 0.3]} />
              <meshBasicMaterial color="#ef4444" toneMapped={false} />
            </mesh>
          </Billboard>
        </group>
      ))}
    </group>
  )
}
