import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../../components/Panel'
import { randomSeed } from '../../sim/random'
import type { Drawing } from '../../sim/objects/raster'
import { DEFAULT_MODES, MODE_LABEL, TEST_LABEL, type TestId, type TestMode } from '../../sim/objects/config'
import { DEFAULT_NOISE, NOISE_A_RANGE, NOISE_B_RANGE } from '../../sim/objects/noise'
import { Slider } from '../../components/controls'
import { NETWORKS_LINE, TRAINED_BEFORE_LINE } from './lines'
import { Btn, Content, GrayImage, Note, TabBar, type Tab } from './ui'
import { Section } from '../../components/Section'
import { loadGray, photoPath, useJson, type PhotosManifest } from './data'
import { addNoise } from '../../sim/objects/noise'
import { makeRng } from '../../sim/random'
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
 */

export interface SceneConfig {
  modes: Record<TestId, TestMode>
  noise: { A: number; B: number }
}

export const DEFAULT_CONFIG: SceneConfig = { modes: { ...DEFAULT_MODES }, noise: { ...DEFAULT_NOISE } }

/** `?dev=1` in the page's query or after the hash route shows the developer control (spec §7). */
export function isDev(search = typeof window !== 'undefined' ? window.location.search : '', hash = typeof window !== 'undefined' ? window.location.hash : ''): boolean {
  return /[?&]dev=1\b/.test(search) || /[?&]dev=1\b/.test(hash)
}

export const ABOUT_LINE = 'About this scene: every test is taken by you first, then by a network on the same images. Nothing a network answers is shown until you commit.'

export default function ObjectsScene({ dev: devGiven }: { dev?: boolean } = {}) {
  const [tab, setTab] = useState<Tab>('draw')
  const [seed, setSeed] = useState(() => randomSeed())
  const [config, setConfig] = useState<SceneConfig>(DEFAULT_CONFIG)
  // The student's drawing from the Draw tab, kept across tabs: Part 2's Step 2 and the Closer start from it (Jon, 2026-10-12).
  const [drawing, setDrawing] = useState<Drawing>([])
  const dev = devGiven ?? isDev()
  useEffect(() => {
    const on = () => setSeed((s) => s)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

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
        {dev && <DevControl config={config} onChange={setConfig} />}
      </Panel>
    ),
    [tab, seed, dev, config],
  )

  if (tab === 'parts') return <PartsTab key={seed} seed={seed} mode={config.modes.parts} header={header} fromPart1={drawing} />
  if (tab === 'views') return <ViewsTab key={seed} seed={seed} mode={config.modes.views} header={header} />
  if (tab === 'noise') return <NoiseTab key={seed} seed={seed} mode={config.modes.noise} noise={config.noise} header={header} />
  if (tab === 'closer') return <CloserTab seed={seed} header={header} fromPart1={drawing} />
  return <DrawTab seed={seed} header={header} drawing={drawing} onDrawing={setDrawing} />
}

/** One photograph clean and under both noises at the strengths now set, so they can be judged without taking the test. Developer control only. */
function NoisePreview({ noise }: { noise: { A: number; B: number } }) {
  const photos = useJson<PhotosManifest>('photos/manifest.json')
  const [px, setPx] = useState<Float32Array | null>(null)
  const file = photos?.images.find((i) => i.category === 'dog')?.file ?? photos?.images[0]?.file
  useEffect(() => {
    if (!file) return
    let live = true
    loadGray(photoPath(file), 160).then((p) => { if (live) setPx(p) }).catch(() => {})
    return () => { live = false }
  }, [file])
  const shown = useMemo(() => (px ? [px, addNoise(px, 'A', noise.A, makeRng(1)), addNoise(px, 'B', noise.B, makeRng(2))] : null), [px, noise])
  if (!shown) return null
  return (
    <div style={{ display: 'flex', gap: 4 }} data-noise-preview>
      {(['clean', 'A', 'B'] as const).map((k, i) => (
        <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--text-muted)' }}>
          <GrayImage image={shown[i]} size={160} display={84} alt={`preview, ${k}`} />
          {k === 'clean' ? 'clean' : `noise ${k}`}
        </div>
      ))}
    </div>
  )
}

/** Shown only with `?dev=1`: each test's viewing mode, and Part 4's two noise strengths. Removed for a test once Jon has chosen (spec §7). */
export function DevControl({ config, onChange }: { config: SceneConfig; onChange: (c: SceneConfig) => void }) {
  return (
    <div data-dev-control style={{ display: 'flex', flexDirection: 'column', gap: 6, border: '1px dashed var(--accent)', borderRadius: 8, padding: 8 }}>
      <Section title="Developer control" defaultOpen={false}>
      {(Object.keys(config.modes) as TestId[]).map((t) => (
        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
          <span style={{ flex: 1 }}>{TEST_LABEL[t]}</span>
          {(['glimpse', 'free'] as TestMode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={config.modes[t] === m}
              onClick={() => onChange({ ...config, modes: { ...config.modes, [t]: m } })}
              style={{ padding: '2px 8px', fontSize: 11, borderRadius: 999, border: '1px solid var(--border)', background: config.modes[t] === m ? 'var(--accent)' : 'var(--surface-2)', color: config.modes[t] === m ? '#0b111c' : 'var(--text)', cursor: 'pointer' }}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      ))}
      <Slider label="Part 4: noise A strength (share of pixels)" value={config.noise.A} min={NOISE_A_RANGE.min} max={NOISE_A_RANGE.max} step={NOISE_A_RANGE.step} onChange={(v) => onChange({ ...config, noise: { ...config.noise, A: v } })} />
      <Slider label="Part 4: noise B strength (width)" value={config.noise.B} min={NOISE_B_RANGE.min} max={NOISE_B_RANGE.max} step={NOISE_B_RANGE.step} onChange={(v) => onChange({ ...config, noise: { ...config.noise, B: v } })} />
      <NoisePreview noise={config.noise} />
      <Note>A change of mode or strength takes effect when that part is next opened: switch to another tab and back. The seed, and so the trials, stay the same; <i>New seed</i> is for a fresh set. The sliders touch Part 4 only; Part 2's erasers always remove half the ink.</Note>
      </Section>
    </div>
  )
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
