import { useMemo, useState } from 'react'
import { Panel } from '../../components/Panel'
import { randomSeed } from '../../sim/random'
import type { Drawing } from '../../sim/objects/raster'
import { DEFAULT_MODES } from '../../sim/objects/config'
import { NETWORKS_LINE, TRAINED_BEFORE_LINE } from './lines'
import { Btn, Content, Note, TabBar, type Tab } from './ui'
import { DrawTab } from './DrawTab'
import { PartsTab } from './PartsTab'
import { ViewsTab } from './ViewsTab'
import { NoiseTab } from './NoiseTab'
import { CloserTab } from './CloserTab'

/**
 * Module 8's scene: Lab 8, Does It Fail Where We Fail? A satellite scene
 * with no creature and no canvas, like Lab 6, and the first that runs
 * trained deep networks in the browser. Five tabs, one per part. Every
 * part runs the same test twice: the student first, then a network on the
 * same images, with the network's answers hidden until the student commits.
 *
 * Nothing imports the bilaterian engine except Part 3's readout, which is
 * Lab 7's output unit learning by Lab 5's rule (`sim/objects/readout.ts`).
 *
 * Every test's viewing mode was decided on Jon's walk (2026-10-12) and
 * Part 4's noise adapts to the student, so the developer control of spec
 * §7 is retired; `?dev=1` now only exposes the benchmark hook below.
 */

/** `?dev=1` in the page's query or after the hash route shows the developer control (spec §7). */
export function isDev(search = typeof window !== 'undefined' ? window.location.search : '', hash = typeof window !== 'undefined' ? window.location.hash : ''): boolean {
  return /[?&]dev=1\b/.test(search) || /[?&]dev=1\b/.test(hash)
}

export const ABOUT_LINE = 'About this scene: every test is taken by you first, then by a network on the same images. Nothing a network answers is shown until you commit.'

export default function ObjectsScene() {
  const [tab, setTab] = useState<Tab>('draw')
  const [seed, setSeed] = useState(() => randomSeed())
  // The student's drawing from the Draw tab, kept across tabs: Part 2's Step 2 and the Closer start from it (Jon, 2026-10-12).
  const [drawing, setDrawing] = useState<Drawing>([])

  const header = useMemo(
    () => (
      <Panel title="Lab 8: Does It Fail Where We Fail?" style={{ width: 300 }}>
        <TabBar tab={tab} onChange={setTab} />
        <Note>{ABOUT_LINE}</Note>
        <Content>{NETWORKS_LINE}</Content>
        <Content>{TRAINED_BEFORE_LINE}</Content>
        <Note>
          Run seed <span style={{ fontFamily: 'var(--font-mono)' }}>{seed}</span>. It fixes every trial order, the noise, the mask, and the readout’s starting weights.{' '}
          <Btn small onClick={() => setSeed(randomSeed())}>New seed</Btn>
        </Note>
      </Panel>
    ),
    [tab, seed],
  )

  if (tab === 'parts') return <PartsTab key={seed} seed={seed} mode={DEFAULT_MODES.parts} header={header} fromPart1={drawing} />
  if (tab === 'views') return <ViewsTab key={seed} seed={seed} mode={DEFAULT_MODES.views} header={header} />
  if (tab === 'noise') return <NoiseTab key={seed} seed={seed} mode={DEFAULT_MODES.noise} header={header} />
  if (tab === 'closer') return <CloserTab seed={seed} header={header} fromPart1={drawing} />
  return <DrawTab seed={seed} header={header} drawing={drawing} onDrawing={setDrawing} />
}

/**
 * With `?dev=1`, a benchmark hook for the Playwright timing script
 * (`scripts/m08-timing.mjs`): one drawing inference on this thread and one
 * photo inference in the worker, in milliseconds. Not part of the scene.
 */
export async function benchmark(): Promise<{ drawingMs: number; photoMs: number }> {
  const [{ getModel }, { classify }, { classifyWith }] = await Promise.all([import('../../sim/objects/models'), import('../../sim/objects/net'), import('../../sim/objects/inferClient')])
  const drawing = await getModel('drawing')
  const img = new Float32Array(64 * 64)
  for (let i = 0; i < img.length; i++) img[i] = (i * 7919) % 11 < 2 ? 1 : 0
  classify(drawing, img)
  const t0 = performance.now()
  for (let i = 0; i < 10; i++) classify(drawing, img)
  const drawingMs = (performance.now() - t0) / 10
  const photo = new Float32Array(160 * 160)
  for (let i = 0; i < photo.length; i++) photo[i] = ((i * 31) % 97) / 97
  await classifyWith('photo_standard', photo)
  const t1 = performance.now()
  for (let i = 0; i < 5; i++) await classifyWith('photo_standard', photo)
  const photoMs = (performance.now() - t1) / 5
  return { drawingMs, photoMs }
}

if (typeof window !== 'undefined' && isDev()) (window as unknown as { __m08bench: typeof benchmark }).__m08bench = benchmark
