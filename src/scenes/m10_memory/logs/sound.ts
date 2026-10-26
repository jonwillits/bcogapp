import type { Sound } from '../../../sim/memory/logs/features'

/**
 * The night's sounds, synthesized in the browser (no recordings, nothing
 * to license): crickets, frogs, or wind with an owl's hoot, and the young's
 * call. Audio starts only after a click, and *Mute* silences it. Nothing
 * here reads the sim beyond which sound the night has, so sound can never
 * tell a full log from an empty one.
 */

type Ctx = AudioContext

export class NightSound {
  private ctx: Ctx | null = null
  private master: GainNode | null = null
  private nodes: AudioNode[] = []
  private timers: ReturnType<typeof setTimeout>[] = []
  private current: Sound | null = null
  muted = false

  private ensure(): Ctx | null {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return null
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.25
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.25, this.ctx.currentTime, 0.05)
  }

  /** Start a night's sound; the same sound running is left alone. */
  play(sound: Sound): void {
    if (this.current === sound && this.nodes.length) return
    this.stop()
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    this.current = sound
    if (sound === 'crickets') this.crickets(ctx)
    else if (sound === 'frogs') this.frogs(ctx)
    else this.wind(ctx)
  }

  stop(): void {
    for (const n of this.nodes) {
      try {
        ;(n as OscillatorNode).stop?.()
      } catch {
        /* already stopped */
      }
      n.disconnect()
    }
    this.nodes = []
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
    this.current = null
  }

  private noise(ctx: Ctx): AudioBufferSourceNode {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let seed = 7
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      d[i] = (seed / 4294967296) * 2 - 1
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    return src
  }

  /** Crickets: a 4.2 kHz tone chopped at about 30 Hz, in chirps of a third of a second, several a second. */
  private crickets(ctx: Ctx): void {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 4200
    const chop = ctx.createOscillator()
    chop.frequency.value = 30
    const chopGain = ctx.createGain()
    chopGain.gain.value = 0.5
    const env = ctx.createGain()
    env.gain.value = 0
    chop.connect(chopGain)
    chopGain.connect(env.gain)
    osc.connect(env)
    env.connect(this.master!)
    osc.start()
    chop.start()
    this.nodes.push(osc, chop, chopGain, env)
    const chirp = () => {
      const t = ctx.currentTime
      env.gain.setTargetAtTime(0.5, t, 0.02)
      env.gain.setTargetAtTime(0, t + 0.3, 0.03)
      this.timers.push(setTimeout(chirp, 420 + Math.sin(t * 3) * 80))
    }
    chirp()
  }

  /** Frogs: a low croak, a 180 Hz tone swept down with a rough 25 Hz modulation, every second or two. */
  private frogs(ctx: Ctx): void {
    const env = ctx.createGain()
    env.gain.value = 0
    env.connect(this.master!)
    this.nodes.push(env)
    const croak = () => {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      const t = ctx.currentTime
      osc.frequency.setValueAtTime(220, t)
      osc.frequency.exponentialRampToValueAtTime(150, t + 0.35)
      const filt = ctx.createBiquadFilter()
      filt.type = 'lowpass'
      filt.frequency.value = 600
      const mod = ctx.createOscillator()
      mod.frequency.value = 25
      const modGain = ctx.createGain()
      modGain.gain.value = 0.4
      mod.connect(modGain)
      modGain.connect(filt.gain)
      osc.connect(filt)
      filt.connect(env)
      env.gain.setTargetAtTime(0.6, t, 0.03)
      env.gain.setTargetAtTime(0, t + 0.35, 0.06)
      osc.start(t)
      osc.stop(t + 0.6)
      mod.start(t)
      mod.stop(t + 0.6)
      this.timers.push(setTimeout(croak, 1100 + ((t * 7) % 1) * 900))
    }
    croak()
  }

  /** Wind: filtered noise whose gain swells slowly, with an owl's hoot every ten seconds or so: two low tones, the second lower. */
  private wind(ctx: Ctx): void {
    const src = this.noise(ctx)
    const filt = ctx.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.value = 400
    filt.Q.value = 0.6
    const swell = ctx.createOscillator()
    swell.frequency.value = 0.12
    const swellGain = ctx.createGain()
    swellGain.gain.value = 0.25
    const env = ctx.createGain()
    env.gain.value = 0.35
    swell.connect(swellGain)
    swellGain.connect(env.gain)
    src.connect(filt)
    filt.connect(env)
    env.connect(this.master!)
    src.start()
    swell.start()
    this.nodes.push(src, filt, swell, swellGain, env)
    const hoot = () => {
      const t = ctx.currentTime
      for (const [at, f, len] of [
        [0, 330, 0.35],
        [0.5, 290, 0.6],
      ] as const) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = f
        const g = ctx.createGain()
        g.gain.value = 0
        osc.connect(g)
        g.connect(this.master!)
        g.gain.setTargetAtTime(0.5, t + at, 0.05)
        g.gain.setTargetAtTime(0, t + at + len, 0.08)
        osc.start(t + at)
        osc.stop(t + at + len + 0.4)
      }
      this.timers.push(setTimeout(hoot, 9000 + ((t * 13) % 1) * 4000))
    }
    this.timers.push(setTimeout(hoot, 2000))
  }

  /** The young's call: a short run of high chirps. */
  call(): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    for (let k = 0; k < 5; k++) {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(1800 + k * 60, t + k * 0.16)
      osc.frequency.exponentialRampToValueAtTime(2600, t + k * 0.16 + 0.1)
      const g = ctx.createGain()
      g.gain.value = 0
      osc.connect(g)
      g.connect(this.master)
      g.gain.setTargetAtTime(0.5, t + k * 0.16, 0.01)
      g.gain.setTargetAtTime(0, t + k * 0.16 + 0.1, 0.02)
      osc.start(t + k * 0.16)
      osc.stop(t + k * 0.16 + 0.3)
    }
  }
}
