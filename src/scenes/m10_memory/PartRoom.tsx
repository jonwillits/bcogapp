import { useEffect, useMemo } from 'react'
import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/memory/progress/store'
import { scoreChecklist, CONFIDENCE_LABELS, type Confidence, type Part3Result } from '../../sim/memory/room/checklist'
import { PATH_SECONDS } from '../../sim/memory/room/path'
import type { PartModule } from './contract'
import { InstructionScreen } from './progress/InstructionScreen'
import { registerResults } from './Part0'
import { Btn, Choice, CountingTask, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, RIGHT_STYLE, StagePanel, useStore } from './ui'
import { COUNT_SECONDS, RoomStore, UNIT } from './room/roomStore'
import { RoomReveal } from './room/Reveal'
import { RoomView, preloadRoom } from './room/RoomView'

/**
 * Part 3, What Was in the Room? (spec §7; Jon's answers 3 and 6): a
 * student's dorm room on a fixed camera path for 30 seconds, a counting
 * task, then a checklist of twenty-four things, in the room or not, with
 * confidence. The instruction screen before the room says only what will
 * happen in order; the checklist's own screen explains the checklist
 * fully; the reveal shows Lab 7's scorecards and the room again, free to
 * orbit. One unit; an interrupted run restarts with the other arrangement.
 */

export { RoomStore }

/** The instruction screen before the room. It does not say what the questions are about (Jon, 2026-10-25, answer 6). */
export const ROOM_INTRO = {
  title: PART_TITLES.room,
  willDo: [
    'You will see a room for 30 seconds while the view moves slowly around it. Look at the room; the view moves by itself.',
    'Then a short counting task: for 30 seconds, counting backward by threes from a number by clicking the number that comes next.',
    'Then some questions, one at a time, each answered with a button.',
  ],
  minutes: 10,
  keys: ['There is nothing to press while the room is shown. The counting task and the questions are answered by clicking.'],
}

/** The checklist's own instruction screen, which explains the checklist fully. */
export const CHECKLIST_INTRO = {
  title: 'The questions',
  willDo: [
    'You will see the names of 24 things, one at a time.',
    'For each, say whether it was in the room: “In the room” or “Not in the room”.',
    `Then say how sure you are, from 1 to 4: 1 ${CONFIDENCE_LABELS[1]}, 2 ${CONFIDENCE_LABELS[2]}, 3 ${CONFIDENCE_LABELS[3]}, 4 ${CONFIDENCE_LABELS[4]}.`,
    'There is no going back to an earlier name. Nothing about the room is shown until all 24 are answered.',
  ],
  minutes: 4,
}

const CONFIDENCES: Confidence[] = [1, 2, 3, 4]

function Left({ ctx }: { ctx: { store: RoomStore; header: React.ReactNode } }) {
  const s = useStore(ctx.store)
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.room} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {s.phase === 'intro' && (
            <>
              <Note>What will happen is described over the view.</Note>
              <FixedLines lines={[s.loaded ? 'The room is ready' : 'The room is loading']} />
            </>
          )}
          {(s.phase === 'room' || s.phase === 'count' || s.phase === 'checklist') && <FixedLines lines={s.statusLines()} testId="status" />}
          {s.phase === 'checklist-intro' && <Note>The questions are described over the view.</Note>}
          {s.phase === 'revealed' && (
            <>
              <FixedLines lines={['The part is finished', `Items answered ${String(s.answers.length).padStart(2)} of ${s.order.length}`]} />
              <Note>Your results are on the right, and the room is open to orbit in the view.</Note>
            </>
          )}
        </div>
      </Panel>
    </>
  )
}

