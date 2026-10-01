const START = ['Ry', 'Vael', 'Sol', 'Ka', 'Ember', 'Ny', 'Drak', 'Fen', 'Ast', 'Tor', 'Isk', 'Mor', 'Sky', 'Ar', 'Zeph', 'Hel', 'Run', 'Gry']
const MID = ['a', 'o', 'e', 'i', 'ae', 'y', '']
const END = ['rion', 'dra', 'thor', 'vyr', 'ka', 'mir', 'nax', 'ris', 'lo', 'dur', 'gast', 'via', 'rok', 'sa', 'ne']

export function dragonName(rng: () => number = Math.random) {
  const p = <T,>(a: T[]) => a[Math.floor(rng() * a.length)]
  const n = p(START) + p(MID) + p(END)
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
}
