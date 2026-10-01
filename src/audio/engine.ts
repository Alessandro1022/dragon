/**
 * Procedural sound: everything is synthesised with WebAudio, so the game
 * ships zero audio files. One AudioContext, created on the first user
 * gesture (browsers block audio before that).
 */

let ctx: AudioContext | null = null
let master: GainNode
let musicBus: GainNode
let sfxBus: GainNode
let noiseBuffer: AudioBuffer

export function audioReady() {
  return !!ctx
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.7
  master.connect(ctx.destination)
  musicBus = ctx.createGain()
  musicBus.gain.value = 0.35
  musicBus.connect(master)
  sfxBus = ctx.createGain()
  sfxBus.connect(master)

  // 2 s of white noise, reused by every noisy sound
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
}

export function setVolume(v: number) {
  if (ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05)
}

export function setMusicEnabled(on: boolean) {
  if (ctx) musicBus.gain.setTargetAtTime(on ? 0.35 : 0, ctx.currentTime, 0.3)
}

/** A looping filtered-noise voice whose loudness is set every frame. */
export interface Loop {
  gain: GainNode
  filter: BiquadFilterNode
  set: (level: number, freq?: number) => void
}

export function noiseLoop(type: BiquadFilterType, freq: number, q = 0.7): Loop | null {
  if (!ctx) return null
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = q
  const gain = ctx.createGain()
  gain.gain.value = 0
  src.connect(filter).connect(gain).connect(sfxBus)
  src.start()
  const c = ctx
  return {
    gain,
    filter,
    set: (level, f) => {
      gain.gain.setTargetAtTime(level, c.currentTime, 0.08)
      if (f) filter.frequency.setTargetAtTime(f, c.currentTime, 0.1)
    },
  }
}

/** Short filtered noise burst — wing beats, footsteps, impacts. */
export function burst(freq: number, duration: number, level: number, type: BiquadFilterType = 'lowpass') {
  if (!ctx) return
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(level, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  src.connect(filter).connect(gain).connect(sfxBus)
  src.start(t, Math.random() * 1.5)
  src.stop(t + duration + 0.05)
}

/** Plucked/bell-like tone sequence for UI feedback. */
export function chime(notes: number[], opts: { step?: number; type?: OscillatorType; level?: number; length?: number } = {}) {
  if (!ctx) return
  const { step = 0.08, type = 'triangle', level = 0.18, length = 0.6 } = opts
  const t0 = ctx.currentTime
  notes.forEach((midi, i) => {
    const t = t0 + i * step
    const osc = ctx!.createOscillator()
    osc.type = type
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12)
    const g = ctx!.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(level, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + length)
    osc.connect(g).connect(sfxBus)
    osc.start(t)
    osc.stop(t + length + 0.05)
  })
}

/** Low brass-like horn: the Dragon Guard's alarm. */
export function horn() {
  if (!ctx) return
  const t = ctx.currentTime
  for (const [midi, delay] of [
    [45, 0],
    [52, 0.35],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 700
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t + delay)
    g.gain.linearRampToValueAtTime(0.16, t + delay + 0.08)
    g.gain.setValueAtTime(0.16, t + delay + 0.45)
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.9)
    osc.connect(f).connect(g).connect(sfxBus)
    osc.start(t + delay)
    osc.stop(t + delay + 1)
  }
}

// --- music -----------------------------------------------------------------

const PROGRESSION = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
]
const TENSION = [
  [45, 48, 51],
  [44, 47, 51],
]

let musicTimer: number | null = null
let tense = false

export function setTension(on: boolean) {
  tense = on
}

/** Slow ambient pad; switches to a darker loop while the guard hunts you. */
export function startMusic() {
  if (!ctx || musicTimer !== null) return
  let bar = 0
  const playBar = () => {
    if (!ctx) return
    const chords = tense ? TENSION : PROGRESSION
    const chord = chords[bar % chords.length]
    const t = ctx.currentTime
    const dur = tense ? 2.4 : 4.8
    chord.forEach((midi, i) => {
      for (const detune of [-6, 6]) {
        const osc = ctx!.createOscillator()
        osc.type = i === 0 ? 'sine' : 'triangle'
        osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12)
        osc.detune.value = detune
        const f = ctx!.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = tense ? 600 : 1200
        const g = ctx!.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35)
        g.gain.linearRampToValueAtTime(0, t + dur * 1.05)
        osc.connect(f).connect(g).connect(musicBus)
        osc.start(t)
        osc.stop(t + dur * 1.1)
      }
    })
    if (tense) {
      // pulsing low drum
      for (let k = 0; k < 4; k++) {
        const tt = t + k * (dur / 4)
        const osc = ctx.createOscillator()
        osc.frequency.setValueAtTime(90, tt)
        osc.frequency.exponentialRampToValueAtTime(40, tt + 0.25)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.25, tt)
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.3)
        osc.connect(g).connect(musicBus)
        osc.start(tt)
        osc.stop(tt + 0.35)
      }
    }
    bar++
    musicTimer = window.setTimeout(playBar, dur * 1000)
  }
  playBar()
}
