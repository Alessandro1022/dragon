/**
 * Dragon genetics.
 *
 * Every gene is a pair of alleles — one inherited from each parent.
 * Numeric genes express as the mean of both alleles; the element gene uses
 * a dominance ladder. Breeding picks one allele per parent and can mutate.
 * Pure functions only, so the same code can run on a server (Supabase
 * Edge Function) when breeding between players goes online.
 */

export type Element = 'eld' | 'is' | 'storm' | 'natur' | 'skugga'

export const ELEMENTS: Record<Element, { label: string; color: string; fire: [string, string]; dominance: number }> = {
  eld: { label: 'Eld', color: '#f97316', fire: ['#ffb02e', '#fff3c4'], dominance: 3 },
  is: { label: 'Is', color: '#7dd3fc', fire: ['#7dd3fc', '#f0fbff'], dominance: 1 },
  storm: { label: 'Storm', color: '#a78bfa', fire: ['#a78bfa', '#f5f3ff'], dominance: 4 },
  natur: { label: 'Natur', color: '#4ade80', fire: ['#4ade80', '#f0fdf4'], dominance: 2 },
  skugga: { label: 'Skugga', color: '#e879f9', fire: ['#c026d3', '#fae8ff'], dominance: 5 },
}

export type Trait = 'glod' | 'albino' | 'melanist' | 'tvillinghorn' | 'jattevingar'

export const TRAITS: Record<Trait, { label: string; description: string; weight: number }> = {
  glod: { label: 'Glödmönster', description: 'Lysande ådror i fjällen', weight: 3 },
  albino: { label: 'Albino', description: 'Pärlvita fjäll', weight: 4 },
  melanist: { label: 'Melanist', description: 'Kolsvarta fjäll', weight: 3 },
  tvillinghorn: { label: 'Tvillinghorn', description: 'Extra hornpar', weight: 2 },
  jattevingar: { label: 'Jättevingar', description: 'Ovanligt stort vingspann', weight: 2 },
}

/** Numeric genes and their expressed range. */
export const NUMERIC_GENES = {
  hue: [0, 360],
  saturation: [0.35, 0.85],
  lightness: [0.22, 0.5],
  accentHue: [0, 360],
  membraneHue: [0, 360],
  wingspan: [0.8, 1.3],
  hornLength: [0.6, 1.6],
  strength: [1, 10],
  speed: [1, 10],
  stamina: [1, 10],
  firepower: [1, 10],
} as const

export type NumericGene = keyof typeof NUMERIC_GENES
type Pair<T> = [T, T]

export interface Genome {
  numeric: Record<NumericGene, Pair<number>>
  element: Pair<Element>
  /** recessive traits: expressed only when both alleles carry it */
  traits: Pair<Trait[]>
  generation: number
}

export interface Phenotype {
  hue: number
  saturation: number
  lightness: number
  accentHue: number
  membraneHue: number
  wingspan: number
  hornLength: number
  strength: number
  speed: number
  stamina: number
  firepower: number
  element: Element
  traits: Trait[]
}

export type Rarity = 'Vanlig' | 'Ovanlig' | 'Sällsynt' | 'Episk' | 'Legendarisk'

export const RARITY_COLORS: Record<Rarity, string> = {
  Vanlig: '#cbd5e1',
  Ovanlig: '#4ade80',
  Sällsynt: '#60a5fa',
  Episk: '#c084fc',
  Legendarisk: '#fbbf24',
}

export type Rng = () => number

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const pick = <T,>(arr: readonly T[], rng: Rng) => arr[Math.floor(rng() * arr.length)]

function randomAllele(gene: NumericGene, rng: Rng, quality = 0) {
  const [lo, hi] = NUMERIC_GENES[gene]
  const isStat = gene === 'strength' || gene === 'speed' || gene === 'stamina' || gene === 'firepower'
  // stats skew low; quality (0..1) lifts them for rarer finds
  const t = isStat ? Math.pow(rng(), 1.6 - quality) : rng()
  return lerp(lo, hi, t)
}

/** A fresh wild genome. quality 0..1 biases toward better stats and traits. */
export function randomGenome(rng: Rng = Math.random, quality = 0): Genome {
  const numeric = {} as Genome['numeric']
  for (const g of Object.keys(NUMERIC_GENES) as NumericGene[]) {
    numeric[g] = [randomAllele(g, rng, quality), randomAllele(g, rng, quality)]
  }
  const elements = Object.keys(ELEMENTS) as Element[]
  const common = elements.filter((e) => e !== 'skugga')
  const elem = (): Element => (rng() < 0.04 + quality * 0.1 ? 'skugga' : pick(common, rng))
  const traitList = Object.keys(TRAITS) as Trait[]
  const carry = (): Trait[] => traitList.filter(() => rng() < 0.12 + quality * 0.2)
  const traits: Pair<Trait[]> = [carry(), carry()]
  // wild finds of high quality sometimes express a trait outright
  if (quality > 0.5 && rng() < quality * 0.6) {
    const t = pick(traitList, rng)
    traits[0] = [...new Set([...traits[0], t])]
    traits[1] = [...new Set([...traits[1], t])]
  }
  return { numeric, element: [elem(), elem()], traits, generation: 0 }
}

