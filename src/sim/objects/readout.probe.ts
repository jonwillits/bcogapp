import { it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeRng } from '../random'
import { loadShippedModel } from './loadModels.node'
import { penultimate } from './net'
import { decodeGrayPng } from './png.node'
import { makeReadout, readoutEvidence, readoutLearn, readoutSays, DEFAULT_READOUT_RATE } from './readout'
import { CONDITIONS, LEARNED_VIEWS, TEST_VIEWS, WOBBLE_FRAMES, viewTrials, type ViewSet } from './views'
import { byHand, emptyCounts, tally } from '../fish/sdt'

/**
 * crib: Part 3's readout, measured. For every target shoe, both sets and
 * several seeds: steps to 95% on the training images, then d′ per
 * condition on the 24-trial test, and the view-generalization curve.
 *
 *   PROBE=1 PROBE_DIR=src/sim/objects npx vitest run --disable-console-intercept -t "crib: readout"
 */
const SCANNED = join(__dirname, '..', '..', '..', 'public', 'm08', 'scanned')
const manifest = JSON.parse(readFileSync(join(SCANNED, 'manifest.json'), 'utf-8')) as { objects: { id: string; set: string }[] }
const SEEDS = [1000, 1001, 1002, 1003, 1004]
const MAX_STEPS = 500

it('crib: readout d′ per condition', () => {
  const model = loadShippedModel('photo_standard')
  const feats = new Map<string, Float32Array>()
  const feat = (obj: string, view: string) => {
    const key = `${obj}/${view}`
    let f = feats.get(key)
    if (!f) {
      f = penultimate(model, decodeGrayPng(readFileSync(join(SCANNED, obj, `${view}.png`))).data)
      feats.set(key, f)
    }
    return f
  }
  const shoes = manifest.objects.filter((o) => o.set === 'shoe').map((o) => o.id)
  const things = manifest.objects.filter((o) => o.set === 'other').map((o) => o.id)
  // Typical feature statistics, for the record.
  let sum = 0, sumsq = 0, n = 0
  for (const o of [...shoes, ...things]) for (const v of LEARNED_VIEWS) for (const x of feat(o, v)) { sum += x; sumsq += x * x; n++ }
  const mean = sum / n
  console.log(`penultimate activity over learned views: mean ${mean.toFixed(3)}, sd ${Math.sqrt(sumsq / n - mean * mean).toFixed(3)}`)

  const summary: Record<string, number[]> = {}
  for (const set of ['shoes', 'things'] as ViewSet[]) {
    const others = (target: string) => (set === 'shoes' ? shoes.filter((s) => s !== target) : things)
    for (const target of shoes) {
      const lines: string[] = []
      for (const seed of SEEDS) {
        const rng = makeRng(seed)
        const unit = makeReadout(rng)
        // Training images: the wobble frames of both learned views, for the target (1) and the others (0).
        const train: { x: Float32Array; a: 0 | 1 }[] = []
        for (const lv of LEARNED_VIEWS) for (const f of WOBBLE_FRAMES[lv]) {
          train.push({ x: feat(target, f), a: 1 })
          for (const o of others(target)) train.push({ x: feat(o, f), a: 0 })
        }
        let steps = 0
        let reached = -1
        const order = () => train[rng.int(train.length)]
        while (steps < MAX_STEPS) {
          const ex = order()
          readoutLearn(unit, ex.x, ex.a, DEFAULT_READOUT_RATE)
          steps++
          if (steps % 10 === 0) {
            const right = train.filter((e) => readoutSays(unit, e.x) === (e.a === 1)).length / train.length
            if (right >= 0.95) { reached = steps; break }
          }
        }
        const trials = viewTrials(target, others(target), rng)
        const d: Record<string, number> = {}
        for (const c of CONDITIONS) {
          const counts = emptyCounts()
          for (const t of trials.filter((x) => x.condition === c)) tally(counts, t.target, readoutSays(unit, feat(t.object, t.view.id)))
          d[c] = byHand(counts).dPrime
          ;(summary[`${set}/${c}`] ??= []).push(d[c])
        }
        ;(summary[`${set}/steps`] ??= []).push(reached)
        lines.push(`seed ${seed}: reached 95% at ${reached < 0 ? 'never' : reached} steps; d′ between ${d.between.toFixed(2)}, beyond ${d.beyond.toFixed(2)}, right angles ${d['right-angles'].toFixed(2)}`)
        if (seed === SEEDS[0] && target === shoes[0]) {
          const curve = [...Array(24)].map((_, i) => readoutEvidence(unit, feat(target, `h${String(i * 15).padStart(3, '0')}`)).toFixed(2))
          console.log(`  curve around the vertical axis (${set}, ${target}): ${curve.join(' ')}`)
        }
      }
      console.log(`${set} / target ${target}:\n  ` + lines.join('\n  '))
    }
  }
  for (const [k, v] of Object.entries(summary)) {
    const s = [...v].sort((a, b) => a - b)
    console.log(`${k}: median ${s[Math.floor(s.length / 2)].toFixed(2)}, range ${s[0].toFixed(2)} to ${s[s.length - 1].toFixed(2)} (n = ${s.length})`)
  }
  // Test views per condition, for the record.
  for (const c of CONDITIONS) console.log(`${c}: ${TEST_VIEWS[c].map((v) => v.id).join(' ')}`)
})
