import { create } from 'zustand'
import type { FlightTelemetry } from '../types'
import { resetFlight } from '../game/dragon/flightState'

type Phase = 'menu' | 'playing'

interface GameState {
  phase: Phase
  telemetry: FlightTelemetry
  collected: number[]
  courseStart: number | null
  courseTime: number | null
  start: () => void
  setTelemetry: (t: FlightTelemetry) => void
  collectRing: (id: number, total: number) => void
  resetCourse: () => void
}

export const useGame = create<GameState>((set, get) => ({
  phase: 'menu',
  telemetry: { speed: 0, altitude: 0, stamina: 1, boosting: false },
  collected: [],
  courseStart: null,
  courseTime: null,
  start: () => {
    resetFlight()
    set({ phase: 'playing', collected: [], courseStart: null, courseTime: null })
  },
  setTelemetry: (telemetry) => set({ telemetry }),
  collectRing: (id, total) => {
    const { collected, courseStart } = get()
    if (collected.includes(id)) return
    const next = [...collected, id]
    const startTime = courseStart ?? performance.now()
    set({
      collected: next,
      courseStart: startTime,
      courseTime: next.length === total ? (performance.now() - startTime) / 1000 : null,
    })
  },
  resetCourse: () => {
    resetFlight()
    set({ collected: [], courseStart: null, courseTime: null })
  },
}))
