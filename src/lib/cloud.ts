import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useGame, persistedSlice, type SaveData } from '../store/gameStore'
import { breed, express, rarity, ELEMENTS, type Genome } from '../systems/genetics'
import { uid, view, type DragonData } from '../systems/dragons'

/**
 * Online layer on top of the local game: accounts, cloud saves, the
 * ring-course leaderboard and the breeding exchange. Every function is a
 * no-op (or returns empty) when Supabase isn't configured.
 */

const LOCAL_CHANGED_KEY = 'dragon-local-changed'
const SAVE_DEBOUNCE_MS = 8000

function localChangedAt(): number {
  try {
    return Number(window.localStorage.getItem(LOCAL_CHANGED_KEY) ?? 0)
  } catch {
    return 0
  }
}

function markLocalChange() {
  try {
    window.localStorage.setItem(LOCAL_CHANGED_KEY, String(Date.now()))
  } catch {
    /* storage unavailable */
  }
}

let started = false
let saveTimer: number | null = null
let applyingCloud = false

/** Call once at app start. */
export function initCloud() {
  if (!supabase || started) return
  started = true

  // remember when local progress last changed, and autosave while signed in
  let prev = persistedSlice(useGame.getState())
  useGame.subscribe((s) => {
    const next = persistedSlice(s)
    const changed = (Object.keys(next) as (keyof SaveData)[]).some((k) => next[k] !== prev[k])
    prev = next
    if (!changed || applyingCloud) return
    markLocalChange()
    if (s.account) scheduleSave()
  })

  void supabase.auth.getSession().then(({ data }) => handleSession(data.session))
  supabase.auth.onAuthStateChange((_event, session) => {
    void handleSession(session)
  })
}

async function handleSession(session: Session | null) {
  const s = useGame.getState()
  if (!session) {
    if (s.account) useGame.setState({ account: null, cloud: 'offline' })
    return
  }
  if (s.account?.userId === session.user.id) return
  useGame.setState({
    account: { userId: session.user.id, email: session.user.email ?? null, username: null },
    cloud: 'syncing',
  })
  try {
    const { data: profile } = await supabase!.from('profiles').select('username').eq('id', session.user.id).maybeSingle()
    useGame.setState((st) => ({ account: st.account && { ...st.account, username: profile?.username ?? null } }))
    await syncOnLogin(session.user.id)
    await claimEarnings()
    useGame.setState({ cloud: 'synced' })
  } catch (e) {
    console.error(e)
    useGame.setState({ cloud: 'error' })
  }
}

/** Newest progress wins: load the cloud save if it's newer, otherwise upload ours. */
async function syncOnLogin(userId: string) {
  const { data, error } = await supabase!.from('saves').select('data, updated_at').eq('user_id', userId).maybeSingle()
  if (error) throw error
  const cloudTime = data ? new Date(data.updated_at as string).getTime() : 0
  if (data && cloudTime > localChangedAt()) {
    applyingCloud = true
    useGame.setState({ ...(data.data as SaveData) })
    applyingCloud = false
    useGame.getState().toast('Din molnsparning laddades.', 'gold')
  } else {
    await saveNow()
  }
}

function scheduleSave() {
  if (saveTimer !== null) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void saveNow(), SAVE_DEBOUNCE_MS)
}

export async function saveNow() {
  const s = useGame.getState()
  if (!supabase || !s.account) return
  useGame.setState({ cloud: 'syncing' })
  const { error } = await supabase
    .from('saves')
    .upsert({ user_id: s.account.userId, data: persistedSlice(s), updated_at: new Date().toISOString() })
  useGame.setState({ cloud: error ? 'error' : 'synced' })
}

// --- auth -------------------------------------------------------------------

export async function signInWithEmail(email: string) {
  if (!supabase) return { error: 'offline' }
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
  return { error: error?.message ?? null }
}

export async function signInWithGoogle() {
  if (!supabase) return
  await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
}

export async function signOut() {
  if (!supabase) return
  await saveNow()
  await supabase.auth.signOut()
}

