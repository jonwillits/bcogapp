import { useEffect, useMemo, useRef } from 'react'
import { Panel } from '../../components/Panel'
import { WEEK_NIGHTS, describeFeatures } from '../../sim/memory/logs/features'
import { ANSWER_LABEL } from '../../sim/memory/logs/question'
import { DIG_S, EAT_S, NIGHT_S, NURSE_S, PRACTICE_S } from '../../sim/memory/logs/night'
import { PAIR_PREDICTIONS, PAIR_PREDICTION_KEY, PAIR_QUESTION, TREND_PREDICTIONS, TREND_PREDICTION_KEY, TREND_QUESTION, type PairPrediction, type Part4WeekResult, type TrendPrediction } from '../../sim/memory/logs/results'
import type { ProgressStore } from '../../sim/memory/progress/store'
import { InstructionScreen } from './progress/InstructionScreen'
import { Btn, Choice, Content, Countdown, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, StagePanel, useStore } from './ui'
import { AS_A_PERSON_LINE, COMFORT_LINE, KIND_RULE, NO_NOTES_LINE, RATS_LINE, REFILL_RULE } from './lines'
import type { PartContext, PartModule } from './contract'
import { DAWN_S, LogsStore, WEEK_UNIT, type BannerTone } from './logs/logsStore'
import { LogsView } from './logs/LogsView'
import { ClearingOverhead } from './logs/Overhead'
import { LogsReveal } from './logs/Reveal'
import { NightSound } from './logs/sound'
import { registerResults } from './Part0'

/**
 * Part 4, Nights at the Logs (spec §8, revised 2026-10-27): the student is
 * the mammal, foraging at ten logs over one week of six nights in one
 * clearing, under a stated refill rule, with two predictions before night 1
 * and one question at the end of the week. Lab 9's rat, range, cameras and
 * orienting panel; the fifth installment of the creature spine.
 */

export const LOGS_INTRO = {
  title: PART_TITLES.logs,
  willDo: [
    'You are the small mammal of Lab 9, back in its range at night. Out from your nest lie ten logs: seven with loose bark and three that are smooth. Each log looks different from every other: longer or shorter, thicker or thinner, with branch stubs or without, mossy or bare, darker or paler. You will walk to a log, dig to see what is under it, and eat what you find.',
    `A dig takes about ${DIG_S} seconds and shows whether beetles are there; eating them takes about ${EAT_S} more. A night lasts ${NIGHT_S} seconds; a timer over the view counts it down. At dawn the animal walks back to the nest by itself.`,
    `Partway through each night the young in the nest call. Digging stops until you have gone back to the nest and nursed them, which takes about ${NURSE_S} seconds and happens by itself once you are there. Then the night goes on.`,
    `First a practice night in the clearing, which you may redo; it is longer, about ${PRACTICE_S} seconds, for learning the keys and where the logs lie. Then one week of six nights in the same clearing, with every loose-bark log full again on night 1. Some nights will look just like the night before, and some will not. A fixed line beside the view repeats the two rules below.`,
    '- ' + KIND_RULE,
    '- ' + REFILL_RULE,
  ],
  minutes: 22,
  keys: [
    'Up arrow or W walks forward; left and right arrows, or A and D, turn; down arrow or S steps back. The buttons under the view do the same.',
    '“Enter” digs at the log you are standing by; so does the “Dig” button under the view.',
    'The space bar pauses the night and starts it again; so does the “Pause” button. Your pauses are counted.',
    'An energy bar under the timer drains over the night and rises with each meal. It never ends the night; the score is beetles eaten.',
  ],
  content: [RATS_LINE, COMFORT_LINE, NO_NOTES_LINE],
}

export const PRACTICE_INTRO = {
  title: 'The practice night',
  willDo: [`One night in the clearing where the week will run: the same nest, logs and landmarks. Nothing is scored, and this night does not count toward the week: every loose-bark log is full again on night 1 whatever you empty now. Use it to learn the keys, the dig, the young’s call, the dawn, and where the logs lie. This night is longer than the others, about ${PRACTICE_S} seconds; the scored nights are ${NIGHT_S}.`, 'You may redo the practice night as often as you like.'],
  minutes: 3,
}

