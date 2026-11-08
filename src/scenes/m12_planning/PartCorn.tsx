import { Panel } from '../../components/Panel'
import { EARRINGS, MODEL, PLANTS, type Tray, type TrayStats } from '../../sim/planning/corn/model'
import { reference } from '../../sim/planning/references'
import { ReferencePanel } from './ReferencePanel'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, RIGHT_STYLE, StagePanel, Para, Section, useStore } from './ui'
import { InstructionScreen } from '../m10_memory/progress/InstructionScreen'
import { MODEL_OF_PLANTS_LINE, MODELS_OWN_GENES_LINE, MODELS_MECHANISM_LINE } from './lines'
import type { PartContext, PartModule } from './contract'
import { CornStore, PREDICTIONS, type PredictionKey } from './corn/store'
import { SCREENS, STEP_TITLES, READY_LINE, SITTING_LINE, type Step } from './corn/screens'

/**
 * Part 4's screens (spec §8): trays of corn seen from the side, each plant
 * drawn to its height, a histogram under each tray, and the model's numbers
 * printed beside them. The left column runs the step and holds its
 * prediction; the stage draws the trays; the right column explains the
 * model and gives the reading's figures.
 */

type Ctx = PartContext<CornStore>

function Left({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  const screen = SCREENS[s.step]
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.corn} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Content>{MODEL_OF_PLANTS_LINE}</Content>
          <GroupLabel>Step</GroupLabel>
          <Choice value={String(s.step)} options={([1, 2, 3, 4] as Step[]).map((st) => ({ id: String(st), label: `Step ${st}`, title: STEP_TITLES[st] }))} onChange={(v) => s.open(Number(v) as Step)} />
          <Note>{screen.title}</Note>
          {s.state === 'intro' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-intro>
              <Note>What you will do is described over the view. Read it, then press “Begin”.</Note>
              <Content>{`About ${screen.minutes} minutes. An exploration: leave and return at any time.`}</Content>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn primary onClick={() => s.begin()}>
                  Begin
                </Btn>
                {s.step > 1 && <Btn onClick={() => s.open((s.step - 1) as Step)}>Go back to Step {s.step - 1}</Btn>}
                {s.step < 4 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go to Step {s.step + 1}</Btn>}
              </div>
            </div>
          ) : (
            <>
              <Controls s={s} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn onClick={() => s.reopen()}>Show the instructions again</Btn>
                {s.step > 1 && <Btn onClick={() => s.open((s.step - 1) as Step)}>Go back to Step {s.step - 1}</Btn>}
                {s.step < 4 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go on to Step {s.step + 1}</Btn>}
              </div>
            </>
          )}
        </div>
      </Panel>
    </>
  )
}

function Prediction({ s, k }: { s: CornStore; k: PredictionKey }) {
  const p = PREDICTIONS[k]
  const committed = s.predicted(k)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} data-predict={k}>
      <GroupLabel>Predict first</GroupLabel>
      <Note>{p.question}</Note>
      {committed ? (
        <FixedLines lines={[`Committed: ${committed}`]} mono={false} />
      ) : (
        <>
          <Choice value={s.drafts[k] ?? null} options={p.choices.map((c) => ({ id: c, label: c }))} onChange={(c) => s.draft(k, c)} />
          <div>
            <Btn primary onClick={() => s.commit(k)} disabled={!s.drafts[k]}>
              Commit my prediction
            </Btn>
          </div>
        </>
      )}
    </div>
  )
}