export async function setUsername(name: string) {
  const s = useGame.getState()
  if (!supabase || !s.account) return { error: 'offline' }
  const clean = name.trim()
  if (!/^[\p{L}\p{N}_\- ]{3,20}$/u.test(clean)) return { error: '3–20 tecken: bokstäver, siffror, _ eller -' }
  const { error } = await supabase.from('profiles').upsert({ id: s.account.userId, username: clean })
  if (error) return { error: error.code === '23505' ? 'Namnet är upptaget' : error.message }
  useGame.setState({ account: { ...s.account, username: clean } })
  return { error: null }
}

// --- leaderboard ------------------------------------------------------------

export interface LeaderboardRow {
  username: string
  seconds: number
  user_id: string
}

export async function submitCourseTime(seconds: number) {
  const s = useGame.getState()
  if (!supabase || !s.account?.username) return
  await supabase.from('course_times').insert({ user_id: s.account.userId, username: s.account.username, seconds: Math.round(seconds * 100) / 100 })
}

export async function fetchLeaderboard(limit = 10): Promise<LeaderboardRow[]> {
  if (!supabase) return []
  const { data } = await supabase.from('course_leaderboard').select('username, seconds, user_id').limit(limit)
  return (data ?? []).map((r) => ({ ...r, seconds: Number(r.seconds) })) as LeaderboardRow[]
}

// --- breeding exchange ---------------------------------------------------------

export interface StudListing {
  id: string
  owner_id: string
  owner_name: string
  dragon_id: string
  dragon_name: string
  genome: Genome
  element: string
  rarity: string
  price: number
  created_at: string
}

export async function fetchStuds(): Promise<StudListing[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('stud_listings')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(40)
  return (data ?? []) as StudListing[]
}

export async function listStud(dragon: DragonData, price: number) {
  const s = useGame.getState()
  if (!supabase || !s.account?.username) return { error: 'Välj ett användarnamn först' }
  const v = view(dragon)
  if (!v.stage.rideable) return { error: 'Bara vuxna drakar kan erbjudas' }
  const { error } = await supabase.from('stud_listings').upsert(
    {
      owner_id: s.account.userId,
      owner_name: s.account.username,
      dragon_id: dragon.id,
      dragon_name: dragon.name,
      genome: dragon.genome,
      element: ELEMENTS[v.pheno.element].label,
      rarity: v.rarity,
      price,
      active: true,
    },
    { onConflict: 'owner_id,dragon_id' },
  )
  return { error: error?.message ?? null }
}

export async function unlistStud(listingId: string) {
  if (!supabase) return
  await supabase.from('stud_listings').update({ active: false }).eq('id', listingId)
}

/** Pay a stud's owner and roll an egg from both genomes into your nest. */
export async function breedWithStud(listing: StudListing, myDragonId: string) {
  const s = useGame.getState()
  if (!supabase || !s.account) return { error: 'Logga in först' }
  if (listing.owner_id === s.account.userId) return { error: 'Det är din egen drake' }
  const mine = s.dragons.find((d) => d.id === myDragonId)
  if (!mine || !view(mine).stage.rideable) return { error: 'Välj en vuxen drake' }
  if (s.gold < listing.price) return { error: 'Inte tillräckligt med guld' }

  const { error } = await supabase.from('stud_payments').insert({
    listing_id: listing.id,
    owner_id: listing.owner_id,
    payer_id: s.account.userId,
    amount: listing.price,
  })
  if (error) return { error: error.message }

  const genome = breed(mine.genome, listing.genome)
  useGame.setState({ gold: s.gold - listing.price })
  s.addEgg({ id: uid(), genome, progress: 0, foundAt: Date.now(), source: 'avel' })
  const r = rarity(express(genome))
  s.toast(`${mine.name} × ${listing.dragon_name}: ett nytt ägg (${r.toLowerCase()} anlag)!`, 'gold')
  return { error: null }
}

/** Gold other players paid for your studs while you were away. */
async function claimEarnings() {
  const { data, error } = await supabase!.rpc('claim_stud_earnings')
  if (error || !data) return
  const amount = Number(data)
  if (amount > 0) {
    useGame.setState((st) => ({ gold: st.gold + amount }))
    useGame.getState().toast(`Dina avelsdrakar tjänade ${amount} guld medan du var borta!`, 'gold')
  }
}
