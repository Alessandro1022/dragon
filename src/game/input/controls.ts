import { useEffect } from 'react'
import { performAction } from '../interaction'
import { useGame } from '../../store/gameStore'

/**
 * Mutable input state read every frame by the flight system.
 * Kept outside React state so input never triggers re-renders.
 */
export const input = {
  pitch: 0, // -1 dive .. 1 climb
  turn: 0, // -1 left .. 1 right
  boost: false,
  flap: false,
  // touch joystick contributes separately so keyboard and touch can coexist
  touchPitch: 0,
  touchTurn: 0,
  touchBoost: false,
  touchFlap: false,
  fire: false,
  touchFire: false,
}

const keys = new Set<string>()

function recompute() {
  const up = keys.has('KeyW') || keys.has('ArrowUp')
  const down = keys.has('KeyS') || keys.has('ArrowDown')
  const left = keys.has('KeyA') || keys.has('ArrowLeft')
  const right = keys.has('KeyD') || keys.has('ArrowRight')
  // W = climb, S = dive (arcade style, matches the touch joystick)
  input.pitch = (up ? 1 : 0) - (down ? 1 : 0)
  input.turn = (right ? 1 : 0) - (left ? 1 : 0)
  input.boost = keys.has('ShiftLeft') || keys.has('ShiftRight')
  input.flap = keys.has('Space')
  input.fire = keys.has('KeyF')
}

export function readPitch() {
  return Math.max(-1, Math.min(1, input.pitch + input.touchPitch))
}

export function readTurn() {
  return Math.max(-1, Math.min(1, input.turn + input.touchTurn))
}

export function readBoost() {
  return input.boost || input.touchBoost
}

export function readFire() {
  return input.fire || input.touchFire
}

export function readFlap() {
  return input.flap || input.touchFlap
}

export function useKeyboard() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // typing in a text field (e.g. naming a dragon) must not steer the game
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault()
      if (!e.repeat) {
        const g = useGame.getState()
        if (e.code === 'KeyE' && g.phase === 'playing' && !g.panel) performAction()
        if ((e.code === 'KeyI' || e.code === 'Tab') && g.phase === 'playing') g.openPanel(g.panel === 'dragons' ? null : 'dragons')
        if (e.code === 'Escape' && g.panel) g.openPanel(null)
      }
      keys.add(e.code)
      recompute()
    }
    const up = (e: KeyboardEvent) => {
      keys.delete(e.code)
      recompute()
    }
    const blur = () => {
      keys.clear()
      recompute()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])
}
