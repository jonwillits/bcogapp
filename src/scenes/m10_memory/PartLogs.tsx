import { useEffect, useMemo, useRef } from 'react'
import { Panel } from '../../components/Panel'
import { BLOCK_LABEL, describeFeatures } from '../../sim/memory/logs/features'
import { ANSWER_LABEL } from '../../sim/memory/logs/mapQuestion'
import { DIG_S, EAT_S, NIGHT_S, NURSE_S, PRACTICE_S } from '../../sim/memory/logs/night'
import { SECOND_BLOCK_PREDICTIONS, type Part4BlockResult, type SecondBlockPrediction } from '../../sim/memory/logs/results'
import type { ProgressStore } from '../../sim/memory/progress/store'
import { InstructionScreen } from './progress/InstructionScreen'
import { Btn, Choice, Content, Countdown, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, StagePanel, useStore } from './ui'
import { COMFORT_LINE, KIND_RULE, MAP_FOLLOWS_LINE, RATS_LINE, REFILL_RULE } from './lines'
import type { PartContext, PartModule } from './contract'
import { DAWN_S, LogsStore } from './logs/logsStore'
import { LogsView } from './logs/LogsView'
import { ClearingOverhead } from './logs/Overhead'
import { LogsReveal } from './logs/Reveal'
import { NightSound } from './logs/sound'
import { registerResults } from './Part0'

/**
 * Part 4, Nights at the Logs (spec §8): the student is the mammal,
 * foraging at ten logs over six nights in two blocks, under a stated
 * refill rule, with a map question after each night. Lab 9's rat, range,
 * cameras and orienting panel; the fifth instalment of the creature spine.
 */

export const LOGS_INTRO = {
  title: PART_TITLES.logs,
  willDo: [
    'You are the small mammal of Lab 9, back in its range at night. Out from your nest lie ten logs: seven with loose bark and three that are smooth. You will walk to a log, dig to see what is under it, and eat what you find.',
    `A dig takes about ${DIG_S} seconds and shows whether beetles are there; eating them takes about ${EAT_S} more. A night lasts about ${NIGHT_S} seconds; a timer over the view counts it down. At dawn the animal walks back to the nest by itself.`,
    `Partway through each night the young in the nest call. Digging stops until you have gone back to the nest and nursed them, which takes about ${NURSE_S} seconds and happens by itself once you are there. Then the night goes on.`,
    `First a practice night around your own nest, which you may redo; it is longer, about ${PRACTICE_S} seconds, for learning the keys. Then two blocks of three nights each, in two other clearings of the range, each with its own nest, logs and landmarks. A fixed line beside the view repeats the two rules below.`,
    '- ' + KIND_RULE,
    '- ' + REFILL_RULE,
  ],
  minutes: 22,
  keys: ['Up arrow or W walks forward; left and right arrows, or A and D, turn; down arrow or S steps back. The buttons under the view do the same.', '“Enter” or the space bar digs at the log you are standing by; so does the “Dig” button under the view.', 'An energy bar drains over the night and rises with each meal. It never ends the night; the score is beetles eaten.'],
  content: [RATS_LINE, COMFORT_LINE],
}

export const PRACTICE_INTRO = {
  title: 'The practice night',
  willDo: [`One night in the clearing around your own nest, with the logs as they are tonight. Nothing is scored. Use it to learn the keys, the dig, the young’s call and the dawn. This night is longer than the others, about ${PRACTICE_S} seconds; the scored nights are about ${NIGHT_S}.`, 'You may redo the practice night as often as you like.'],
  minutes: 3,
}

export function blockIntro(kind: 'look-alike' | 'distinct', mapSeen: boolean, restartedHere: boolean) {
  return {
    title: `A block of three nights: ${BLOCK_LABEL[kind]}`,
    willDo: [
      kind === 'look-alike' ? 'These three nights will look alike.' : 'Each of these three nights will look different.',
      'Each block starts with every loose-bark log full, and the two rules hold across the three nights. Beetles eaten is the score.',
      ...(mapSeen ? [MAP_FOLLOWS_LINE] : []),
      ...(restartedHere ? ['This block was interrupted, so it runs again in another clearing.'] : []),
    ],
    minutes: 5,
  }
}

export const PREDICT_QUESTION = 'Compared with the first three nights, in the next three nights will you confuse which night you emptied a log more often, less often, or about as often?'

