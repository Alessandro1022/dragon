import { useState } from 'react'
import { online } from '../lib/supabase'
import { saveNow, setUsername, signInWithEmail, signInWithGoogle, signOut } from '../lib/cloud'
import { useGame } from '../store/gameStore'

const STATUS = {
  offline: 'Inte inloggad',
  syncing: 'Synkar…',
  synced: 'Sparat i molnet',
  error: 'Kunde inte synka',
}

/** Sign-in, username and cloud-save status. Hidden when Supabase isn't configured. */
export function AccountSection() {
  const account = useGame((s) => s.account)
  const cloud = useGame((s) => s.cloud)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!online) return null

  if (!account) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-white/65">Logga in för att spara i molnet, synas på topplistan och avla med andra spelares drakar.</p>
        {sent ? (
          <p className="rounded-xl bg-[#4ade80]/10 p-3 text-sm text-[#bbf7d0]">Kolla din mejl och klicka på länken för att logga in.</p>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              const r = await signInWithEmail(email)
              if (r.error) setError(r.error)
              else setSent(true)
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@mejl.se"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-ember/60"
            />
            <button className="rounded-xl bg-white/10 px-4 text-sm font-semibold">Skicka länk</button>
          </form>
        )}
        <button onClick={() => void signInWithGoogle()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-[#1f2937]">
          <svg viewBox="0 0 24 24" className="h-4 w-4">
            <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
            <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
          </svg>
          Fortsätt med Google
        </button>
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 text-sm">
        <div>
          <p className="font-semibold">{account.username ?? 'Inget namn än'}</p>
          <p className="text-xs text-white/50">{account.email}</p>
        </div>
        <span className={`text-xs ${cloud === 'error' ? 'text-red-300' : 'text-white/55'}`}>{STATUS[cloud]}</span>
      </div>
      {!account.username && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            const r = await setUsername(name)
            setError(r.error)
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Välj ett ryttarnamn"
            maxLength={20}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-ember/60"
          />
          <button className="rounded-xl bg-ember px-4 text-sm font-bold text-night">Spara</button>
        </form>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => void saveNow()} className="flex-1 rounded-xl bg-white/8 py-2.5 text-sm font-semibold">
          Spara nu
        </button>
        <button onClick={() => void signOut()} className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-semibold text-white/60">
          Logga ut
        </button>
      </div>
    </div>
  )
}