export function weekIntro(restartedHere: boolean) {
  return {
    title: `The week: ${WEEK_NIGHTS} nights`,
    willDo: [
      `${WEEK_NIGHTS} nights in the same clearing, one after another, about ${NIGHT_S} seconds each. Every loose-bark log is full on night 1, whatever the practice night emptied, and the two rules hold through all ${WEEK_NIGHTS} nights. Beetles eaten is the score.`,
      'Some nights will look just like the night before, and some will not. Before each night a short screen names the night and what it will look like.',
      ...(restartedHere ? ['The week was interrupted, so it runs again from night 1 in the same clearing, with every loose-bark log full.'] : []),
    ],
    minutes: 12,
  }
}

function Left({ ctx }: { ctx: PartContext<LogsStore> }) {
  const s = useStore(ctx.store)
  const sound = useMemo(() => new NightSound(), [])
  const calledRef = useRef(false)
  useEffect(() => () => sound.stop(), [sound])
  // The night's sound, started after Begin (a click), and the young's call.
  useEffect(() => {
    if (s.state === 'night' && s.sim && !s.paused) {
      sound.setMuted(s.muted)
      sound.play(s.sim.features.sound)
    } else sound.stop()
  }, [s.state, s.sim, s.muted, s.paused, sound, s.version])
  if (s.state === 'night' && s.sim) {
    if (s.sim.called && !calledRef.current) {
      calledRef.current = true
      if (!s.muted) sound.call()
    }
    if (!s.sim.called) calledRef.current = false
  }
  const restartedHere = s.progress.materialsSlot(WEEK_UNIT) > 0
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.logs} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Content>{RATS_LINE}</Content>
          {(s.state === 'intro' || s.state === 'practice-intro' || s.state === 'week-intro' || s.state === 'between' || s.state === 'predict' || s.state === 'question') && <Note>What to do is described over the view.</Note>}
          {s.state === 'night' && s.sim && (
            <>
              <GroupLabel>Tonight</GroupLabel>
              <FixedLines lines={s.statusLines()} testId="night-status" />
              <Note>Tonight: {describeFeatures(s.sim.features)}.</Note>
            </>
          )}
          <GroupLabel>The two rules: the usual fact, and the refill rule</GroupLabel>
          <Content>{KIND_RULE}</Content>
          <Content>{REFILL_RULE}</Content>
          <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={s.muted} onChange={(e) => s.setMuted(e.target.checked)} /> Mute
          </label>
          {s.state === 'night-over' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn primary onClick={() => s.goOnFromPractice()}>
                Go on
              </Btn>
              <Btn onClick={() => s.openPractice()}>Redo the practice night</Btn>
            </div>
          )}
          {s.predictionsCommitted && s.state !== 'night' && (
            <FixedLines lines={[`Your prediction: ${s.committed.pairs}`, `Your prediction: ${s.committed.trend}`]} mono={false} testId="predictions-left" />
          )}
          {s.state === 'revealed' && (
            <>
              <FixedLines lines={['The week is finished']} />
              <Btn onClick={() => s.openPractice()}>Redo the practice night</Btn>
            </>
          )}
          {restartedHere && s.state === 'week-intro' && <Note>The week was interrupted, so it runs again from night 1 in the same clearing, with every loose-bark log full.</Note>}
          {(s.state === 'week-intro' || s.state === 'predict') && s.practice && (
            <div>
              <Btn onClick={() => s.openPractice()}>Redo the practice night</Btn>
            </div>
          )}
        </div>
      </Panel>
    </>
  )
}

