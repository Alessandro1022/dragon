import { useMemo } from 'react'
import { express, palette } from '../../systems/genetics'
import type { DragonData } from '../../systems/dragons'
import type { DragonLook } from './DragonModel'

export function lookFor(d: DragonData): DragonLook {
  const p = express(d.genome)
  return {
    palette: palette(p),
    wingspan: p.wingspan,
    hornLength: p.hornLength,
    twinHorns: p.traits.includes('tvillinghorn'),
  }
}

export function useDragonLook(d: DragonData | null): DragonLook | null {
  return useMemo(() => (d ? lookFor(d) : null), [d?.genome]) // eslint-disable-line react-hooks/exhaustive-deps
}
