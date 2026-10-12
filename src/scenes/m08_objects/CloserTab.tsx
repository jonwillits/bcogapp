import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Panel } from '../../components/Panel'
import { makeRng } from '../../sim/random'
import { classifyWith, warmUp } from '../../sim/objects/inferClient'
import { MODEL_TITLE, PHOTO_NETS, type ModelName } from '../../sim/objects/models'
import { classify, topK, type Model } from '../../sim/objects/net'
import { normalize, rasterize, rasterizeAsPhoto, PHOTO_SIZE, type Drawing } from '../../sim/objects/raster'
import { DrawPad } from './DrawPad'
import { CLOCK_LINE, EYE_LINE, LARGER_TEST_LINE, OUR_NETWORKS_LINE } from './lines'
import { useJson, useModel, type Measurements, type PhotosManifest } from './data'
import { Btn, Content, FixedLines, GrayImage, GroupLabel, Note, ObjectsLayout, PANEL_STYLE, ResultTable, RIGHT_STYLE, StageTitle, pct } from './ui'

/**
 * The Closer, A Drawing Is Not a Photograph (spec §6.5): the student draws
 * one of the sixteen categories and all three photo networks label the
 * drawing; the larger test's numbers for held-out drawings; and the
 * reading's clock.
 */
export function CloserTab({ seed, header, model: givenModel, photos: givenPhotos, measurements: givenM, fromPart1 }: { seed: number; header?: ReactNode; model?: Model; photos?: PhotosManifest; measurements?: Measurements; fromPart1?: Drawing }) {
  const drawingNet = useModel('drawing', givenModel)
  const photos = useJson<PhotosManifest>('photos/manifest.json', givenPhotos)
  const measurements = useJson<Measurements>('measurements.json', givenM)
  const names = photos?.categories ?? []
  const prompt = names.length ? names[makeRng(seed ^ 0xc10).int(names.length)] : '…'
  const [drawing, setDrawing] = useState<Drawing>(fromPart1 ?? [])
  const [asPhoto, setAsPhoto] = useState<Float32Array | null>(null)
  const [labels, setLabels] = useState<Map<ModelName, string>>(new Map())
  const [busy, setBusy] = useState(false)
  useEffect(() => { for (const n of PHOTO_NETS) warmUp(n) }, [])

  const drawingLabel = useMemo(() => {
    if (!drawingNet || !drawing.length) return null
    const o = classify(drawingNet, rasterize(normalize(drawing)))
    return topK(o.probs, 1).map((k) => `${drawingNet.desc.labels[k.label]} ${k.p.toFixed(2)}`)[0]
  }, [drawingNet, drawing])

  const label = async () => {
    if (!drawing.length) return
    setBusy(true)
    const img = rasterizeAsPhoto(normalize(drawing))
    setAsPhoto(img)
    const out = new Map<ModelName, string>()
    for (const n of PHOTO_NETS) {
      const r = await classifyWith(n, img)
      out.set(n, `${names[r.top]} ${r.probs[r.top].toFixed(2)}`)
      setLabels(new Map(out))
    }
    setBusy(false)
  }

  const left = (
    <Panel title="The Closer" style={PANEL_STYLE}>
      <Note>Your drawing from the Draw tab is on the pad; keep it if it is one of the sixteen categories, or clear it and draw one. The three photo networks, which have never been shown a drawing, label it. The drawing network labels it too.</Note>
      <Btn primary disabled={!drawing.length || busy} onClick={label}>Label my drawing</Btn>
      <Content>{EYE_LINE}</Content>
      <Content>{OUR_NETWORKS_LINE}</Content>
      <GroupLabel>The clock</GroupLabel>
      <Content>{CLOCK_LINE}</Content>
      <Note>The strongest tests change one thing at a time and check whether the model fails where people fail (§8.2.4). This lab changed four things: a shift or a turn, where the ink was removed, the view, and the noise.</Note>
    </Panel>
  )

  const stage = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StageTitle sub="The three photo networks and the drawing network, on your drawing">The Closer — A Drawing Is Not a Photograph</StageTitle>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <DrawPad drawing={drawing} onChange={(d) => { setDrawing(d); setLabels(new Map()); setAsPhoto(null) }} prompt={prompt} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>As the photo networks receive it ({PHOTO_SIZE} × {PHOTO_SIZE})</div>
          <GrayImage image={asPhoto} size={PHOTO_SIZE} display={160} alt="your drawing as a line drawing at the photo networks’ resolution" testId="as-photo" />
          <FixedLines lines={[...PHOTO_NETS.map((n) => `${MODEL_TITLE[n].padEnd(29)} ${labels.get(n) ?? ''}`), `${'the drawing network'.padEnd(29)} ${drawingLabel ?? ''}`]} />
        </div>
      </div>
    </div>
  )

  const right = (
    <Panel title="The larger test" style={RIGHT_STYLE}>
      {measurements ? (
        <>
          <Note>{LARGER_TEST_LINE} Here, {measurements.part4.drawings.n} held-out Quick, Draw! drawings of the sixteen categories, rendered as {measurements.part4.drawings.renderedAs}.</Note>
          <ResultTable head={['network', 'right on drawings']} rows={[...PHOTO_NETS.map((n) => [MODEL_TITLE[n], pct(measurements.part4.drawings.nets[n.replace('photo_', '')])]), ['the drawing network', pct(measurements.part4.drawings.nets.drawingNetwork)], ['chance (1 in 16)', pct(1 / 16)]]} />
          <Note>The reading predicts that a network trained on blurred and sharp images relies on shape more often, so it should do better on drawings than Standard (§8.2.4). The table is what ours do.</Note>
        </>
      ) : (
        <Note>Loading the measurements…</Note>
      )}
    </Panel>
  )

  return <ObjectsLayout header={header} left={left} stage={stage} right={right} />
}
