import { express, rarity, randomGenome, type Genome, type Phenotype, type Rarity } from './genetics'
import { dragonName } from './names'

export type Stage = 'kläckling' | 'unge' | 'ung' | 'vuxen'

export const STAGES: { id: Stage; label: string; xp: number; scale: number; rideable: boolean }[] = [
  { id: 'kläckling', label: 'Kläckling', xp: 0, scale: 0.22, rideable: false },
  { id: 'unge', label: 'Unge', xp: 120, scale: 0.36, rideable: false },
  { id: 'ung', label: 'Ung drake', xp: 360, scale: 0.6, rideable: false },
  { id: 'vuxen', label: 'Vuxen', xp: 800, scale: 1, rideable: true },
]

export type TrainStat = 'strength' | 'speed' | 'stamina' | 'firepower'

export const TRAIN_LABELS: Record<TrainStat, string> = {
  strength: 'Styrka',
  speed: 'Fart',
  stamina: 'Uthållighet',
  firepower: 'Eld',
}

export interface DragonData {
  id: string
  name: string
  genome: Genome
  xp: number
  /** 0..100 */
  hunger: number
  /** 0..100 */
  bond: number
  /** 0..100, spent by training */
  energy: number
  /** points gained by training, added to the genetic base */
  trained: Record<TrainStat, number>
  bornAt: number
  lastPlayed: number
}

export interface Egg {
  id: string
  genome: Genome
  /** 0..1 */
  progress: number
  foundAt: number
  source: 'start' | 'vild' | 'avel'
}

export type FoodKind = 'berries' | 'fish'

export const FOOD: Record<FoodKind, { label: string; hunger: number; xp: number; bond: number; color: string }> = {
  berries: { label: 'Glödbär', hunger: 18, xp: 8, bond: 2, color: '#ef4444' },
  fish: { label: 'Silverfisk', hunger: 35, xp: 18, bond: 4, color: '#cbd5e1' },
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export function stageOf(d: DragonData) {
  let s = STAGES[0]
  for (const st of STAGES) if (d.xp >= st.xp) s = st
  return s
}

export function nextStage(d: DragonData) {
  const i = STAGES.indexOf(stageOf(d))
  return STAGES[i + 1] ?? null
}

export interface DragonView {
  data: DragonData
  pheno: Phenotype
  rarity: Rarity
  stage: (typeof STAGES)[number]
  stats: Record<TrainStat, number>
}

const viewCache = new WeakMap<DragonData, DragonView>()

/** Derived, memoised view of a dragon (phenotype + effective stats). */
export function view(d: DragonData): DragonView {
  const cached = viewCache.get(d)
  if (cached) return cached
  const pheno = express(d.genome)
  const stage = stageOf(d)
  const growth = 0.4 + 0.6 * Math.min(1, d.xp / STAGES[3].xp)
  const stat = (k: TrainStat) => Math.min(20, pheno[k] * growth + d.trained[k])
  const v: DragonView = {
    data: d,
    pheno,
    rarity: rarity(pheno),
    stage,
    stats: { strength: stat('strength'), speed: stat('speed'), stamina: stat('stamina'), firepower: stat('firepower') },
  }
  viewCache.set(d, v)
  return v
}

export function createDragon(genome: Genome, name = dragonName(), xp = 0): DragonData {
  const now = Date.now()
  return {
    id: uid(),
    name,
    genome,
    xp,
    hunger: 70,
    bond: xp > 0 ? 60 : 20,
    energy: 100,
    trained: { strength: 0, speed: 0, stamina: 0, firepower: 0 },
    bornAt: now,
    lastPlayed: 0,
  }
}

/** The adult dragon every new player starts with. */
export function starterDragon(): DragonData {
  const g = randomGenome(Math.random, 0.25)
  // starter is a classic red fire dragon so the first impression is iconic
  g.numeric.hue = [2, 358]
  g.numeric.saturation = [0.7, 0.72]
  g.numeric.lightness = [0.36, 0.34]
  g.numeric.accentHue = [40, 42]
  g.numeric.membraneHue = [20, 22]
  g.element = ['eld', 'eld']
  g.traits = [[], []]
  return createDragon(g, 'Ember', STAGES[3].xp)
}

/** Flight tuning multipliers from the ridden dragon's stats (stat ~5 = 1.0). */
export function flightMultipliers(v: DragonView | null) {
  if (!v) return { speed: 1, stamina: 1, boost: 1 }
  return {
    speed: 0.82 + v.stats.speed * 0.04,
    stamina: 0.75 + v.stats.stamina * 0.05,
    boost: 0.8 + v.stats.strength * 0.03 + v.stats.firepower * 0.02,
  }
}

/** xp gains are halved when the dragon is hungry */
export function xpGain(d: DragonData, base: number) {
  return Math.round(base * (d.hunger < 20 ? 0.5 : 1) * (1 + d.bond / 200))
}