function Stage({ ctx }: { ctx: { store: RoomStore } }) {
  const s = useStore(ctx.store)
  switch (s.phase) {
    case 'intro':
      return <InstructionScreen title={ROOM_INTRO.title} willDo={ROOM_INTRO.willDo} minutes={ROOM_INTRO.minutes} sitting="one sitting" keys={ROOM_INTRO.keys} onBegin={() => s.begin()} disabled={!s.loaded} />
    case 'room':
      return null
    case 'count':
      return (
        <StagePanel testId="count">
          <CountingTask from={countFrom(s.seed)} seconds={COUNT_SECONDS} onDone={() => s.countDone()} />
        </StagePanel>
      )
    case 'checklist-intro':
      return <InstructionScreen title={CHECKLIST_INTRO.title} willDo={CHECKLIST_INTRO.willDo} minutes={CHECKLIST_INTRO.minutes} sitting="one sitting" onBegin={() => s.beginChecklist()} />
    case 'checklist': {
      const item = s.currentItem
      if (!item) return null
      return (
        <StagePanel testId="checklist">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, whiteSpace: 'pre', color: 'var(--text-muted)' }}>{`item ${String(item.index + 1).padStart(2)} of ${s.order.length}`}</div>
          <div style={{ height: 90, display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 600 }} data-item={item.id}>
            {item.name}
          </div>
          {s.pendingInRoom === null ? (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Btn primary onClick={() => s.answerInRoom(true)}>
                In the room
              </Btn>
              <Btn primary onClick={() => s.answerInRoom(false)}>
                Not in the room
              </Btn>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <GroupLabel>How sure are you?</GroupLabel>
              <Choice value={null} options={CONFIDENCES.map((c) => ({ id: String(c), label: `${c} — ${CONFIDENCE_LABELS[c]}` }))} onChange={(v) => s.answerConfidence(Number(v) as Confidence)} />
            </div>
          )}
        </StagePanel>
      )
    }
    case 'revealed':
      return null
  }
}

function Right({ ctx }: { ctx: { store: RoomStore } }) {
  const s = useStore(ctx.store)
  if (s.phase !== 'revealed' || !s.result || !s.score) {
    return (
      <Panel title="My results" style={RIGHT_STYLE}>
        <Note>{s.phase === 'intro' ? 'Press “Begin” over the view when the room is ready.' : 'Your results appear here once all 24 questions are answered.'}</Note>
      </Panel>
    )
  }
  return (
    <Panel title="My results" style={{ ...RIGHT_STYLE, width: 520 }}>
      <RoomReveal result={s.result} score={s.score} />
    </Panel>
  )
}

function CanvasPart({ ctx }: { ctx: { store: RoomStore } }) {
  const s = useStore(ctx.store)
  useEffect(() => {
    preloadRoom(s.arrangement)
    // If a model never arrives, the part is not a dead end: Begin opens after a while anyway, with whatever loaded.
    const id = setTimeout(() => ctx.store.setLoaded(), 20000)
    return () => clearTimeout(id)
  }, [s.arrangement, ctx.store])
  const mode = s.phase === 'room' ? 'path' : s.phase === 'revealed' ? 'orbit' : 'hidden'
  const pathT = useMemo(() => () => ctx.store.roomT, [ctx.store])
  return <RoomView arrangement={s.arrangement} mode={mode} pathT={pathT} onLoaded={() => ctx.store.setLoaded()} />
}

/** The counting task's start, a three-digit number from the seed, 200 to 999. */
export function countFrom(seed: number): number {
  return 200 + (((seed ^ 0x3c0) >>> 0) % 800)
}

function Results({ ctx }: { ctx: { store: RoomStore } }) {
  const s = useStore(ctx.store)
  if (!s.result || !s.score) return null
  return <RoomReveal result={s.result} score={s.score} />
}

registerResults(3, (progress: ProgressStore) => {
  const result = progress.isComplete(UNIT) ? (progress.result(UNIT) as Part3Result) : null
  if (!result) return null
  return <RoomReveal result={result} score={scoreChecklist(result.arrangement, result.answers)} />
})

export const room: PartModule<RoomStore> = {
  createStore: (seed, progress) => new RoomStore(seed, progress),
  Left,
  Stage,
  Right,
  Canvas: CanvasPart,
  Results,
}

export { PATH_SECONDS }
