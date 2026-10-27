import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/memory/progress/store'
import { GRID_COLUMNS, PART2_DELAY_S, PART2_RECALL_S, STUDY_S, type WordSet } from '../../sim/memory/words/sets'
import { Btn, Content, CountingTask, Countdown, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, RIGHT_STYLE, RecallBox, StagePanel, useCountdown, useStore } from './ui'
import { InstructionScreen } from './progress/InstructionScreen'
import { registerResults } from './Part0'
import type { PartContext, PartModule } from './contract'
import { StudyStore, UNITS, type StudyUnit } from './study/studyStore'
import { FinishedExplanation, Reveal, resultRows } from './study/Reveal'

/**
 * Part 2, Two Ways to Study (spec §6): two sets of words, each studied for
 * one minute, a counting task, and typed recall; the results screen opens
 * only after both. The left panel runs the unit; the stage shows the set,
 * the counting task and the recall box; the right panel is the reveal.
 */

type Ctx = PartContext<StudyStore>

export const UNIT_TITLE: Record<StudyUnit, string> = { first: 'Step 1 — The first set', second: 'Step 2 — The second set' }

/** The instruction screens, one per unit. Neither says what the two sets differ in. */
export const STUDY_INTRO: Record<StudyUnit, { willDo: string[]; minutes: number; keys: string[] }> = {
  first: {
    willDo: [
      'You will see a set of 24 words on the screen for one minute. Look at them for the whole minute.',
      'Then you will see a short counting task for 30 seconds. Count backward by threes from a number by clicking the number that comes next.',
      'Then, type every word you remember from the set, one at a time, pressing “Enter” after each. You have 90 seconds to do as many as you can. If you cannot remember any more, click “I’m done” to end early.',
      'You will do this with two sets of words. This is the first. After it, the second set follows the same three steps.',
      'Each set is done in one sitting: a set you leave partway starts again with a new set of words, and a set you have finished does not have to be redone, even if you quit and come back.',
    ],
    minutes: 10,
    keys: ['“Enter” enters a word in the recall box. The counting task is answered by clicking.', '“I’m done” ends recall early.'],
  },
  second: {
    willDo: [
      'The second set of 24 words will be on the screen for one minute. Then do the counting task again, then type every word you remember, as before.',
      'Look at the words for the whole minute.',
      'This set is done in one sitting too. If you leave partway, it starts again with a new set of words.',
    ],
    minutes: 5,
    keys: ['“Enter” enters a word in the recall box. The counting task is answered by clicking.', '“I’m done” ends recall early.'],
  },
}

function Left({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.study} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GroupLabel>Step</GroupLabel>
          <FixedLines lines={UNITS.map((u) => `${(u === 'first' ? 'The first set' : 'The second set').padEnd(18)}${s.result(u) ? 'finished' : s.unit === u && s.phase !== 'done' ? 'now' : 'not yet'}`)} testId="steps" />
          {s.phase === 'intro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-intro>
              <Note>What will happen is described over the view.</Note>
              <Content>{`About ${STUDY_INTRO[s.unit].minutes} minutes.`}</Content>
              <div>
                <Btn primary onClick={() => s.begin()}>
                  Begin
                </Btn>
              </div>
            </div>
          )}
          {(s.phase === 'study' || s.phase === 'count' || s.phase === 'recall') && (
            <>
              <FixedLines lines={[`${UNIT_TITLE[s.unit]}`, s.phase === 'study' ? 'Look at the words' : s.phase === 'count' ? 'Count backward' : 'Type the words', s.materials?.exhausted ? 'No reserve set was left; this set was shown before' : null]} testId="status" />
              <Note>Nothing you type is scored until both sets are finished.</Note>
            </>
          )}
          {s.phase === 'done' && <Note>Both sets are finished. The results are on the right, and under “My results, all parts” on the Open tab.</Note>}
        </div>
      </Panel>
    </>
  )
}

/** The scrambled grid: the words, in rows, with no labels. */
function Grid({ grid }: { grid: string[][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`, gap: '10px 18px', fontSize: 20, textAlign: 'center' }} data-grid>
      {grid.flat().map((w, i) => (
        <div key={i}>{w}</div>
      ))}
    </div>
  )
}

/** The tree: the two top labels, the six sublabels, the words under each. */
function Tree({ set }: { set: WordSet }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }} data-tree>
      {set.categories.map((c) => (
        <div key={c.label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 4 }} data-label>
            {c.label}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {c.subcategories.map((sub) => (
              <div key={sub.label} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }} data-label>
                  {sub.label}
                </div>
                {sub.words.map((w) => (
                  <div key={w} style={{ fontSize: 17 }}>
                    {w}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function StudyScreen({ store, seconds = STUDY_S }: { store: StudyStore; seconds?: number }) {
  const left = useCountdown(true, seconds, () => store.studyDone())
  const m = store.materials!
  return (
    <StagePanel wide testId="study">
      <GroupLabel>Look at the words</GroupLabel>
      {m.grid ? <Grid grid={m.grid} /> : <Tree set={m.set} />}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Countdown left={left} total={seconds} big />
      </div>
    </StagePanel>
  )
}

function Stage({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  if (s.phase === 'intro' && !s.bothDone) {
    const intro = STUDY_INTRO[s.unit]
    return <InstructionScreen title={`${PART_TITLES.study}: ${UNIT_TITLE[s.unit]}`} willDo={intro.willDo} minutes={intro.minutes} sitting="one sitting" keys={intro.keys} onBegin={() => s.begin()} />
  }
  if (s.phase === 'study' && s.materials) return <StudyScreen key={`${s.unit}-study`} store={s} />
  if (s.phase === 'count')
    return (
      <StagePanel testId="count">
        <CountingTask key={`${s.unit}-count`} from={s.countFrom} seconds={PART2_DELAY_S} onDone={(t, w) => s.countDone(t, w)} />
      </StagePanel>
    )
  if (s.phase === 'recall')
    return (
      <StagePanel testId="recall">
        <RecallBox key={`${s.unit}-recall`} seconds={PART2_RECALL_S} onDone={(typed) => s.recallDone(typed)} prompt="Type every word you remember from the set, one at a time, and press “Enter” after each." />
      </StagePanel>
    )
  const a = s.result('first')
  const b = s.result('second')
  return (
    <StagePanel wide testId="done">
      {a && b ? (
        <FinishedExplanation scrambled={a} organized={b} />
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Both sets are finished</div>
          <Note>My results are on the right: the words recalled from each set and a score for the order you typed them in.</Note>
        </>
      )}
    </StagePanel>
  )
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const a = s.result('first')
  const b = s.result('second')
  return (
    <Panel title="My results" style={RIGHT_STYLE}>
      {a && b ? <Reveal scrambled={a} organized={b} /> : <Note>The results appear here after both sets are finished. Nothing typed is scored before then.</Note>}
    </Panel>
  )
}

function Results({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const a = s.result('first')
  const b = s.result('second')
  if (!a || !b) return null
  return <FixedLines lines={resultRows(a, b)} testId="study-results" />
}

registerResults(2, (progress: ProgressStore) => {
  const a = progress.isComplete('p2-first') ? (progress.result('p2-first') as Parameters<typeof resultRows>[0]) : null
  const b = progress.isComplete('p2-second') ? (progress.result('p2-second') as Parameters<typeof resultRows>[1]) : null
  return a && b ? <FixedLines lines={resultRows(a, b)} testId="study-results" /> : null
})

export const study: PartModule<StudyStore> = {
  createStore: (seed, progress) => new StudyStore(seed, progress),
  Left,
  Stage,
  Right,
  Results,
}

export { StudyStore }
