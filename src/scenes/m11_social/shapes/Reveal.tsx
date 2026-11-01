import { useState } from 'react'
import { Panel } from '../../../components/Panel'
import type { ProgressStore } from '../../../sim/social/progress/store'
import { FILMS, CHECKLIST, type CheckId } from '../../../sim/social/shapes/films'
import { GOALS } from '../../../sim/social/paths/maze'
import { HEURISTIC, INVERSE_PLANNING, SUBSTANTIAL, correlation, disagreement, type Distribution } from '../../../sim/social/paths/models'
import { pathById, KIND_LABEL } from '../../../sim/social/paths/pool'
import { referenceById } from '../../../sim/social/references'
import { GOALS_NOT_BELIEFS_LINE, ONE_VIEWER_LINE, RESTARTED_LINE } from '../lines'
import { Btn, Content, DotPlot, FixedLines, GroupLabel, Note, ReferencePanel, RIGHT_STYLE, StagePanel, row } from '../ui'
import { ClassPanel } from '../ClassPanel'
import { MazeView } from './MazeView'
import { FILMS_UNIT, PATHS_UNIT, MODELS_PREDICTION, MODELS_PREDICTION_DISAGREE, type FilmsResult, type PathsResult, type PathJudgment } from './shapesStore'
import { mazeOf } from '../../../sim/social/paths/pool'
import { at } from '../../../sim/social/paths/models'

/**
 * Part 3's reveals (spec §7.1, §7.2), rendered only once both units are
 * complete and the prediction about the two procedures is committed. This
 * is the one file in `shapes/` whose strings may name what the films and
 * the paths tested.
 */

export interface Comparison {
  judgment: PathJudgment
  inverse: Distribution
  heuristic: Distribution
  disagreement: number
}

export interface RevealData {
  films: FilmsResult
  paths: PathsResult
  comparisons: Comparison[]
  /** Correlations of the student's splits with each model, over every judgment and goal. */
  rInverse: number
  rHeuristic: number
  /** The same over the judgments where the models disagree substantially. */
  rInverseDisagree: number
  rHeuristicDisagree: number
  disagreements: Comparison[]
  predictedOverall: string
  predictedDisagree: string
}

export function revealData(progress: ProgressStore): RevealData | null {
  if (!progress.isComplete(FILMS_UNIT) || !progress.isComplete(PATHS_UNIT)) return null
  const predictedOverall = progress.prediction(MODELS_PREDICTION)
  const predictedDisagree = progress.prediction(MODELS_PREDICTION_DISAGREE)
  if (!predictedOverall || !predictedDisagree) return null
  const films = progress.result(FILMS_UNIT) as FilmsResult
  const paths = progress.result(PATHS_UNIT) as PathsResult
  const comparisons: Comparison[] = paths.judged.map((j) => {
    const p = pathById(j.path)
    const maze = mazeOf(p.layout)
    const inverse = at(maze, p.cells, INVERSE_PLANNING, j.steps)
    const heuristic = at(maze, p.cells, HEURISTIC, j.steps)
    return { judgment: j, inverse, heuristic, disagreement: disagreement(inverse, heuristic) }
  })
  const flat = (cs: Comparison[], pick: (c: Comparison) => Distribution) => cs.flatMap((c) => GOALS.map((g) => pick(c)[g]))
  const student = (cs: Comparison[]) => cs.flatMap((c) => c.judgment.split.map((v) => v / 100))
  const disagreements = comparisons.filter((c) => c.disagreement >= SUBSTANTIAL)
  return {
    films,
    paths,
    comparisons,
    rInverse: correlation(student(comparisons), flat(comparisons, (c) => c.inverse)),
    rHeuristic: correlation(student(comparisons), flat(comparisons, (c) => c.heuristic)),
    rInverseDisagree: correlation(student(disagreements), flat(disagreements, (c) => c.inverse)),
    rHeuristicDisagree: correlation(student(disagreements), flat(disagreements, (c) => c.heuristic)),
    disagreements,
    predictedOverall,
    predictedDisagree,
  }
}

const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '   —')
const checkLabel = (id: CheckId) => CHECKLIST.find((c) => c.id === id)?.label ?? id

export function resultRows(d: RevealData): string[] {
  return [
    ...FILMS.map((f, k) => `${f.title.padEnd(10)}${'rating'.padEnd(8)}${String(d.films.ratings[k]).padStart(2)}   ${d.films.checks[k].map((c) => checkLabel(c).split(' (')[0]).join('; ')}`),
    `${'Correlation with inverse planning, all pauses'.padEnd(52)}${f2(d.rInverse).padStart(6)}`,
    `${'Correlation with the “last moved toward” rule, all'.padEnd(52)}${f2(d.rHeuristic).padStart(6)}`,
    `${'On the pauses where they disagree: inverse planning'.padEnd(52)}${f2(d.rInverseDisagree).padStart(6)}`,
    `${'On the pauses where they disagree: the rule'.padEnd(52)}${f2(d.rHeuristicDisagree).padStart(6)}`,
    `${'Pauses where the two disagree'.padEnd(52)}${String(d.disagreements.length).padStart(3)} of ${d.comparisons.length}`,
  ]
}

const FILM_LABEL = ['the control film', 'the forward film', 'the reversed film']

