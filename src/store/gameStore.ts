import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { FlightTelemetry } from '../types'
import { resetFlight, parkAt } from '../game/dragon/flightState'
import { DRAGON_SPAWN, PLAYER_SPAWN, NEST } from '../game/world/worldSpots'
import { player } from '../game/player/playerState'
import { randomGenome, breed as breedGenomes } from '../systems/genetics'
import {
  createDragon,
  FOOD,
  starterDragon,
  stageOf,
  STAGES,
  TRAIN_LABELS,
  uid,
  view,
  xpGain,
  type DragonData,
  type Egg,
  type FoodKind,
  type TrainStat,
  BREED_COST,
  breedCooldownLeft,
} from '../systems/dragons'
import { safeStorage } from '../lib/storage'
import { initAudio } from '../audio/engine'
import { MISSIONS, missionById, SHOP, type Counter } from '../systems/missions'
import { randomGenome as rollGenome } from '../systems/genetics'

type Phase = 'menu' | 'playing'
export type Mode = 'walking' | 'flying'
export type Panel = null | 'dragons' | 'nest' | 'quest' | 'settings'
export type Quality = 'low' | 'medium' | 'high'

export interface Settings {
  quality: Quality
  /** let the game lower quality automatically when the frame rate drops */
  autoQuality: boolean
  volume: number
  music: boolean
  invertPitch: boolean
}

export interface Prompt {
  label: string
  action: 'mount' | 'dismount' | 'nest' | 'quest'
}

export interface Account {
  userId: string
  email: string | null
  username: string | null
}

export interface ActiveMission {
  id: string
  baseline: number
}

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'gold' | 'warn'
}

interface GameState {
  // session
  phase: Phase
  mode: Mode
  panel: Panel
  selectedDragonId: string | null
  prompt: Prompt | null
  toasts: Toast[]
  telemetry: FlightTelemetry
  heat: number
  guardsClose: boolean
  collected: number[]
  courseStart: number | null
  courseTime: number | null

  // saved progress
  dragons: DragonData[]
  activeDragonId: string
  companionId: string | null
  nestEgg: Egg | null
  eggStash: Egg[]
  hatchReady: boolean
  inventory: Record<FoodKind, number>
  foundWildEggs: number[]
  bestCourseTime: number | null
  gold: number
  counters: Record<Counter, number>
  activeMission: ActiveMission | null
  completedMissions: string[]
  royalEggDay: number
  day: number
  settings: Settings
  account: Account | null
  cloud: 'offline' | 'syncing' | 'synced' | 'error'
  ridersOnline: number

  // actions
  start: () => void
  setMode: (m: Mode) => void
  openPanel: (p: Panel, dragonId?: string) => void
  setPrompt: (p: Prompt | null) => void
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
  setTelemetry: (t: FlightTelemetry) => void
  collectRing: (id: number, total: number) => void
  resetCourse: () => void

  addFood: (kind: FoodKind, n?: number) => void
  feed: (dragonId: string, kind: FoodKind) => void
  train: (dragonId: string, stat: TrainStat) => void
  play: (dragonId: string) => void
  setCompanion: (dragonId: string | null) => void
  setActive: (dragonId: string) => void
  addEgg: (egg: Egg) => void
  placeEgg: (eggId: string) => void
  incubate: (amount: number) => void
  hatch: (name: string) => void
  findWildEgg: (index: number, egg: Egg) => void
  breedDragons: (aId: string, bId: string) => boolean
  tickNeeds: (seconds: number) => void
  setHeat: (level: number, guardsClose: boolean) => void
  bump: (counter: Counter, n?: number) => void
  acceptMission: (id: string) => void
  abandonMission: () => void
  turnInMission: () => void
  checkMission: () => void
  buy: (itemId: string) => void
  busted: () => void
  newDay: () => void
  updateSettings: (patch: Partial<Settings>) => void
  stealRoyalEgg: () => void
  resetProgress: () => void
}

let toastId = 1

