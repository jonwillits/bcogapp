import { useMemo, useState, type ReactNode } from 'react'
import { Panel } from '../../components/Panel'
import { Toggle } from '../../components/controls'
import { makeRng } from '../../sim/random'
import { chw, classify, match, run, topK, type Model, type Tensor } from '../../sim/objects/net'
import { normalize, rasterize, transform, SCALE, type Drawing } from '../../sim/objects/raster'
import { DrawPad } from './DrawPad'
import { LayerStrip } from './LayerStrip'
import { TolerancePlot } from './TolerancePlot'
import { BUILT_IN_LINE, POOLING_LINE, PRIVACY_LINE } from './lines'
import { useJson, useModel, type Measurements } from './data'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, ObjectsLayout, PANEL_STYLE, RIGHT_STYLE, StageTitle, StrokesView } from './ui'

/**
 * Part 1, Inside the Stack (spec §6.1): draw, look inside, the shift and
 * turn tests layer by layer, where the size tolerance came from, and
 * Version B.
 */
export const SHIFTS = [2, 4, 6, 8]
export const TURNS = [45, 90, 180]
const SHIFT_COLORS = ['#ffd166', '#5ee6d6', '#ff6fae', '#4f9cff']
const TURN_COLORS = ['#ffd166', '#ff6fae', '#4f9cff']
export const LAYER_NAMES = ['input', 'pooled 1', 'pooled 2', 'pooled 3', 'pooled 4']

export const CENTER_LABEL = 'Center and scale the drawing first'
export const VERSION_B_LABEL = 'Version B: trained on shifted, turned and resized copies'
export const CENTERING_BLOCKS_LINE = 'With centering on, a shift or a turn of the drawing is undone before the network receives it. Turn it off to run the shift and turn tests on the network itself.'

/** The drawing as the network receives it. */
export function prepared(drawing: Drawing, centered: boolean): Drawing {
  return centered ? normalize(drawing) : drawing
}

/** Match per layer (input and each pooled layer) between the network's activity for one drawing and another. */
export function layerMatches(model: Model, a: Map<string, Tensor>, b: Map<string, Tensor>): number[] {
  const names = ['input', ...(model.desc.layers ?? []).map((l) => l.pooled)]
  return names.map((n) => match(chw(a.get(n)!), chw(b.get(n)!)))
}