export function ShapesReveal({ progress }: { progress: ProgressStore }) {
  const d = revealData(progress)
  const [replay, setReplay] = useState<string | null>(null)
  if (!d) return null
  const closer = (c: Comparison) => {
    const s = c.judgment.split.map((v) => v / 100)
    const di = GOALS.reduce((a, g, i) => a + Math.abs(s[i] - c.inverse[g]), 0)
    const dh = GOALS.reduce((a, g, i) => a + Math.abs(s[i] - c.heuristic[g]), 0)
    return di < dh ? 'inverse planning' : dh < di ? 'the rule' : 'equal'
  }
  const dist = (x: Distribution) => GOALS.map((g) => Math.round(100 * x[g])).join('/')
  return (
    <StagePanel wide testId="reveal">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Part 3 — My results</div>
      <GroupLabel>Step 1. The three films: your ratings and what your descriptions did</GroupLabel>
      <Note>Film 1 was a control: the same shapes with the same amount of motion, speeds and contacts, each on a path of its own, with no motion contingent on another shape’s. Film 2 was the scenario: an approach, the door opening, a sudden approach followed by a shape moving away, a pursuit, a shape entering the rectangle, the door closing, an escape. Film 3 was Film 2 run backward.</Note>
      <FixedLines lines={FILMS.map((f, k) => `${`${f.title}, ${FILM_LABEL[k]}`.padEnd(28)}${'acted on purpose, 1 to 7:'.padEnd(27)}${String(d.films.ratings[k]).padStart(2)}`)} testId="film-ratings" />
      {FILMS.map((f, k) => (
        <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }} data-film-reveal={f.id}>
          <Note style={{ color: 'var(--text)' }}>
            <strong>{f.title}</strong>, {FILM_LABEL[k]}. You ticked: {d.films.checks[k].map(checkLabel).join('; ')}.
          </Note>
          <Note style={{ whiteSpace: 'pre-wrap' }}>{d.films.descriptions[k]}</Note>
        </div>
      ))}
      <ReferencePanel reference={referenceById('heider1944')} />
      <Content>{ONE_VIEWER_LINE}</Content>
      <ClassPanel entryId="films" own={d.films.ratings} xLabel="rating of the control film" yLabel="rating of the forward film" />
      <GroupLabel>Step 2. Your judgments against the two procedures</GroupLabel>
      <FixedLines lines={[row('Correlation with inverse planning', d.rInverse, 44), row('Correlation with the “last moved toward” rule', d.rHeuristic, 44), row('On the disagreeing pauses: inverse planning', d.rInverseDisagree, 44), row('On the disagreeing pauses: the rule', d.rHeuristicDisagree, 44), `${'You predicted, overall'.padEnd(44)}${d.predictedOverall === 'inverse' ? INVERSE_PLANNING.label : HEURISTIC.label}`, `${'You predicted, where they disagree'.padEnd(44)}${d.predictedDisagree === 'inverse' ? INVERSE_PLANNING.label : HEURISTIC.label}`]} testId="correlations" />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <DotPlot points={d.comparisons.flatMap((c) => GOALS.map((g, i) => ({ x: c.inverse[g], y: c.judgment.split[i] / 100 })))} xLabel="inverse planning" yLabel="your points, as a share" xMax={1.02} yMax={1.02} width={260} height={180} />
        <DotPlot points={d.comparisons.flatMap((c) => GOALS.map((g, i) => ({ x: c.heuristic[g], y: c.judgment.split[i] / 100 })))} xLabel="the “last moved toward” rule" yLabel="your points, as a share" xMax={1.02} yMax={1.02} width={260} height={180} />
      </div>
      <Note>Each dot is one goal at one pause: the procedure’s share on the horizontal axis, yours on the vertical.</Note>
      <ReferencePanel reference={referenceById('baker2009')} />
      <GroupLabel>The pauses where the two procedures disagree (by at least {SUBSTANTIAL})</GroupLabel>
      <FixedLines lines={[`${'path'.padEnd(6)}${'kind'.padEnd(30)}${'step'.padStart(5)}${'you A/B/C'.padStart(12)}${'inverse'.padStart(10)}${'rule'.padStart(10)}${'closer to'.padStart(18)}`, ...d.disagreements.map((c) => `${c.judgment.path.padEnd(6)}${KIND_LABEL[pathById(c.judgment.path).kind].slice(0, 29).padEnd(30)}${String(c.judgment.steps).padStart(5)}${c.judgment.split.join('/').padStart(12)}${dist(c.inverse).padStart(10)}${dist(c.heuristic).padStart(10)}${closer(c).padStart(18)}`)]} testId="disagreements" />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Note>Replay a path:</Note>
        {[...new Set(d.disagreements.map((c) => c.judgment.path))].map((id) => (
          <Btn key={id} small onClick={() => setReplay(replay === id ? null : id)}>
            {id}
          </Btn>
        ))}
      </div>
      {replay && (
        <div data-replay={replay}>
          <MazeView path={pathById(replay)} steps={0} full />
          <Note>{pathById(replay).id}: {KIND_LABEL[pathById(replay).kind]}, to {pathById(replay).goal}. The pauses were at steps {pathById(replay).judgments.map((j) => j.steps).join(', ')}.</Note>
        </div>
      )}
      <Content>{GOALS_NOT_BELIEFS_LINE}</Content>
      <ClassPanel entryId="paths" own={[d.rInverse, d.rHeuristic]} xLabel="correlation with inverse planning" yLabel="correlation with the rule" equalLine />
      {(d.films.restarts > 0 || d.paths.restarts > 0) && <Content>{RESTARTED_LINE}</Content>}
    </StagePanel>
  )
}

export function ShapesRight({ progress }: { progress: ProgressStore }) {
  const d = revealData(progress)
  if (!d) return null
  return (
    <Panel title="My results" style={RIGHT_STYLE}>
      <FixedLines lines={resultRows(d)} testId="results-rows" />
    </Panel>
  )
}

export function CompactResults({ progress }: { progress: ProgressStore }) {
  const d = revealData(progress)
  if (!d) return null
  return <FixedLines lines={resultRows(d)} />
}