function Left({ ctx }: { ctx: PartContext<LogsStore> }) {
  const s = useStore(ctx.store)
  const sound = useMemo(() => new NightSound(), [])
  const calledRef = useRef(false)
  useEffect(() => () => sound.stop(), [sound])
  // The night's sound, started after Begin (a click), and the young's call.
  useEffect(() => {
    if (s.state === 'night' && s.sim) {
      sound.setMuted(s.muted)
      sound.play(s.sim.features.sound)
    } else sound.stop()
  }, [s.state, s.sim, s.muted, sound, s.version])
  if (s.state === 'night' && s.sim) {
    if (s.sim.called && !calledRef.current) {
      calledRef.current = true
      if (!s.muted) sound.call()
    }
    if (!s.sim.called) calledRef.current = false
  }
  const restartedHere = s.blockIndex >= 0 && s.progress.materialsSlot(s.blockIndex === 0 ? 'p4-block-1' : 'p4-block-2') > 0
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.logs} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Content>{RATS_LINE}</Content>
          {(s.state === 'intro' || s.state === 'practice-intro' || s.state === 'block-intro') && <Note>What will happen is described over the view. Press “Begin” there.</Note>}
          {s.state === 'night' && s.sim && (
            <>
              <GroupLabel>Tonight</GroupLabel>
              <FixedLines lines={s.statusLines()} testId="night-status" />
              <Note>Tonight: {describeFeatures(s.sim.features)}.</Note>
              <Note>Energy, which rises with each meal:</Note>
              <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, border: '1px solid var(--border)' }} aria-label="energy">
                <div style={{ height: '100%', width: `${Math.round(s.sim.energy * 100)}%`, background: 'var(--actuator)', borderRadius: 4 }} />
              </div>
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
                Go on to the first block
              </Btn>
              <Btn onClick={() => s.openPractice()}>Redo the practice night</Btn>
            </div>
          )}
          {s.state === 'predict' && (
            <>
              <GroupLabel>Predict first</GroupLabel>
              <Note>{PREDICT_QUESTION}</Note>
              <Choice value={s.prediction} options={SECOND_BLOCK_PREDICTIONS.map((p) => ({ id: p, label: p }))} onChange={(p) => s.predict(p as SecondBlockPrediction)} disabledIds={s.committed ? SECOND_BLOCK_PREDICTIONS.filter((p) => p !== s.committed) : []} />
              <div>
                <Btn primary onClick={() => s.commitPrediction()} disabled={!s.prediction || !!s.committed}>
                  Commit my prediction
                </Btn>
              </div>
              <Note>Nothing about the first block is shown until this is committed and the second block is finished.</Note>
            </>
          )}
          {s.state === 'revealed' && (
            <>
              <FixedLines lines={['Both blocks finished', s.committed ? `Your prediction: ${s.committed}` : '']} />
              <Btn onClick={() => s.openPractice()}>Redo the practice night</Btn>
            </>
          )}
          {restartedHere && s.state === 'block-intro' && <Note>This block was interrupted, so it runs again in another clearing.</Note>}
          {s.state === 'block-intro' && s.blockIndex === 0 && s.practice && (
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
  if (s.state === 'block-intro' && s.block) {
    const i = s.blockIndex as 0 | 1
    const restartedHere = s.progress.materialsSlot(i === 0 ? 'p4-block-1' : 'p4-block-2') > 0
    return <InstructionScreen {...blockIntro(s.block.kind, s.mapSeen, restartedHere)} sitting="one sitting" onBegin={() => s.beginBlock()} ready="Nothing is needed." />
  }
  if (s.state === 'night' && s.sim) {
    const fade = s.fade > 0 ? Math.min(1, s.fade / 0.6) : 0
    const banner = s.banner()
    return (
      <>
        {fade > 0 && <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: fade }} data-fade />}
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
          <div style={{ padding: '8px 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, width: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Countdown left={s.sim.seconds - s.sim.time} total={s.sim.seconds} big />
            <FixedLines lines={s.statusLines()} testId="night-status-over" />
          </div>
          {banner && <NightBanner text={banner.text} tone={banner.tone} />}
        </div>
      </>
    )
  }
  if (s.state === 'night-over') {
    return (
      <StagePanel testId="night-over">
        <div style={{ fontSize: 14, fontWeight: 600 }}>The practice night is over</div>
        <Note>Beetles eaten: {s.practice?.beetles ?? 0}. Press “Go on to the first block” on the left, or redo the practice night.</Note>
      </StagePanel>
    )
  }
  if (s.state === 'map') return <MapQuestion s={s} />
  if (s.state === 'predict') {
    return (
      <StagePanel testId="predict">
        <div style={{ fontSize: 14, fontWeight: 600 }}>Before the second block</div>
        <Note>{PREDICT_QUESTION} Choose on the left and press “Commit my prediction”.</Note>
      </StagePanel>
    )
  }
  return null
}

/** The large colored line over the view: the young's call in amber, the nursing in green, the dawn in the morning's light. Its color changes; its size does not. */
const BANNER_COLOR = { call: 'var(--sensor)', nurse: 'var(--actuator)', dawn: '#cfe0ff' } as const
function NightBanner({ text, tone }: { text: string; tone: keyof typeof BANNER_COLOR }) {
  return (
    <div style={{ padding: '10px 16px', borderRadius: 12, background: 'rgba(14, 20, 32, 0.82)', border: `2px solid ${BANNER_COLOR[tone]}`, color: BANNER_COLOR[tone], fontSize: 24, fontWeight: 700, lineHeight: 1.2, textAlign: 'center', width: 320, boxSizing: 'border-box', userSelect: 'text' }} data-night-banner={tone}>
      {text}
    </div>
  )
}

/** The map question after each night (spec §8.6): the overhead of the clearing, and one mark per loose-bark log. */
function MapQuestion({ s }: { s: LogsStore }) {
  const night = s.mapNight
  const answers = s.mapAnswers()
  const loose = s.clearing.logs.filter((l) => l.kind === 'loose')
  return (
    <StagePanel testId="map" wide>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Night {night}: the map</div>
      <Note>Here is the clearing from above: your nest, the landmarks, and the ten logs by number. For each loose-bark log, mark what is true of it tonight. Smooth logs are not asked about.</Note>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <ClearingOverhead clearing={s.clearing} size={280} label={`the map question for night ${night}`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 260px' }}>
          {loose.map((l) => (
            <div key={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-map-log={l.id}>
              <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>Log {l.id + 1}</span>
              <Choice value={s.draft[l.id] ?? null} options={answers.map((a) => ({ id: a, label: ANSWER_LABEL[a] }))} onChange={(a) => s.mark(l.id, a)} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Btn primary onClick={() => s.commitMap()} disabled={!s.mapComplete}>
          Commit the map
        </Btn>
        {!s.mapComplete && <Note>Mark every loose-bark log first.</Note>}
      </div>
      {s.mapSeen && <Content>{MAP_FOLLOWS_LINE}</Content>}
    </StagePanel>
  )
}

function Right({ ctx }: { ctx: PartContext<LogsStore> }) {
  const s = useStore(ctx.store)
  const r = s.revealed()
  if (!r) {
    return (
      <Panel title="My results — Part 4" style={{ width: 340 }}>
        <Note>{s.state === 'intro' ? 'Press “Begin” over the view.' : 'The nights’ tallies, the map answers and the replays appear here after both blocks are finished.'}</Note>
      </Panel>
    )
  }
  return <LogsReveal first={r.first} second={r.second} prediction={r.prediction} seed={ctx.seed} />
}

function CanvasPart({ ctx }: { ctx: PartContext<LogsStore> }) {
  const s = useStore(ctx.store)
  const features = s.sim?.features ?? s.plan.practice
  return <LogsView clearing={s.clearing} features={features} sim={() => s.sim} dawn={() => s.dawn / DAWN_S} view={ctx.view} fov={ctx.fov} lowDetail={ctx.lowDetail} anim={ctx.anim} clock={ctx.clock} />
}

registerResults(4, (progress: ProgressStore) => {
  const a = progress.result('p4-block-1') as Part4BlockResult | undefined
  const b = progress.result('p4-block-2') as Part4BlockResult | undefined
  if (!a || !b) return null
  return <LogsReveal first={a} second={b} prediction={(progress.prediction('p4-second-block') as SecondBlockPrediction | null) ?? null} seed={progress.seed} />
})

export const logs: PartModule<LogsStore> = {
  createStore: (seed, progress) => new LogsStore(seed, progress),
  Left,
  Stage,
  Right,
  Canvas: CanvasPart,
}

export { LogsStore }
