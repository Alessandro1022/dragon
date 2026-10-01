/**
 * Mission definitions. Progress is measured as the change in a lifetime
 * counter since the mission was accepted, so missions never need bespoke
 * tracking code: the world just bumps counters.
 */

export type Counter = 'coursesCompleted' | 'wildEggsFound' | 'royalEggsStolen' | 'heistEscapes' | 'tentsBurned' | 'guardsDowned'

export type WaypointKind = 'ring' | 'questGiver' | 'wildEgg' | 'hatchery' | 'camp' | 'none'

export interface MissionDef {
  id: string
  title: string
  /** what the quest giver says */
  pitch: string
  objective: string
  /** counter goal; undefined = turn-in mission */
  goal?: { counter: Counter; amount: number }
  /** turn-in missions: items to hand over */
  deliver?: { fish?: number; berries?: number }
  reward: { gold: number; xp: number; fish?: number; berries?: number }
  requires?: string
  waypoint: WaypointKind
  /** shown while the mission runs and heat is up */
  heatHint?: string
}

export const MISSIONS: MissionDef[] = [
  {
    id: 'forsta-flygningen',
    title: 'Första flygningen',
    pitch: 'En ryttare som inte kan flyga genom ringarna är ingen ryttare. Visa mig vad din drake går för.',
    objective: 'Flyg genom alla tolv ringar',
    goal: { counter: 'coursesCompleted', amount: 1 },
    reward: { gold: 80, xp: 60, fish: 2 },
    waypoint: 'ring',
  },
  {
    id: 'fiskarens-bon',
    title: 'Fiskarens bön',
    pitch: 'Hamnen är tom sedan stormen. Flyg lågt över havet och fånga silverfisk åt oss.',
    objective: 'Lämna 4 silverfisk till Hedda',
    deliver: { fish: 4 },
    reward: { gold: 140, xp: 50, berries: 4 },
    requires: 'forsta-flygningen',
    waypoint: 'questGiver',
  },
  {
    id: 'toppens-hemlighet',
    title: 'Toppens hemlighet',
    pitch: 'Ljuspelarna på topparna markerar vilda ägg. Ingen har vågat flyga dit. Du?',
    objective: 'Hämta ett vilt drakägg från en bergstopp',
    goal: { counter: 'wildEggsFound', amount: 1 },
    reward: { gold: 160, xp: 80 },
    requires: 'forsta-flygningen',
    waypoint: 'wildEgg',
  },
  {
    id: 'eld-over-lagret',
    title: 'Eld över lägret',
    pitch: 'Banditerna i östra kullarna rånar våra karavaner. Bränn ner deras tält. Håll F för eld.',
    objective: 'Bränn banditlägrets fyra tält',
    goal: { counter: 'tentsBurned', amount: 4 },
    reward: { gold: 250, xp: 120 },
    requires: 'fiskarens-bon',
    waypoint: 'camp',
  },
  {
    id: 'kungligt-kupp',
    title: 'Kungligt kupp',
    pitch: 'Kungens kläckeri vaktar ägg som borde tillhöra folket. Ta ett. Sen springer du. Fort.',
    objective: 'Stjäl ett kungligt ägg och skaka av dig Drakgardet',
    goal: { counter: 'heistEscapes', amount: 1 },
    reward: { gold: 450, xp: 200 },
    requires: 'eld-over-lagret',
    waypoint: 'hatchery',
    heatHint: 'Fly från Drakgardet! Håll dig långt borta tills stjärnorna slocknar.',
  },
]

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id)

export const SHOP = [
  { id: 'berries', label: 'Glödbär', description: 'Mättar och ger lite XP', price: 6, kind: 'berries' as const },
  { id: 'fish', label: 'Silverfisk', description: 'Mättar mer, behövs för avel', price: 14, kind: 'fish' as const },
  { id: 'incubate', label: 'Glödlampa', description: 'Ruvar ägget i nästet +50 % direkt', price: 120, kind: 'incubate' as const },
]
