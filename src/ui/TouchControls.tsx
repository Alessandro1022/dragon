import { useRef, useState } from 'react'
import { input } from '../game/input/controls'
import { performAction } from '../game/interaction'
import { useGame } from '../store/gameStore'

const RADIUS = 56
const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/** Virtual joystick (left) + context/action buttons (right) for phones and tablets. */
export function TouchControls() {
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const origin = useRef<{ x: number; y: number } | null>(null)
  const mode = useGame((s) => s.mode)
  const prompt = useGame((s) => s.prompt)
  const panel = useGame((s) => s.panel)

  if (!isTouch || panel) return null
  const flying = mode === 'flying'

  const move = (e: React.PointerEvent) => {
    if (!origin.current) return
    let dx = e.clientX - origin.current.x
    let dy = e.clientY - origin.current.y
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    setKnob({ x: dx, y: dy })
    input.touchTurn = dx / RADIUS
    input.touchPitch = -dy / RADIUS
  }
  const end = () => {
    origin.current = null
    setKnob({ x: 0, y: 0 })
    input.touchTurn = 0
    input.touchPitch = 0
  }

  return (
    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div
        className="glass relative flex h-36 w-36 touch-none items-center justify-center rounded-full"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
          e.currentTarget.setPointerCapture(e.pointerId)
          move(e)
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="h-16 w-16 rounded-full bg-gradient-to-b from-white/80 to-white/40 shadow-lg" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>

      <div className="flex flex-col items-end gap-3">
        {prompt && (
          <button
            onClick={performAction}
            className="rise max-w-44 rounded-2xl bg-gradient-to-b from-[#fde68a] to-ember px-4 py-3 text-sm font-bold leading-tight text-night shadow-[0_8px_30px_rgb(245_176_65/0.5)] active:scale-95"
          >
            {prompt.label}
          </button>
        )}
        {flying && <HoldButton label="ELD" onChange={(v) => (input.touchFire = v)} fire />}
        <div className="flex items-end gap-3">
          <HoldButton label={flying ? 'FLAXA' : 'HOPPA'} onChange={(v) => (input.touchFlap = v)} />
          <HoldButton label={flying ? 'BOOST' : 'SPRINT'} onChange={(v) => (input.touchBoost = v)} accent />
        </div>
      </div>
    </div>
  )
}

function HoldButton({ label, onChange, accent, fire }: { label: string; onChange: (v: boolean) => void; accent?: boolean; fire?: boolean }) {
  const [down, setDown] = useState(false)
  const set = (v: boolean) => {
    setDown(v)
    onChange(v)
  }
  return (
    <button
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        set(true)
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      className={`flex h-[4.5rem] w-[4.5rem] touch-none items-center justify-center rounded-full font-display text-[11px] font-extrabold tracking-[0.12em] transition ${
        fire
          ? 'bg-gradient-to-b from-[#fde68a] via-[#f97316] to-[#b91c1c] text-white shadow-[0_0_24px_rgb(249_115_22/0.6)]'
          : accent
            ? 'bg-gradient-to-b from-ember to-ember-deep text-night'
            : 'glass text-white'
      } ${down ? 'scale-90 brightness-125' : ''}`}
    >
      {label}
    </button>
  )
}