/** Pay out a mission's reward and mark it done. */
function completeMission(id: string) {
  const def = missionById(id)
  if (!def) return
  const s = useGame.getState()
  const active = s.dragons.find((d) => d.id === s.activeDragonId)
  useGame.setState((st) => ({
    gold: st.gold + def.reward.gold,
    inventory: {
      fish: st.inventory.fish + (def.reward.fish ?? 0),
      berries: st.inventory.berries + (def.reward.berries ?? 0),
    },
    completedMissions: [...st.completedMissions, id],
    activeMission: null,
    dragons: st.dragons.map((d) => (d.id === active?.id ? { ...d, xp: d.xp + def.reward.xp } : d)),
  }))
  s.toast(`Uppdrag klart: ${def.title}! +${def.reward.gold} guld`, 'gold')
  const next = MISSIONS.find((m) => m.requires === id)
  if (next) setTimeout(() => useGame.getState().toast(`Hedda i Draksten har ett nytt uppdrag.`, 'info'), 1500)
}

/** A royal egg: high-quality genes. */
export function royalEgg(): Egg {
  return { id: uid(), genome: rollGenome(Math.random, 0.85), progress: 0, foundAt: Date.now(), source: 'vild' }
}

function initialProgress() {
  const starter = starterDragon()
  return {
    dragons: [starter],
    activeDragonId: starter.id,
    companionId: null as string | null,
    nestEgg: { id: uid(), genome: randomGenome(Math.random, 0.3), progress: 0, foundAt: Date.now(), source: 'start' } as Egg | null,
    eggStash: [] as Egg[],
    hatchReady: false,
    inventory: { berries: 3, fish: 1 } as Record<FoodKind, number>,
    foundWildEggs: [] as number[],
    bestCourseTime: null as number | null,
    gold: 50,
    counters: { coursesCompleted: 0, wildEggsFound: 0, royalEggsStolen: 0, heistEscapes: 0, tentsBurned: 0, guardsDowned: 0 } as Record<Counter, number>,
    activeMission: null as ActiveMission | null,
    completedMissions: [] as string[],
    royalEggDay: -1,
    day: 0,
  }
}

const updateDragon = (dragons: DragonData[], id: string, fn: (d: DragonData) => DragonData) =>
  dragons.map((d) => (d.id === id ? fn(d) : d))

