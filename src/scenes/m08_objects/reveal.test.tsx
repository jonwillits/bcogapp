import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadShippedModel } from '../../sim/objects/loadModels.node'
import { PartsTab } from './PartsTab'
import { ViewsTab } from './ViewsTab'
import { NoiseTab } from './NoiseTab'
import ObjectsScene from './ObjectsScene'
import type { DisplayManifest, Measurements, MovedPair, PhotosManifest, ScannedManifest } from './data'

/**
 * Commit-then-reveal, tested on rendered markup (spec §9.6, §11): no
 * network answer for a trial set is in the markup before *Commit my
 * answers*, in any of the three tests. And the developer control appears
 * only with `?dev=1`.
 */
const PUB = join(__dirname, '..', '..', '..', 'public', 'm08')
const read = <T,>(p: string) => JSON.parse(readFileSync(join(PUB, p), 'utf-8')) as T
const display = read<DisplayManifest>('drawings/display.json')
const moved = read<{ pairs: MovedPair[] }>('drawings/moved.json')
const photos = read<PhotosManifest>('photos/manifest.json')
const scanned = read<ScannedManifest>('scanned/manifest.json')
const measurements = read<Measurements>('measurements.json')
const model = loadShippedModel('drawing')

describe('Parts: nothing from the network before the commit', () => {
  const answers = new Array(12).fill('cat')
  const before = renderToStaticMarkup(<PartsTab seed={7} mode="free" model={model} display={display} moved={moved} measurements={measurements} initial={{ answers, committed: false }} />)
  const after = renderToStaticMarkup(<PartsTab seed={7} mode="free" model={model} display={display} moved={moved} measurements={measurements} initial={{ answers, committed: true }} />)

  it('before: a Commit button, no revealed trial, no network label, no larger-test table, and no category attached to a trial', () => {
    expect(before).toContain('Commit my answers')
    expect(before).not.toMatch(/data-revealed-trial/)
    expect(before).not.toMatch(/network:/)
    expect(before).not.toMatch(/it is: {3}/)
    expect(before).not.toMatch(/>ink removed</)
    expect(before).not.toMatch(/data-revealed/)
    // The trial's drawing is identified by its index only.
    expect(before).toMatch(/data-strokes="trial-0"/)
  })

  it('after: every trial revealed with the truth, the answer and the network’s label, and the larger test', () => {
    expect((after.match(/data-revealed-trial="/g) ?? []).length).toBe(12)
    expect(after).toMatch(/network: /)
    expect(after).toContain('it is:')
    expect(after).toMatch(/>ink removed</)
    expect(after).toContain('At the joints')
    expect(after).not.toMatch(/>Commit my answers</)
  })

  it('the seed fixes the trials', () => {
    const a = renderToStaticMarkup(<PartsTab seed={7} mode="free" model={model} display={display} moved={moved} measurements={measurements} />)
    const b = renderToStaticMarkup(<PartsTab seed={7} mode="free" model={model} display={display} moved={moved} measurements={measurements} />)
    const c = renderToStaticMarkup(<PartsTab seed={8} mode="free" model={model} display={display} moved={moved} measurements={measurements} />)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})

describe('Views: nothing from the readout before the commit', () => {
  const answers = new Array(24).fill('same')
  const before = renderToStaticMarkup(<ViewsTab seed={7} mode="free" manifest={scanned} initial={{ phase: 'test', answers, committed: false }} />)
  const after = renderToStaticMarkup(<ViewsTab seed={7} mode="free" manifest={scanned} initial={{ phase: 'done', answers, committed: true }} />)

  it('before: a Commit button, no scorecard, no readout scorecard, no curve, no trial list naming the target', () => {
    expect(before).toContain('Commit my answers')
    expect(before).not.toMatch(/data-scorecard/)
    expect(before).not.toMatch(/data-readout-scorecards/)
    expect(before).not.toMatch(/data-curve/)
    expect(before).not.toMatch(/the target {2}/)
    expect(before).not.toMatch(/readout: (same|not)/)
  })

  it('after: the student’s three scorecards, and the trial list', () => {
    expect((after.match(/data-scorecard="you\//g) ?? []).length).toBe(3)
    expect(after).toContain('Go on to Set 2')
    expect(after).toContain('The trials, revealed')
    expect(after).not.toContain('Commit my answers')
  })
})

describe('Noise: nothing from the networks before the commit', () => {
  const answers = new Array(36).fill('car')
  const before = renderToStaticMarkup(<NoiseTab seed={7} mode="free" noise={{ A: 0.2, B: 0.35 }} photos={photos} measurements={measurements} initial={{ answers, committed: false }} />)
  const after = renderToStaticMarkup(<NoiseTab seed={7} mode="free" noise={{ A: 0.2, B: 0.35 }} photos={photos} measurements={measurements} initial={{ answers, committed: true }} />)

  it('before: no revealed trial, no percent table, no larger test, and no category or file attached to a trial', () => {
    expect(before).toContain('Commit my answers')
    expect(before).not.toMatch(/data-revealed-trial/)
    expect(before).not.toMatch(/Percent correct on the thirty-six/)
    expect(before).not.toMatch(/it is: /)
    expect(before).not.toMatch(/held-out photographs/)
    for (const img of photos.images) expect(before).not.toContain(img.file)
  })

  it('after: the table with the three networks, the student and chance; every trial revealed', () => {
    expect(after).toContain('Percent correct on the thirty-six')
    expect(after).toContain('chance (1 in 16)')
    expect((after.match(/data-revealed-trial="/g) ?? []).length).toBe(36)
    expect(after).toContain('held-out photographs')
  })
})

describe('the developer control', () => {
  it('appears only with ?dev=1', () => {
    expect(renderToStaticMarkup(<ObjectsScene dev={false} />)).not.toMatch(/data-dev-control/)
    expect(renderToStaticMarkup(<ObjectsScene dev={true} />)).toMatch(/data-dev-control/)
  })
})
