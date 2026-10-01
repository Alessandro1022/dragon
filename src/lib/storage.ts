import type { StateStorage } from 'zustand/middleware'

/**
 * localStorage wrapper that never throws (private mode, blocked storage).
 * Swapped for Supabase sync in the online phase.
 */
export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      /* storage unavailable — progress lives in memory this session */
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}