function Controls({ s }: { s: CornStore }) {
  const busy = s.growing !== null
  if (s.step === 1)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <GroupLabel>Seed</GroupLabel>
        <Choice value={s.seedKind} options={[{ id: 'varied', label: 'varied stock' }, { id: 'uniform', label: 'one uniform line' }]} onChange={(v) => s.setSeedKind(v as 'varied' | 'uniform')} />
        <GroupLabel>Soil</GroupLabel>
        <Choice value={s.soil} options={[{ id: 'even', label: 'even' }, { id: 'patchy', label: 'patchy' }]} onChange={(v) => s.setSoil(v as 'even' | 'patchy')} />
        <Prediction s={s} k="s1" />
        <div>
          <Btn primary onClick={() => s.grow()} disabled={!s.predicted('s1') || busy}>
            Grow
          </Btn>
        </div>
      </div>
    )
  if (s.step === 2)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Prediction s={s} k="s2first" />
        <div>
          <Btn primary onClick={() => s.growFirst()} disabled={!s.predicted('s2first') || busy}>
            Grow the first experiment
          </Btn>
        </div>
        <Prediction s={s} k="s2second" />
        <div>
          <Btn primary onClick={() => s.growSecond()} disabled={!s.predicted('s2second') || busy}>
            Grow the second experiment
          </Btn>
        </div>
        {s.second && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Btn onClick={() => s.restore('nitrates')} disabled={busy || s.secondNutrients !== 'deficient'}>
              Restore the nitrates
            </Btn>
            <Btn onClick={() => s.restore('zinc')} disabled={busy || s.secondNutrients === 'complete'}>
              Restore the zinc
            </Btn>
          </div>
        )}
      </div>
    )
  if (s.step === 3)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(['genes', 'shared', 'rest'] as const).map((k) => (
          <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, width: 110 }}>{k === 'genes' ? 'From genes' : k === 'shared' ? 'From the shared environment' : 'From the rest'}</span>
            <input type="range" min={0} max={1} step={0.01} value={s.shares[k]} onChange={(e) => s.setShare(k, Number(e.target.value))} aria-label={`share from ${k}`} style={{ width: 100 }} />
            <FixedLines lines={[s.shares[k].toFixed(2)]} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, width: 110 }}>Identical twins treated more alike</span>
          <input type="range" min={0} max={0.5} step={0.01} value={s.shares.identicalOnly} onChange={(e) => s.setShare('identicalOnly', Number(e.target.value))} aria-label="environment shared by identical twins only" style={{ width: 100 }} />
          <FixedLines lines={[s.shares.identicalOnly.toFixed(2)]} />
        </div>
        <div>
          <Btn small onClick={() => s.preset()}>
            The reading’s figures
          </Btn>
        </div>
        <Prediction s={s} k="s3" />
        <div>
          <Btn primary onClick={() => s.runTwins()} disabled={!s.predicted('s3')}>
            Run the twin study
          </Btn>
        </div>
      </div>
    )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Prediction s={s} k="s4" />
      <div>
        <Btn primary onClick={() => s.growPoorRich()} disabled={!s.predicted('s4') || busy}>
          Grow in poor and rich soil
        </Btn>
      </div>
      <div>
        <Btn primary onClick={() => s.runSeasons()}>
          Run six seasons
        </Btn>
      </div>
    </div>
  )
}

