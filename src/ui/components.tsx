import { useId, type ReactNode } from 'react'
import { express, palette, eggColors, type Genome } from '../systems/genetics'

export function Bar({ value, max = 100, color = '#f5b041', label, right }: { value: number; max?: number; color?: string; label?: string; right?: ReactNode }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div>
      {(label || right) && (
        <div className="mb-1 flex items-baseline justify-between text-[11px] font-medium text-white/70">
          <span>{label}</span>
          <span className="tabular-nums text-white/55">{right}</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function Badge({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 40%, transparent)` }}
    >
      {children}
    </span>
  )
}

/** Modal sheet: bottom sheet on phones, centered card on desktop. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-end justify-center bg-night/55 sm:items-center" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="rise flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[linear-gradient(180deg,#141a2b,#0c101c)] text-white shadow-2xl sm:max-w-2xl sm:rounded-3xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="font-display text-lg font-extrabold tracking-[0.14em] text-ember">{title}</h2>
          <button onClick={onClose} aria-label="Stäng" className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

/** Side-view dragon portrait tinted by its genes. */
export function DragonPortrait({ genome, size = 64, scale = 1 }: { genome: Genome; size?: number; scale?: number }) {
  const p = palette(express(genome))
  const s = 0.55 + scale * 0.45
  const gid = 'g' + useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id={gid} cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor={p.eye} stopOpacity="0.28" />
          <stop offset="100%" stopColor={p.eye} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="52" r="48" fill={`url(#${gid})`} />
      <g transform={`translate(50 56) scale(${s}) translate(-50 -56)`}>
        {/* far wing */}
        <path d="M46 46 L28 14 L38 30 L22 22 L36 40 L20 38 L40 52 Z" fill={p.membrane} opacity="0.75" />
        {/* tail */}
        <path d="M34 62 Q18 66 12 78 Q20 72 30 70 Q22 82 10 84 L18 86 Q32 82 40 68 Z" fill={p.body} />
        {/* body */}
        <ellipse cx="48" cy="60" rx="20" ry="13" fill={p.body} />
        <ellipse cx="50" cy="66" rx="15" ry="7" fill={p.belly} />
        {/* legs */}
        <path d="M40 68 L38 80 L44 80 L45 70Z M56 68 L56 80 L62 80 L61 68Z" fill={p.back} />
        {/* neck + head */}
        <path d="M60 54 Q68 44 70 34 L78 34 Q76 48 66 60 Z" fill={p.body} />
        <path d="M68 28 Q76 22 86 28 L92 32 Q88 36 80 37 L70 38 Q65 34 68 28 Z" fill={p.body} />
        <path d="M72 26 L64 14 L76 24 Z M78 25 L74 12 L82 24Z" fill={p.horn} />
        <circle cx="79" cy="30" r="2.2" fill={p.eye} />
        {/* spines */}
        <path d="M36 49 l3 -6 l3 6 M44 47 l3 -6 l3 6 M52 47 l3 -6 l3 6" fill={p.back} />
        {/* near wing */}
        <path d="M54 50 L70 8 L68 26 L82 14 L70 36 L86 32 L60 56 Z" fill={p.membrane} />
        <path d="M54 50 L70 8" stroke={p.back} strokeWidth="2" />
      </g>
    </svg>
  )
}

export function EggIcon({ genome, size = 56, glow = 0 }: { genome: Genome; size?: number; glow?: number }) {
  const [shell, speck] = eggColors(express(genome))
  const gid = 'e' + useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 60 72" width={size} height={size * 1.2} aria-hidden style={{ filter: glow ? `drop-shadow(0 0 ${6 + glow * 18}px ${speck})` : undefined }}>
      <defs>
        <radialGradient id={gid} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="35%" stopColor={shell} />
          <stop offset="100%" stopColor={speck} />
        </radialGradient>
      </defs>
      <path d="M30 4 C46 4 56 30 56 46 C56 60 44 68 30 68 C16 68 4 60 4 46 C4 30 14 4 30 4 Z" fill={`url(#${gid})`} />
      <circle cx="22" cy="42" r="3" fill={speck} opacity="0.8" />
      <circle cx="38" cy="30" r="2.2" fill={speck} opacity="0.8" />
      <circle cx="36" cy="54" r="3.4" fill={speck} opacity="0.7" />
      <circle cx="18" cy="26" r="1.8" fill={speck} opacity="0.7" />
    </svg>
  )
}

export function Icon({ name, className = 'h-4 w-4' }: { name: 'berry' | 'fish' | 'dragon' | 'egg'; className?: string }) {
  switch (name) {
    case 'berry':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="9" cy="14" r="5" fill="#ef4444" />
          <circle cx="15.5" cy="15" r="4.5" fill="#dc2626" />
          <path d="M12 9 Q12 4 16 3" stroke="#4ade80" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'fish':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path d="M3 12 Q9 5 16 12 Q9 19 3 12 Z" fill="#cbd5e1" />
          <path d="M16 12 L22 7 L21 12 L22 17 Z" fill="#94a3b8" />
          <circle cx="7" cy="11" r="1" fill="#0b0f1a" />
        </svg>
      )
    case 'egg':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path d="M12 2 C17 2 20 10 20 15 C20 19 16 22 12 22 C8 22 4 19 4 15 C4 10 7 2 12 2Z" fill="#f5b041" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M4 15 Q6 9 12 9 L15 4 L16 9 L21 7 L18 12 Q20 17 14 18 L10 21 L10 18 Q5 18 4 15Z" />
        </svg>
      )
  }
}