export function DrawTab({ seed, header, model: givenModel, measurements: givenM, initial }: { seed: number; header?: ReactNode; model?: Model; measurements?: Measurements; initial?: { drawing?: Drawing; centered?: boolean } }) {
  const [drawing, setDrawing] = useState<Drawing>(initial?.drawing ?? [])
  const [kept, setKept] = useState<Drawing | null>(null)
  const [centered, setCentered] = useState(initial?.centered ?? true)
  const [versionB, setVersionB] = useState(false)
  const modelA = useModel('drawing', givenModel)
  const modelB = useModel(versionB ? 'drawing_b' : null)
  const model = versionB ? modelB : modelA
  const measurements = useJson<Measurements>('measurements.json', givenM)
  const prompt = useMemo(() => {
    const labels = modelA?.desc.labels ?? []
    return labels.length ? labels[makeRng(seed ^ 0x8a1).int(labels.length)] : '…'
  }, [seed, modelA])

  const input = drawing.length ? prepared(drawing, centered) : null
  const tensors = useMemo(() => (model && input ? run(model, rasterize(input)) : null), [model, input])
  const probs = tensors && model ? tensors.get(model.desc.outputs.probs)!.data : null
  const top = probs && model ? topK(probs, 5).map((k) => `${model.desc.labels[k.label].padEnd(12)} ${k.p.toFixed(2)}`) : [null, null, null, null, null]

  const tolerance = useMemo(() => {
    if (!model || !input || !tensors || centered) return null
    const shifts = SHIFTS.map((px, i) => ({ label: `${px} px`, color: SHIFT_COLORS[i], match: layerMatches(model, tensors, run(model, rasterize(transform(input, { dx: px / SCALE })))) }))
    const turns = TURNS.map((deg, i) => ({ label: `${deg}°`, color: TURN_COLORS[i], match: layerMatches(model, tensors, run(model, rasterize(transform(input, { angleDeg: deg })))) }))
    const turnedLabels = TURNS.map((deg) => { const o = classify(model, rasterize(transform(input, { angleDeg: deg }))); return `${deg}°: ${model.desc.labels[o.top].padEnd(12)} ${o.probs[o.top].toFixed(2)}` })
    return { shifts, turns, turnedLabels }
  }, [model, input, tensors, centered])

  const change = (f: (d: Drawing) => Drawing) => { if (!kept) setKept(drawing); setDrawing(f(drawing)) }
  const restore = () => { if (kept) { setDrawing(kept); setKept(null) } }

  const left = (
    <Panel title="Inside the stack" style={PANEL_STYLE}>
      <Note>Draw on the pad. After each stroke the five most likely labels appear. The strip on the right shows every layer’s activity for your drawing.</Note>
      <GroupLabel>The drawing the network receives</GroupLabel>
      <Toggle label={CENTER_LABEL} checked={centered} onChange={setCentered} />
      <Content>{BUILT_IN_LINE}</Content>
      <Note>This is the dataset’s own step: the drawing’s box is moved to the middle and its longer side stretched to fill the square. Draw small in a corner with it off, and watch the labels.</Note>
      <GroupLabel>Change the drawing</GroupLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <Btn small onClick={() => change((d) => transform(d, { angleDeg: 180 }))} disabled={!drawing.length}>Turn it upside down</Btn>
        <Btn small onClick={() => change((d) => d.map((s) => [s[0].map((x) => 255 - x), s[1]]))} disabled={!drawing.length}>Mirror it</Btn>
        <Btn small onClick={() => change((d) => d.map((s) => [s[0], s[1].map((y) => (y - 127.5) * 0.5 + 127.5)]))} disabled={!drawing.length}>Squash it flat</Btn>
        <Btn small onClick={() => change((d) => d.map((s) => [s[0].map((x) => (x - 127.5) * 0.5 + 127.5), s[1]]))} disabled={!drawing.length}>Squeeze it thin</Btn>
        <Btn small onClick={restore} disabled={!kept}>Restore the drawing</Btn>
      </div>
      <GroupLabel>Version B</GroupLabel>
      <Toggle label={VERSION_B_LABEL} checked={versionB} onChange={setVersionB} />
      <Note>The same network, trained on copies of each drawing shifted, turned and resized at random (§7.2.9). Turn a drawing upside down under each version, then find a change Version B was not trained on.</Note>
      {measurements && (
        <Note>
          Measured over 200 held-out drawings: upside down, Version A names {Math.round(measurements.part1.untrained.a.turn180 * 100)}% and Version B {Math.round(measurements.part1.untrained.b.turn180 * 100)}%; squashed flat, {Math.round(measurements.part1.untrained.a.stretchWide * 100)}% and {Math.round(measurements.part1.untrained.b.stretchWide * 100)}%; mirrored, {Math.round(measurements.part1.untrained.a.mirror * 100)}% and {Math.round(measurements.part1.untrained.b.mirror * 100)}%.
        </Note>
      )}
      <Content>{PRIVACY_LINE}</Content>
    </Panel>
  )

  const stage = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StageTitle sub={model ? `${versionB ? 'Version B' : 'Version A'} · 24 categories · ${model.desc.input.size} × ${model.desc.input.size} input` : 'Loading the drawing network…'}>Part 1 — Inside the Stack</StageTitle>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <DrawPad drawing={drawing} onChange={(d) => { setKept(null); setDrawing(d) }} prompt={prompt} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>As the network receives it (64 × 64)</div>
          {input ? <StrokesView strokes={input} display={128} testId="as-received" /> : <div style={{ width: 128, height: 128, borderRadius: 6, border: '1px dashed var(--border)' }} />}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>The five most likely labels</div>
          <FixedLines lines={top} />
        </div>
      </div>
      <GroupLabel>Look inside</GroupLabel>
      <Content>{POOLING_LINE}</Content>
      {model && <LayerStrip model={model} tensors={tensors} probs={probs} />}
      <GroupLabel>Tolerance, layer by layer</GroupLabel>
      {centered ? (
        <Note data-tolerance="off">{CENTERING_BLOCKS_LINE}</Note>
      ) : tolerance ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }} data-tolerance="on">
          <TolerancePlot layers={LAYER_NAMES} series={tolerance.shifts} title="Shift test: the drawing moved right" />
          <TolerancePlot layers={LAYER_NAMES} series={tolerance.turns} title="Turn test: the drawing turned" />
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>The label after each turn</div>
            <FixedLines lines={tolerance.turnedLabels} />
          </div>
        </div>
      ) : (
        <Note>Draw something, with centering off, to run the shift and turn tests.</Note>
      )}
      <Note>Each line is one change; each point is how closely that layer’s activity for the changed drawing matches its activity for the original (a correlation, 1 for identical). The shift test moves the drawing 2 to 8 pixels right. The turn test turns it 45°, 90° and 180°.</Note>
    </div>
  )

  const right = (
    <Panel title="What to look for" style={RIGHT_STYLE}>
      {measurements ? (
        <>
          <Note>Measured when the lab was built, over {measurements.part1.a.n} held-out drawings (Version A):</Note>
          <GroupLabel>Shift</GroupLabel>
          <FixedLines lines={SHIFTS.map((px) => `${String(px).padStart(2)} px: ` + measurements.part1.a.shift[String(px)].match.map((m) => m.toFixed(2)).join('  ') + `  named ${Math.round(measurements.part1.a.shift[String(px)].accuracy * 100)}%`)} />
          <GroupLabel>Turn</GroupLabel>
          <FixedLines lines={TURNS.map((deg) => `${String(deg).padStart(3)}°: ` + measurements.part1.a.turn[String(deg)].match.map((m) => m.toFixed(2)).join('  ') + `  named ${Math.round(measurements.part1.a.turn[String(deg)].accuracy * 100)}%`)} />
          <Note>Columns: {LAYER_NAMES.join(', ')}. Centered and whole, the network names {Math.round(measurements.part1.a.accuracyCentered * 100)}%; shrunk to 40% and put in a corner with centering off, {Math.round(measurements.part1.a.centered.smallInCorner * 100)}%.</Note>
        </>
      ) : (
        <Note>Loading the measurements…</Note>
      )}
      <GroupLabel>The network</GroupLabel>
      <Note>Four blocks, each a convolution (16, 32, 64 and 96 feature maps), a rectifier, and a 2 × 2 max pooling, then one linear layer to 24 labels; {measurements ? measurements.networks.drawing.weights.toLocaleString('en-US') : '…'} weights. Trained on {measurements ? measurements.networks.drawing.trainingDrawings?.toLocaleString('en-US') : '…'} Quick, Draw! drawings.</Note>
    </Panel>
  )

  return <ObjectsLayout header={header} left={left} stage={stage} right={right} />
}

/** The categories the pad can be asked for. */
export function promptFor(model: Model, seed: number): string {
  return model.desc.labels[makeRng(seed ^ 0x8a1).int(model.desc.labels.length)]
}

export { Choice }