function Stage({ ctx }: { ctx: PartContext<LogsStore> }) {
  const s = useStore(ctx.store)
  if (s.state === 'intro') return <InstructionScreen {...LOGS_INTRO} sitting="one sitting" onBegin={() => s.begin()} />
  if (s.state === 'practice-intro') return <InstructionScreen {...PRACTICE_INTRO} sitting="leave any time" onBegin={() => s.beginPractice()} ready="Nothing is needed." />
  if (s.state === 'predict') return <Predictions s={s} />
  if (s.state === 'week-intro') return <InstructionScreen {...weekIntro(s.progress.materialsSlot(WEEK_UNIT) > 0)} sitting="one sitting" onBegin={() => s.beginWeek()} ready="Nothing is needed." />
  if (s.state === 'between') {
    return (
      <StagePanel testId="between">
        <div style={{ fontSize: 22, fontWeight: 700 }}>Night {s.nextNight} of {WEEK_NIGHTS}</div>
        <Note>{s.nextFeaturesLine()}</Note>
        <div>
          <Btn primary onClick={() => s.beginNight()}>
            {`Begin night ${s.nextNight}`}
          </Btn>
        </div>
      </StagePanel>
    )
  }
  if (s.state === 'night' && s.sim) {
    const fade = s.fade > 0 ? Math.min(1, s.fade / 0.6) : 0
    const banner = s.banner()
    return (
      <>
        {fade > 0 && <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: fade }} data-fade />}
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
          <div style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', width: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxSizing: 'border-box' }} data-night-box>
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, userSelect: 'text' }} data-night-label>
              {s.nightLabel()}
            </div>
            <Countdown left={s.sim.seconds - s.sim.time} total={s.sim.seconds} big />
            <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 3 }} data-energy>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Energy, which rises with each meal</div>
              <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, border: '1px solid var(--border)' }} aria-label="energy">
                <div style={{ height: '100%', width: `${Math.round(s.sim.energy * 100)}%`, background: 'var(--actuator)', borderRadius: 3 }} />
              </div>
            </div>
          </div>
          <NightBanner text={banner.text} tone={banner.tone} />
        </div>
      </>
    )
  }
  if (s.state === 'night-over') {
    return (
      <StagePanel testId="night-over">
        <div style={{ fontSize: 14, fontWeight: 600 }}>The practice night is over</div>
        <Note>Beetles eaten: {s.practice?.beetles ?? 0}. Press “Go on” on the left, or redo the practice night.</Note>
      </StagePanel>
    )
  }
  if (s.state === 'question') return <WeekQuestion s={s} />
  return null
}

/** The two predictions before night 1 (spec §8.5), committed together and written once. */
function Predictions({ s }: { s: LogsStore }) {
  return (
    <StagePanel testId="predict">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Before the week: two predictions</div>
      <Note>Some of the six nights will look just like the night before, and some will not. On night 3 and after, foraging well depends on telling last night from the night before it: a log you emptied last night is empty, and a log you emptied two nights ago is full again.</Note>
      <GroupLabel>1. Nights that follow two look-alike nights</GroupLabel>
      <Note>{PAIR_QUESTION}</Note>
      <Choice value={s.chosen.pairs} options={PAIR_PREDICTIONS.map((p) => ({ id: p, label: p }))} onChange={(p) => s.choosePairs(p as PairPrediction)} disabledIds={s.committed.pairs ? PAIR_PREDICTIONS.filter((p) => p !== s.committed.pairs) : []} />
      <GroupLabel>2. Over the week</GroupLabel>
      <Note>{TREND_QUESTION}</Note>
      <Choice value={s.chosen.trend} options={TREND_PREDICTIONS.map((p) => ({ id: p, label: p }))} onChange={(p) => s.chooseTrend(p as TrendPrediction)} disabledIds={s.committed.trend ? TREND_PREDICTIONS.filter((p) => p !== s.committed.trend) : []} />
      <div>
        <Btn primary onClick={() => s.commitPredictions()} disabled={!s.canCommitPredictions}>
          Commit my predictions
        </Btn>
      </div>
      <Note>Nothing about how the nights go is shown until the week is finished.</Note>
    </StagePanel>
  )
}