export type { GameState }
export const useGame = create<GameState>()(
  persist(
    (set, get) => {
      /** apply xp and announce stage-ups */
      const withXp = (d: DragonData, amount: number): DragonData => {
        const before = stageOf(d)
        const next = { ...d, xp: d.xp + xpGain(d, amount) }
        const after = stageOf(next)
        if (after !== before) {
          setTimeout(() => {
            get().toast(`${d.name} växte till ${after.label.toLowerCase()}!${after.rideable ? ' Nu kan du rida den.' : ''}`, 'gold')
          }, 0)
        }
        return next
      }

      return {
        phase: 'menu',
        mode: 'walking',
        panel: null,
        selectedDragonId: null,
        prompt: null,
        toasts: [],
        telemetry: { speed: 0, altitude: 0, stamina: 1, boosting: false },
        settings: { quality: 'high', autoQuality: true, volume: 0.7, music: true, invertPitch: false },
        account: null,
        cloud: 'offline',
        ridersOnline: 0,
        heat: 0,
        guardsClose: false,
        collected: [],
        courseStart: null,
        courseTime: null,
        ...initialProgress(),

        start: () => {
          initAudio()
          // dragon stands beside the nest, facing it; rider next to the nest
          const yaw = Math.atan2(-(NEST[0] - DRAGON_SPAWN[0]), -(NEST[2] - DRAGON_SPAWN[2]))
          parkAt(DRAGON_SPAWN[0], DRAGON_SPAWN[1], DRAGON_SPAWN[2], yaw)
          player.position.set(...PLAYER_SPAWN)
          player.yaw = Math.atan2(-(NEST[0] - PLAYER_SPAWN[0]), -(NEST[2] - PLAYER_SPAWN[2]))
          set({ phase: 'playing', mode: 'walking', collected: [], courseStart: null, courseTime: null })
          const { nestEgg, companionId } = get()
          if (nestEgg && !companionId) {
            setTimeout(() => get().toast('Ett ägg väntar i nästet. Gå dit och värm det.', 'gold'), 600)
          }
        },
        setMode: (mode) => set({ mode, prompt: null }),
        openPanel: (panel, dragonId) =>
          set((s) => ({ panel, selectedDragonId: dragonId ?? s.selectedDragonId ?? s.companionId ?? s.activeDragonId })),
        setPrompt: (prompt) => {
          const cur = get().prompt
          if (cur?.label === prompt?.label && cur?.action === prompt?.action) return
          set({ prompt })
        },
        toast: (text, tone = 'info') => {
          const id = toastId++
          set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }))
        },
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
        setTelemetry: (telemetry) => set({ telemetry }),
        collectRing: (id, total) => {
          const { collected, courseStart, bestCourseTime } = get()
          if (collected.includes(id)) return
          const next = [...collected, id]
          const startTime = courseStart ?? performance.now()
          const finished = next.length === total
          const time = finished ? (performance.now() - startTime) / 1000 : null
          set({
            collected: next,
            courseStart: startTime,
            courseTime: time,
            bestCourseTime: time !== null && (bestCourseTime === null || time < bestCourseTime) ? time : bestCourseTime,
          })
          if (finished) {
            get().bump('coursesCompleted')
            set((st) => ({ gold: st.gold + 25 }))
            get().addFood('fish', 2)
            const active = get().dragons.find((d) => d.id === get().activeDragonId)
            if (active) set((s) => ({ dragons: updateDragon(s.dragons, active.id, (d) => withXp(d, 40)) }))
          }
        },
        resetCourse: () => {
          resetFlight()
          set({ collected: [], courseStart: null, courseTime: null })
        },

        addFood: (kind, n = 1) => set((s) => ({ inventory: { ...s.inventory, [kind]: s.inventory[kind] + n } })),

        feed: (dragonId, kind) => {
          const s = get()
          if (s.inventory[kind] <= 0) return s.toast(`Du har ingen ${FOOD[kind].label.toLowerCase()}. Leta i världen.`, 'warn')
          const d = s.dragons.find((x) => x.id === dragonId)
          if (!d) return
          if (d.hunger >= 98) return s.toast(`${d.name} är mätt.`, 'info')
          const f = FOOD[kind]
          set({
            inventory: { ...s.inventory, [kind]: s.inventory[kind] - 1 },
            dragons: updateDragon(s.dragons, dragonId, (x) =>
              withXp({ ...x, hunger: Math.min(100, x.hunger + f.hunger), bond: Math.min(100, x.bond + f.bond) }, f.xp),
            ),
          })
        },

        train: (dragonId, stat) => {
          const s = get()
          const d = s.dragons.find((x) => x.id === dragonId)
          if (!d) return
          if (d.energy < 25) return s.toast(`${d.name} är för trött. Låt den vila en stund.`, 'warn')
          if (d.hunger < 15) return s.toast(`${d.name} är för hungrig för att träna.`, 'warn')
          const gain = 0.15 + Math.random() * 0.2
          set({
            dragons: updateDragon(s.dragons, dragonId, (x) =>
              withXp(
                {
                  ...x,
                  energy: x.energy - 25,
                  hunger: Math.max(0, x.hunger - 10),
                  bond: Math.min(100, x.bond + 1),
                  trained: { ...x.trained, [stat]: Math.min(6, x.trained[stat] + gain) },
                },
                30,
              ),
            ),
          })
          s.toast(`${d.name} tränade ${TRAIN_LABELS[stat].toLowerCase()} (+${gain.toFixed(2)})`)
        },

        play: (dragonId) => {
          const s = get()
          const d = s.dragons.find((x) => x.id === dragonId)
          if (!d) return
          const cooldown = 20_000 - (Date.now() - d.lastPlayed)
          if (cooldown > 0) return s.toast(`${d.name} vill vila. Försök igen om ${Math.ceil(cooldown / 1000)} s.`, 'info')
          set({
            dragons: updateDragon(s.dragons, dragonId, (x) =>
              withXp({ ...x, bond: Math.min(100, x.bond + 6), lastPlayed: Date.now() }, 6),
            ),
          })
        },

        setCompanion: (companionId) => set({ companionId }),

        setActive: (dragonId) => {
          const s = get()
          const d = s.dragons.find((x) => x.id === dragonId)
          if (!d || !view(d).stage.rideable) return
          set({
            activeDragonId: dragonId,
            companionId: s.companionId === dragonId ? (s.activeDragonId ?? null) : s.companionId,
          })
          s.toast(`${d.name} är nu din riddrake.`, 'gold')
        },

        addEgg: (egg) => {
          const s = get()
          if (!s.nestEgg) {
            set({ nestEgg: egg })
            s.toast('Ägget lades i nästet.', 'gold')
          } else {
            set({ eggStash: [...s.eggStash, egg] })
            s.toast('Ägget sparades. Nästet är upptaget.', 'gold')
          }
        },

        placeEgg: (eggId) => {
          const s = get()
          if (s.nestEgg) return
          const egg = s.eggStash.find((e) => e.id === eggId)
          if (!egg) return
          set({ nestEgg: egg, eggStash: s.eggStash.filter((e) => e.id !== eggId) })
        },

        incubate: (amount) => {
          const s = get()
          if (!s.nestEgg || s.hatchReady) return
          const progress = Math.min(1, s.nestEgg.progress + amount)
          set({ nestEgg: { ...s.nestEgg, progress }, hatchReady: progress >= 1 })
          if (progress >= 1) s.toast('Ägget spricker! Gå till nästet.', 'gold')
        },

        hatch: (name) => {
          const s = get()
          if (!s.nestEgg || !s.hatchReady) return
          const baby = createDragon(s.nestEgg.genome, name.trim() || undefined)
          const [next, ...rest] = s.eggStash
          set({
            dragons: [...s.dragons, baby],
            companionId: baby.id,
            selectedDragonId: baby.id,
            nestEgg: next ?? null,
            eggStash: rest,
            hatchReady: false,
            panel: 'dragons',
          })
          s.toast(`${baby.name} är kläckt! Den följer dig nu.`, 'gold')
        },

        findWildEgg: (index, egg) => {
          const s = get()
          if (s.foundWildEggs.includes(index)) return
          set({ foundWildEggs: [...s.foundWildEggs, index] })
          s.toast('Du hittade ett vilt drakägg!', 'gold')
          s.addEgg(egg)
          get().bump('wildEggsFound')
        },

        breedDragons: (aId, bId) => {
          const s = get()
          const a = s.dragons.find((d) => d.id === aId)
          const b = s.dragons.find((d) => d.id === bId)
          if (!a || !b || a.id === b.id) return false
          if (!view(a).stage.rideable || !view(b).stage.rideable) {
            s.toast('Båda drakarna måste vara vuxna.', 'warn')
            return false
          }
          const wait = Math.max(breedCooldownLeft(a), breedCooldownLeft(b))
          if (wait > 0) {
            s.toast(`Drakarna behöver vila ${Math.ceil(wait / 60000)} min till.`, 'warn')
            return false
          }
          if (s.inventory.fish < BREED_COST.fish) {
            s.toast(`Avel kostar ${BREED_COST.fish} silverfisk.`, 'warn')
            return false
          }
          const now = Date.now()
          const egg: Egg = { id: uid(), genome: breedGenomes(a.genome, b.genome), progress: 0, foundAt: now, source: 'avel' }
          set({
            inventory: { ...s.inventory, fish: s.inventory.fish - BREED_COST.fish },
            dragons: s.dragons.map((d) => (d.id === aId || d.id === bId ? { ...d, lastBred: now, bond: Math.min(100, d.bond + 5) } : d)),
          })
          s.toast(`${a.name} och ${b.name} fick ett ägg!`, 'gold')
          get().addEgg(egg)
          return true
        },

        tickNeeds: (seconds) => {
          // ~1 hunger per 12 s of play, energy refills in ~2 min
          const minutes = seconds / 60
          set((s) => ({
            dragons: s.dragons.map((d) => ({
              ...d,
              hunger: Math.max(0, d.hunger - minutes * 5),
              energy: Math.min(100, d.energy + minutes * 50),
              bond: d.hunger < 10 ? Math.max(0, d.bond - minutes * 2) : d.bond,
            })),
          }))
        },

        setHeat: (heat, guardsClose) => {
          const cur = get()
          if (cur.heat === heat && cur.guardsClose === guardsClose) return
          set({ heat, guardsClose })
        },

        bump: (counter, n = 1) => {
          set((st) => ({ counters: { ...st.counters, [counter]: st.counters[counter] + n } }))
          get().checkMission()
        },

        acceptMission: (id) => {
          const s = get()
          const def = missionById(id)
          if (!def || s.completedMissions.includes(id)) return
          if (def.requires && !s.completedMissions.includes(def.requires)) return
          set({ activeMission: { id, baseline: def.goal ? s.counters[def.goal.counter] : 0 } })
          s.toast(`Nytt uppdrag: ${def.title}`, 'gold')
        },

        abandonMission: () => set({ activeMission: null }),

        turnInMission: () => {
          const s = get()
          const def = s.activeMission && missionById(s.activeMission.id)
          if (!def?.deliver) return
          const need = def.deliver
          if ((need.fish ?? 0) > s.inventory.fish || (need.berries ?? 0) > s.inventory.berries) {
            return s.toast('Du har inte allt som behövs än.', 'warn')
          }
          set({
            inventory: {
              fish: s.inventory.fish - (need.fish ?? 0),
              berries: s.inventory.berries - (need.berries ?? 0),
            },
          })
          completeMission(def.id)
        },

        checkMission: () => {
          const s = get()
          const def = s.activeMission && missionById(s.activeMission.id)
          if (!def?.goal) return
          if (s.counters[def.goal.counter] - s.activeMission!.baseline >= def.goal.amount) completeMission(def.id)
        },

        buy: (itemId) => {
          const s = get()
          const item = SHOP.find((i) => i.id === itemId)
          if (!item) return
          if (s.gold < item.price) return s.toast('Inte tillräckligt med guld.', 'warn')
          if (item.kind === 'incubate') {
            if (!s.nestEgg || s.hatchReady) return s.toast('Det finns inget ägg som ruvar.', 'warn')
            set({ gold: s.gold - item.price })
            s.incubate(0.5)
            return
          }
          set({ gold: s.gold - item.price })
          s.addFood(item.kind, 1)
        },

        updateSettings: (patch) => set((st) => ({ settings: { ...st.settings, ...patch } })),

        newDay: () => {
          set((st) => ({ day: st.day + 1 }))
          get().toast(`Dag ${get().day + 1} gryr över ön.`)
        },

        stealRoyalEgg: () => {
          const s = get()
          if (s.royalEggDay === s.day) return
          set({ royalEggDay: s.day })
          s.addEgg(royalEgg())
          s.bump('royalEggsStolen')
        },

        busted: () => {
          const s = get()
          const lost = Math.floor(s.gold * 0.3)
          set({ gold: s.gold - lost, heat: 0, guardsClose: false, panel: null })
          s.toast(`Drakgardet tog dig! Du förlorade ${lost} guld.`, 'warn')
        },

        resetProgress: () => {
          set({ ...initialProgress(), mode: 'walking', panel: null, phase: 'menu' })
        },
      }
    },
    {
      name: 'dragon-save-v1',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => persistedSlice(s),
      // older saves lack the newer fields — fill them from fresh defaults
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    },
  ),
)

/** Everything that is saved — locally and to the cloud. */
export function persistedSlice(s: GameState) {
  return {
    dragons: s.dragons,
    activeDragonId: s.activeDragonId,
    companionId: s.companionId,
    nestEgg: s.nestEgg,
    eggStash: s.eggStash,
    hatchReady: s.hatchReady,
    inventory: s.inventory,
    foundWildEggs: s.foundWildEggs,
    bestCourseTime: s.bestCourseTime,
    gold: s.gold,
    counters: s.counters,
    activeMission: s.activeMission,
    completedMissions: s.completedMissions,
    royalEggDay: s.royalEggDay,
    day: s.day,
    settings: s.settings,
  }
}
export type SaveData = ReturnType<typeof persistedSlice>

/** Convenience selectors */
export const selectActive = (s: GameState) => s.dragons.find((d) => d.id === s.activeDragonId) ?? null
export const selectCompanion = (s: GameState) => (s.companionId ? s.dragons.find((d) => d.id === s.companionId) ?? null : null)
export { STAGES }
