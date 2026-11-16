/**
 * The Open tab's test sound (spec §4, Headphones): a short, soft tone, so
 * that a student can set a comfortable volume once before any step plays
 * speech. It is a plain tone from the Web Audio oscillator, not speech:
 * no speech is synthesized in the browser (spec §3). Audio starts only on
 * a click, and nothing is recorded.
 */
export function playTestSound(): boolean {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return false
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = 440
  gain.gain.value = 0
  osc.connect(gain)
  gain.connect(ctx.destination)
  const t = ctx.currentTime
  gain.gain.setTargetAtTime(0.2, t, 0.02)
  gain.gain.setTargetAtTime(0, t + 0.6, 0.05)
  osc.start(t)
  osc.stop(t + 1.0)
  osc.onended = () => void ctx.close()
  return true
}