function Stage({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  const screen = SCREENS[s.step]
  if (s.state === 'intro') return <InstructionScreen title={screen.title} willDo={screen.willDo} minutes={screen.minutes} sitting="leave any time" sittingLine={SITTING_LINE} ready={READY_LINE} content={screen.content} onBegin={() => s.begin()} />
  const share = s.grownShare
  return (
    <StagePanel wide testId={`corn-${s.step}`}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{screen.title}</div>
      {s.step === 1 && (
        <>
          {s.tray ? <TrayPanel tray={s.tray} share={share} label={`${s.tray.seed === 'varied' ? 'varied stock' : 'one uniform line'}, ${s.tray.soil} soil`} stats={s.stats(s.tray)} /> : <Note>Commit your prediction on the left, then press “Grow”.</Note>}
          <Content>{MODELS_OWN_GENES_LINE}</Content>
          <Earrings />
        </>
      )}
      {s.step === 2 && (
        <>
          {s.first ? (
            <Section title="The first experiment: two uniform lines, the same even soil">
              <TwoTrays trays={s.first} labels={['line 1', 'line 2']} share={share} stats={s.stats.bind(s)} />
            </Section>
          ) : (
            <Note>Commit your first prediction on the left, then press “Grow the first experiment”.</Note>
          )}
          {s.second ? (
            <Section title={`The second experiment: one varied stock, two solutions (the second tray: ${s.secondNutrients === 'deficient' ? 'half the nitrates and no zinc' : s.secondNutrients === 'nitratesRestored' ? 'nitrates restored, still no zinc' : 'nitrates and zinc restored'})`}>
              <TwoTrays trays={s.second} labels={['complete solution', s.secondNutrients === 'deficient' ? 'half nitrates, no zinc' : s.secondNutrients === 'nitratesRestored' ? 'nitrates restored' : 'both restored']} share={share} stats={s.stats.bind(s)} />
              <Para>The reading quotes Lewontin (§12.3.6): if a chemist restored the nitrates and the difference remained, it would still be wrong to conclude that it was genetic, since the missing zinc was “the real culprit”. Of a claim that a difference between groups was probably genetic because the trait is heritable within groups, Lewontin wrote, “It is neither likely nor unlikely. There is no evidence”.</Para>
            </Section>
          ) : (
            <Note>Commit your second prediction on the left, then press “Grow the second experiment”.</Note>
          )}
        </>
      )}
      {s.step === 3 && <Twins s={s} />}
      {s.step === 4 && (
        <>
          {s.poorRich ? (
            <Section title="Poor soil and rich soil, the same varied stock">
              <TwoTrays trays={s.poorRich} labels={['poor soil', 'rich soil']} share={share} stats={s.stats.bind(s)} />
              <Content>{MODELS_MECHANISM_LINE}</Content>
              <Para>In the study the reading describes (§12.3.5; Turkheimer et al., 2003), in one sample of young twins in the United States, the heritability of IQ was close to zero in poor families and high in affluent ones.</Para>
            </Section>
          ) : (
            <Note>Commit your prediction on the left, then press “Grow in poor and rich soil”.</Note>
          )}
          {s.seasonsRun && (
            <Section title="Six seasons of improving soil, the stock resampled each season">
              <FixedLines lines={[`${'season'.padEnd(8)}${'mean height, cm'.padStart(16)}${'heritability'.padStart(14)}`, ...s.seasonsRun.map((x) => `${String(x.season).padEnd(8)}${x.stats.meanHeight.toFixed(1).padStart(16)}${x.stats.heritability.toFixed(2).padStart(14)}`)]} testId="seasons" />
              <Para>
                The mean height rose by {(s.seasonsRun[5].stats.meanHeight - s.seasonsRun[0].stats.meanHeight).toFixed(1)} cm over the six seasons, which is {((s.seasonsRun[5].stats.meanHeight - s.seasonsRun[0].stats.meanHeight) / Math.sqrt(s.seasonsRun[0].stats.varianceHeight)).toFixed(2)} standard deviations of the first season’s heights, while the heritability within each season stayed high and the seed stock did not change. The reading describes the Flynn effect (§12.1.8, §12.3.6): a rise in average scores of about a standard deviation within a few generations, which arose from the environment, faster than genes can change.
              </Para>
            </Section>
          )}
        </>
      )}
    </StagePanel>
  )
}

/** A tray from the side: each plant a stalk to its height, and a histogram of the heights under it. */
function TrayView({ tray, share, width = 340 }: { tray: Tray; share: number; width?: number }) {
  const h = 170
  const hist = 50
  const maxH = 240
  const Y = (cm: number) => h - 10 - (Math.max(0, cm) / maxH) * (h - 20)
  const heights = tray.plants.map((p) => p.height)
  const bins = 12
  const lo = 60
  const hi = 240
  const counts = new Array<number>(bins).fill(0)
  for (const v of heights) counts[Math.max(0, Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins)))]++
  const maxCount = Math.max(1, ...counts)
  return (
    <svg width={width} height={h + hist} viewBox={`0 0 ${width} ${h + hist}`} role="img" aria-label={`a tray of ${PLANTS} corn plants, with a histogram of their heights`} data-tray style={{ background: 'var(--bg)', borderRadius: 8 }}>
      <rect x={6} y={h - 10} width={width - 12} height={8} fill="#6b4f2a" />
      {tray.plants.map((p, i) => {
        const x = 10 + (i / (PLANTS - 1)) * (width - 20)
        const top = Y(p.height * share)
        return (
          <g key={i}>
            <line x1={x} y1={h - 10} x2={x} y2={top} stroke="#4caf50" strokeWidth={2} />
            <ellipse cx={x} cy={top} rx={3} ry={1.5} fill="#2e7d32" />
          </g>
        )
      })}
      {counts.map((c, b) => (
        <rect key={b} x={10 + (b / bins) * (width - 20)} y={h + hist - 4 - (c / maxCount) * (hist - 12)} width={(width - 20) / bins - 2} height={(c / maxCount) * (hist - 12)} fill="var(--accent)" opacity={0.8} />
      ))}
      <text x={10} y={h + hist - 44} fontSize={8} fill="var(--text-muted)">
        heights, {lo} to {hi} cm, in {bins} bins
      </text>
    </svg>
  )
}

