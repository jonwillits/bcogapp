import { DEFAULT_SETTING, HABITATS, NIGHT, Night, SETTINGS, bestSetting, habitatById, predictedSetting, type Habitat } from '../../sim/rodent/patch'

/**
 * The closer's state (spec §10.1): a habitat, one rule, a night that runs
 * under Skip ahead, Try every setting, and a prediction committed before
 * the second habitat is tried.
 */

export class PatchStore {
  readonly seed: number
  habitat: Habitat = 'rich'
  setting = DEFAULT_SETTING
  night: Night | null = null
  playing = false
  /** Beetles per minute against the setting, per habitat, once tried. */
  readonly curves = new Map<Habitat, { setting: number; perMinute: number }[]>()
  prediction: Habitat | null = null
  committed: Habitat | null = null
  skipping = false
  owed = 0
  badge = ''
  /** Begin pressed: the orienting panel over the view is gone. */
  started = false
  version = 0
  private listeners = new Set<() => void>()
  private nightsRun = 0

  constructor(seed: number) {
    this.seed = seed
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  begin(): void {
    this.started = true
    this.version++
    for (const fn of this.listeners) fn()
  }

  changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  setHabitat(h: Habitat): void {
    this.habitat = h
    this.night = null
    this.playing = false
    this.changed()
  }

  setSetting(s: number): void {
    this.setting = s
    this.changed()
  }

  startNight(): void {
    this.nightsRun++
    this.night = new Night(habitatById(this.habitat), this.setting, this.seed + this.nightsRun * 17)
    this.playing = true
    this.changed()
  }

  tick(dt: number): void {
    if (!this.playing || !this.night || this.skipping) return
    this.night.step(dt)
    if (this.night.time >= NIGHT) this.playing = false
  }

  /** Skip the rest of the night, in slices. */
  skipNight(bump: () => void): void {
    if (!this.night || this.skipping) return
    this.skipping = true
    const pay = () => {
      if (!this.night) return
      const left = NIGHT - this.night.time
      const n = Math.min(900, left)
      this.night.run(n)
      this.badge = `Skipping ahead — ${Math.round((NIGHT - this.night.time) / 60)} min of the night to go`
      bump()
      if (this.night.time < NIGHT - 1e-6) setTimeout(pay, 0)
      else {
        this.skipping = false
        this.playing = false
        this.badge = ''
        this.changed()
      }
    }
    setTimeout(pay, 0)
  }

  /** Try every setting: ten seeded nights, in slices of one night per timer tick. */
  tryEvery(bump: () => void): void {
    if (this.skipping) return
    this.skipping = true
    const h = habitatById(this.habitat)
    const curve: { setting: number; perMinute: number }[] = []
    let i = 0
    const next = () => {
      // The same seeds `tryEverySetting` uses, one night per timer tick.
      const night = new Night(h, SETTINGS[i], this.seed + i * 7)
      night.run(NIGHT)
      curve.push({ setting: SETTINGS[i], perMinute: night.result().perMinute })
      this.badge = `Trying every setting — ${i + 1} of ${SETTINGS.length}`
      bump()
      i++
      if (i < SETTINGS.length) setTimeout(next, 0)
      else {
        this.curves.set(this.habitat, curve)
        this.skipping = false
        this.badge = ''
        this.changed()
      }
    }
    setTimeout(next, 0)
  }

  predict(h: Habitat): void {
    if (this.committed) return
    this.prediction = h
    this.changed()
  }

  commit(): void {
    if (!this.prediction || this.committed) return
    this.committed = this.prediction
    this.changed()
  }

  /** The fixed lines over the night. */
  lines(): (string | null)[] {
    const n = this.night
    if (!n) return ['No night run yet', null, null, null]
    const r = n.result()
    const row = (label: string, value: string, unit: string) => `${label.padEnd(20)}${value.padStart(6)}${unit ? ` ${unit}` : ''}`
    return [row('Night', (n.time / 3600).toFixed(2), `h of ${NIGHT / 3600}`), row('Beetles found', String(r.beetles), ''), row('Patches visited', String(r.patches), ''), row('Beetles per minute', r.perMinute.toFixed(2), '')]
  }

  bestFor(h: Habitat): number | null {
    const c = this.curves.get(h)
    return c ? bestSetting(c) : null
  }

  predicted(h: Habitat): number {
    return predictedSetting(habitatById(h))
  }

  /** The answer, shown only after the commit: which habitat's best setting is sooner. */
  answer(): string | null {
    if (!this.committed) return null
    const rich = this.bestFor('rich')
    const poor = this.bestFor('poor')
    if (rich === null || poor === null) return 'Try every setting in both habitats to see the answer'
    return rich < poor ? 'The best rule leaves sooner in the rich habitat' : rich > poor ? 'The best rule leaves sooner in the poor habitat' : 'The best settings came out the same'
  }

  static habitats = HABITATS
}