/** The large colored line over the view, always present while a night runs: what is happening now. Its color changes with the tone; its size does not. */
const BANNER_COLOR: Record<BannerTone, string> = { plain: 'var(--text-muted)', act: 'var(--text)', found: 'var(--actuator)', none: '#f0b0a0', call: 'var(--sensor)', nurse: 'var(--actuator)', dawn: '#cfe0ff', pause: '#d8c8ff' }
function NightBanner({ text, tone }: { text: string; tone: BannerTone }) {
  return (
    <div style={{ padding: '10px 16px', borderRadius: 12, background: 'rgba(14, 20, 32, 0.82)', border: `2px solid ${BANNER_COLOR[tone]}`, color: BANNER_COLOR[tone], fontSize: 24, fontWeight: 700, lineHeight: 1.2, textAlign: 'center', width: 320, minHeight: 58, boxSizing: 'border-box', userSelect: 'text' }} data-night-banner={tone}>
      {text}
    </div>
  )
}

/** The question at the end of the week (spec §8.6): the overhead of the clearing, every log by its look and numbered, and one mark per loose-bark log. */
function WeekQuestion({ s }: { s: LogsStore }) {
  const answers = s.answers()
  const loose = s.clearing.logs.filter((l) => l.kind === 'loose')
  return (
    <StagePanel testId="question" wide>
      <div style={{ fontSize: 14, fontWeight: 600 }}>The end of the week</div>
      <Content>{AS_A_PERSON_LINE}</Content>
      <Note>Here is the clearing from above: your nest, the landmarks, and the ten logs, each drawn by its look and numbered. For each loose-bark log, mark when you last emptied it. Smooth logs are not asked about.</Note>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <ClearingOverhead clearing={s.clearing} size={300} label="the question at the end of the week" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 280px' }}>
          {loose.map((l) => (
            <div key={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-question-log={l.id}>
              <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>Log {l.id + 1}</span>
              <Choice value={s.draft[l.id] ?? null} options={answers.map((a) => ({ id: a, label: ANSWER_LABEL[a] }))} onChange={(a) => s.mark(l.id, a)} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Btn primary onClick={() => s.commitQuestion()} disabled={!s.questionComplete}>
          Commit my answers
        </Btn>
        {!s.questionComplete && <Note>Mark every loose-bark log first.</Note>}
      </div>
    </StagePanel>
  )
}

function Right({ ctx }: { ctx: PartContext<LogsStore> }) {
  const s = useStore(ctx.store)
  const r = s.revealed()
  if (!r) {
    return (
      <Panel title="My results — Part 4" style={{ width: 340 }}>
        <Note>{s.state === 'intro' ? 'Press “Begin” over the view.' : 'The nights’ lines, the comparison and the replays appear here after the week is finished.'}</Note>
      </Panel>
    )
  }
  return <LogsReveal result={r.result} predictions={r.predictions} seed={ctx.seed} />
}

function CanvasPart({ ctx }: { ctx: PartContext<LogsStore> }) {
  const s = useStore(ctx.store)
  const features = s.sim?.features ?? (s.state === 'between' && s.run ? s.plan.nights[Math.min(WEEK_NIGHTS, s.nextNight) - 1] : s.plan.practice)
  return <LogsView clearing={s.clearing} features={features} sim={() => s.sim} dawn={() => s.dawn / DAWN_S} view={ctx.view} fov={ctx.fov} lowDetail={ctx.lowDetail} anim={ctx.anim} clock={ctx.clock} practice={s.practicing} />
}

registerResults(4, (progress: ProgressStore) => {
  const r = progress.result(WEEK_UNIT) as Part4WeekResult | undefined
  if (!r || !progress.isComplete(WEEK_UNIT)) return null
  return <LogsReveal result={r} predictions={{ pairs: (progress.prediction(PAIR_PREDICTION_KEY) as PairPrediction | null) ?? null, trend: (progress.prediction(TREND_PREDICTION_KEY) as TrendPrediction | null) ?? null }} seed={progress.seed} />
})

export const logs: PartModule<LogsStore> = {
  createStore: (seed, progress) => new LogsStore(seed, progress),
  Left,
  Stage,
  Right,
  Canvas: CanvasPart,
}

export { LogsStore }