function statsLines(st: TrayStats): string[] {
  return [`${'variance of genetic values'.padEnd(30)}${st.varianceGenetic.toFixed(1).padStart(8)}`, `${'variance of heights'.padEnd(30)}${st.varianceHeight.toFixed(1).padStart(8)}`, `${'heritability'.padEnd(30)}${st.heritability.toFixed(2).padStart(8)}`, `${'mean height, cm'.padEnd(30)}${st.meanHeight.toFixed(1).padStart(8)}`]
}

function TrayPanel({ tray, share, label, stats }: { tray: Tray; share: number; label: string; stats: TrayStats }) {
  const grown = share >= 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-tray-panel>
      <GroupLabel>{label}</GroupLabel>
      <TrayView tray={tray} share={share} />
      {grown ? (
        <>
          <FixedLines lines={statsLines(stats)} testId="tray-stats" />
          <Para>
            The variance of the plants’ genetic values is {stats.varianceGenetic.toFixed(1)} and the variance of their heights is {stats.varianceHeight.toFixed(1)}, both in square centimeters, so the heritability within this tray, the first divided by the second, is {stats.heritability.toFixed(2)}. A heritability near 1 means nearly all the variation in height in this tray goes with variation in the genetic values; near 0, almost none does.
          </Para>
        </>
      ) : (
        <Note>Growing.</Note>
      )}
    </div>
  )
}

function TwoTrays({ trays, labels, share, stats }: { trays: [Tray, Tray]; labels: [string, string]; share: number; stats: (t: Tray) => TrayStats }) {
  const a = stats(trays[0])
  const b = stats(trays[1])
  const grown = share >= 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-two-trays>
      <div style={{ display: 'flex', gap: 10 }}>
        {trays.map((t, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <GroupLabel>{labels[i]}</GroupLabel>
            <TrayView tray={t} share={share} width={330} />
          </div>
        ))}
      </div>
      {grown ? (
        <>
          <FixedLines lines={[`${''.padEnd(30)}${labels[0].slice(0, 14).padStart(16)}${labels[1].slice(0, 14).padStart(16)}`, `${'heritability within the tray'.padEnd(30)}${a.heritability.toFixed(2).padStart(16)}${b.heritability.toFixed(2).padStart(16)}`, `${'mean height, cm'.padEnd(30)}${a.meanHeight.toFixed(1).padStart(16)}${b.meanHeight.toFixed(1).padStart(16)}`, `${'difference between the trays, cm'.padEnd(30)}${(a.meanHeight - b.meanHeight).toFixed(1).padStart(32)}`]} testId="two-trays-stats" />
          <Para>
            Within the first tray the heritability is {a.heritability.toFixed(2)}, and within the second {b.heritability.toFixed(2)}. The trays’ mean heights differ by {Math.abs(a.meanHeight - b.meanHeight).toFixed(1)} cm.
          </Para>
        </>
      ) : (
        <Note>Growing.</Note>
      )}
    </div>
  )
}

