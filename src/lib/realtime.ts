import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useGame, selectActive } from '../store/gameStore'
import { flight } from '../game/dragon/flightState'
import { player } from '../game/player/playerState'
import { lookFor } from '../game/dragon/look'
import type { DragonLook } from '../game/dragon/DragonModel'

/**
 * Shared sky: every signed-in rider joins one Realtime channel, broadcasts
 * their pose ~8 times a second and announces their dragon's look via
 * presence. Remote riders are interpolated client-side.
 */

export interface RemoteRider {
  id: string
  name: string
  look: DragonLook | null
  /** latest received pose */
  target: Pose
  /** smoothed pose used for rendering */
  pose: Pose
  lastSeen: number
}

export interface Pose {
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  bank: number
  mode: 'walking' | 'flying'
  firing: boolean
  /** on-foot rider position (dragon parked elsewhere) */
  px: number
  py: number
  pz: number
  pyaw: number
}

export const remoteRiders = new Map<string, RemoteRider>()

let channel: RealtimeChannel | null = null
let sendTimer: number | null = null
const SEND_HZ = 8

export function joinWorld() {
  const s = useGame.getState()
  if (!supabase || !s.account?.username || channel) return
  const me = s.account.userId

  channel = supabase.channel('world-1', { config: { broadcast: { self: false }, presence: { key: me } } })

  channel.on('broadcast', { event: 'pose' }, ({ payload }) => {
    const { id, ...pose } = payload as Pose & { id: string }
    const r = remoteRiders.get(id)
    if (r) {
      r.target = pose
      r.lastSeen = performance.now()
    } else {
      remoteRiders.set(id, { id, name: '…', look: null, target: pose, pose: { ...pose }, lastSeen: performance.now() })
    }
  })

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel!.presenceState<{ name: string; look: DragonLook }>()
    for (const [id, metas] of Object.entries(state)) {
      if (id === me) continue
      const meta = metas[0]
      const r = remoteRiders.get(id)
      if (r) {
        r.name = meta.name
        r.look = meta.look
      }
    }
    for (const id of remoteRiders.keys()) if (!state[id]) remoteRiders.delete(id)
    useGame.setState({ ridersOnline: Object.keys(state).length })
  })

  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return
    void announce()
    sendTimer = window.setInterval(sendPose, 1000 / SEND_HZ)
  })

  // re-announce when the ridden dragon changes
  let lastActive = s.activeDragonId
  useGame.subscribe((st) => {
    if (st.activeDragonId !== lastActive) {
      lastActive = st.activeDragonId
      void announce()
    }
  })
}

async function announce() {
  const s = useGame.getState()
  const active = selectActive(s)
  if (!channel || !s.account?.username) return
  await channel.track({ name: s.account.username, look: active ? lookFor(active) : null })
}

function sendPose() {
  const s = useGame.getState()
  if (!channel || !s.account || s.phase !== 'playing') return
  const r = (n: number) => Math.round(n * 100) / 100
  void channel.send({
    type: 'broadcast',
    event: 'pose',
    payload: {
      id: s.account.userId,
      x: r(flight.position.x),
      y: r(flight.position.y),
      z: r(flight.position.z),
      yaw: r(flight.yaw),
      pitch: r(flight.pitch),
      bank: r(flight.bank),
      mode: s.mode,
      firing: flight.firing,
      px: r(player.position.x),
      py: r(player.position.y),
      pz: r(player.position.z),
      pyaw: r(player.yaw),
    },
  })
}

export function leaveWorld() {
  if (sendTimer !== null) window.clearInterval(sendTimer)
  sendTimer = null
  if (channel && supabase) void supabase.removeChannel(channel)
  channel = null
  remoteRiders.clear()
  useGame.setState({ ridersOnline: 0 })
}