export function express(genome: Genome): Phenotype {
  const n = genome.numeric
  const mean = (g: NumericGene) => (n[g][0] + n[g][1]) / 2
  // hue is circular — average along the shorter arc
  const circular = (g: NumericGene) => {
    const [a, b] = n[g]
    let d = b - a
    if (d > 180) d -= 360
    if (d < -180) d += 360
    return (a + d / 2 + 360) % 360
  }
  const [e1, e2] = genome.element
  const element = ELEMENTS[e1].dominance >= ELEMENTS[e2].dominance ? e1 : e2
  const traits = genome.traits[0].filter((t) => genome.traits[1].includes(t))
  return {
    hue: circular('hue'),
    saturation: mean('saturation'),
    lightness: mean('lightness'),
    accentHue: circular('accentHue'),
    membraneHue: circular('membraneHue'),
    wingspan: mean('wingspan') * (traits.includes('jattevingar') ? 1.25 : 1),
    hornLength: mean('hornLength'),
    strength: mean('strength'),
    speed: mean('speed'),
    stamina: mean('stamina'),
    firepower: mean('firepower'),
    element,
    traits,
  }
}

/** Inheritance: one allele from each parent per gene, with mutation. */
export function breed(a: Genome, b: Genome, rng: Rng = Math.random): Genome {
  const numeric = {} as Genome['numeric']
  for (const g of Object.keys(NUMERIC_GENES) as NumericGene[]) {
    const [lo, hi] = NUMERIC_GENES[g]
    const fromA = a.numeric[g][rng() < 0.5 ? 0 : 1]
    const fromB = b.numeric[g][rng() < 0.5 ? 0 : 1]
    const mutate = (v: number) => {
      if (rng() > 0.08) return v
      const span = hi - lo
      return g.endsWith('ue') ? (v + (rng() - 0.5) * 80 + 360) % 360 : clamp(v + (rng() - 0.35) * span * 0.25, lo, hi)
    }
    numeric[g] = [mutate(fromA), mutate(fromB)]
  }
  const element: Pair<Element> = [a.element[rng() < 0.5 ? 0 : 1], b.element[rng() < 0.5 ? 0 : 1]]
  if (rng() < 0.01) element[0] = 'skugga'
  const traits: Pair<Trait[]> = [a.traits[rng() < 0.5 ? 0 : 1], b.traits[rng() < 0.5 ? 0 : 1]]
  if (rng() < 0.03) {
    const t = pick(Object.keys(TRAITS) as Trait[], rng)
    traits[0] = [...new Set([...traits[0], t])]
  }
  return { numeric, element, traits, generation: Math.max(a.generation, b.generation) + 1 }
}

export function rarityScore(p: Phenotype): number {
  const stats = (p.strength + p.speed + p.stamina + p.firepower) / 40 // 0.1..1
  const traitScore = p.traits.reduce((s, t) => s + TRAITS[t].weight, 0) / 6
  const elementScore = p.element === 'skugga' ? 0.5 : 0
  return stats + traitScore + elementScore
}

export function rarity(p: Phenotype): Rarity {
  const s = rarityScore(p)
  if (s > 1.6) return 'Legendarisk'
  if (s > 1.15) return 'Episk'
  if (s > 0.8) return 'Sällsynt'
  if (s > 0.55) return 'Ovanlig'
  return 'Vanlig'
}

export interface DragonPalette {
  body: string
  back: string
  belly: string
  membrane: string
  horn: string
  eye: string
  fire: [string, string]
  glow: boolean
}

const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`

export function palette(p: Phenotype): DragonPalette {
  let { hue, saturation, lightness } = p
  if (p.traits.includes('albino')) {
    saturation = 0.08
    lightness = 0.82
  } else if (p.traits.includes('melanist')) {
    saturation = 0.15
    lightness = 0.1
  }
  const el = ELEMENTS[p.element]
  return {
    body: hsl(hue, saturation, lightness),
    back: hsl(hue, saturation * 0.9, lightness * 0.55),
    belly: hsl(p.accentHue, 0.55, 0.55),
    membrane: hsl(p.membraneHue, 0.7, 0.42),
    horn: p.traits.includes('melanist') ? '#d9c7a3' : '#efe6d2',
    eye: el.color,
    fire: el.fire,
    glow: p.traits.includes('glod'),
  }
}

/** Egg shell colours hint at what's inside. */
export function eggColors(p: Phenotype): [string, string] {
  return [hsl(p.hue, p.saturation * 0.8, Math.min(0.7, p.lightness + 0.25)), hsl(p.accentHue, 0.6, 0.6)]
}