function Earrings() {
  return (
    <Section title="The earrings: a table of counts">
      <Para>The reading’s example (§12.3.5): when only women wore earrings, wearing one was highly heritable, because it followed a chromosomal difference. Here is a population of 200 people, 100 women and 100 men, at two times, with the heritability of wearing an earring computed in each as the variance of the group means divided by the variance of wearing, from the same genes, the sex chromosomes.</Para>
      <FixedLines lines={[`${'time'.padEnd(42)}${'women wearing'.padStart(14)}${'men wearing'.padStart(12)}${'heritability'.padStart(13)}`, ...[EARRINGS.then, EARRINGS.now].map((e) => `${e.time.padEnd(42)}${`${e.womenWearing} of ${e.of}`.padStart(14)}${`${e.menWearing} of ${e.of}`.padStart(12)}${e.heritability.toFixed(2).padStart(13)}`)]} testId="earrings" />
    </Section>
  )
}

function Twins({ s }: { s: CornStore }) {
  const r = s.twinResults
  return (
    <Section title="A twin study in a model population: 500 pairs of identical twins and 500 pairs of fraternal twins">
      <Para>Set the shares on the left and press “Run the twin study”. The simulation draws each pair’s trait values from the shares, computes the correlation within identical pairs and within fraternal pairs, and the standard estimate of heritability, twice their difference (§12.3.5), beside the true share from genes that it used.</Para>
      {r ? (
        <>
          <FixedLines lines={[`${'correlation within identical pairs'.padEnd(40)}${r.identical.toFixed(2).padStart(8)}`, `${'correlation within fraternal pairs'.padEnd(40)}${r.fraternal.toFixed(2).padStart(8)}`, `${'estimate: twice the difference'.padEnd(40)}${r.estimate.toFixed(2).padStart(8)}`, `${'true share from genes in the simulation'.padEnd(40)}${r.trueShare.toFixed(2).padStart(8)}`]} testId="twins" />
          <Para>
            Identical twins correlated {r.identical.toFixed(2)} and fraternal twins {r.fraternal.toFixed(2)}, so the estimate is {r.estimate.toFixed(2)}, against a true share of {r.trueShare.toFixed(2)}. The estimate rests on the assumption that both kinds of twins share their environments to the same degree; the fourth slider breaks that assumption by an amount you set.
          </Para>
        </>
      ) : (
        <Note>No run yet.</Note>
      )}
      <ReferencePanel reference={reference('twins-2015')} />
    </Section>
  )
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  return (
    <Panel title="The model" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Para>
          A tray holds {PLANTS} plants. Each plant’s height, in centimeters, is the tray’s mean height ({MODEL.meanHeight.complete} cm in the complete nutrient solution, {MODEL.meanHeight.deficient} cm with half the nitrates and no zinc), plus a genetic value from its seed, plus an environmental value from its patch of soil, plus a small amount of growth that is neither. In a varied stock a genetic value is the sum of {MODEL.effects} small effects drawn independently, with a spread of {MODEL.geneticSd} cm; in a uniform line every plant has the same genetic value. In patchy soil each patch adds a value with a spread of {MODEL.patchSd} cm; in even soil every patch adds the same.
        </Para>
        <Para>Heritability within a tray is the variance of the plants’ genetic values divided by the variance of their heights. Variance is the average squared distance of a set of values from their mean.</Para>
        <Content>{MODELS_OWN_GENES_LINE}</Content>
        {s.step === 2 && <ReferencePanel reference={reference('lewontin-1970')} />}
        {s.step === 4 && (
          <>
            <ReferencePanel reference={reference('turkheimer-2003')} />
            <ReferencePanel reference={reference('flynn')} />
          </>
        )}
        <Note>Part 4 is an exploration. Your predictions are saved; the trays are grown again on each visit, and nothing else is saved.</Note>
      </div>
    </Panel>
  )
}

export { CornStore }

export const corn: PartModule<CornStore> = {
  createStore: (seed, progress) => new CornStore(seed, progress),
  Left,
  Stage,
  Right,
}
