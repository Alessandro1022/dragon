import { useEffect, useState } from 'react'
import { online } from '../lib/supabase'
import { fetchLeaderboard, submitCourseTime, type LeaderboardRow } from '../lib/cloud'
import { useGame } from '../store/gameStore'

/** Global ring-course top list. Submits your finished time once. */
export function Leaderboard({ time }: { time: number }) {
  const account = useGame((s) => s.account)
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)

  useEffect(() => {
    if (!online) return
    let cancelled = false
    void (async () => {
      if (account?.username) await submitCourseTime(time)
      const r = await fetchLeaderboard(8)
      if (!cancelled) setRows(r)
    })()
    return () => {
      cancelled = true
    }
  }, [time, account?.username])

  if (!online) return null
  if (!account?.username) {
    return <p className="mt-3 text-xs text-white/55">Logga in i pausmenyn för att synas på topplistan.</p>
  }
  return (
    <div className="mt-4 text-left">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45">Topplista</p>
      {!rows ? (
        <p className="text-xs text-white/50">Laddar…</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {rows.map((r, i) => (
            <li
              key={r.user_id}
              className={`flex justify-between rounded-lg px-2 py-1 ${r.user_id === account.userId ? 'bg-ember/15 text-white' : 'text-white/75'}`}
            >
              <span>
                <span className="mr-2 inline-block w-4 text-white/40">{i + 1}</span>
                {r.username}
              </span>
              <span className="tabular-nums">{r.seconds.toFixed(1)}s</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
