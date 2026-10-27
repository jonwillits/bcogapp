import { Panel } from '../../../components/Panel'
import { DELAY_S } from '../../../sim/memory/words/design'
import { REMEMBER_KNOW_LINES } from '../../../sim/memory/words/recognition'
import { InstructionScreen } from '../progress/InstructionScreen'
import { BigWord, Btn, Choice, Content, CountingTask, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, RecallBox, StagePanel, useStore } from '../ui'
import type { PartContext } from '../contract'
import { SLOT_COUNT, type ListsStore } from './listsStore'

/**
 * Part 1's screens before the reveal. None of them shows a list word back,
 * scores anything, or names what the part tests; `lists.test.tsx` holds
 * every one of them to that.
 */

export const LISTS_MINUTES = 15

export const LISTS_WILL_DO = [
  `You will see ${SLOT_COUNT} lists of words, one word at a time. The words come at a steady pace, and you cannot slow or stop them.`,
  'After each list, one of two things happens. Either you type every word you remember right away, or you first do a short counting task (30 seconds, answered by clicking) and then type every word you remember. A screen tells you which, when the list ends.',
  'When you type, each word goes in with the “Enter” key and joins a list below the box. A countdown runs. “I’m done” ends the typing early.',
  'After the last list there is one more test. It is described when you get to it.',
]

export const LISTS_KEYS = ['“Enter” adds the word you have typed.', 'In the counting task, click the number that comes next.', '“I’m done” ends the typing for a list early.']

export const RECOGNITION_WILL_DO = [
  'One last test. You will see 31 words, one at a time. For each, say whether it was on one of the lists you saw (“Old”) or not (“New”).',
  'After “Old”, say whether you remember it or know it. The two mean different things. The definitions below follow the ones the researchers who devised this test gave their subjects, and their own sentences are printed with the results afterward:',
  `- ${REMEMBER_KNOW_LINES.remember}`,
  `- ${REMEMBER_KNOW_LINES.know}`,
  'There is no time limit on a word. Once every word is answered, the results of the whole part appear.',
]

export const RECOGNITION_MINUTES = 3

/** The shared screen's default says "have ready"; *ready* is a word on one of the lists, so this part supplies its own line. */
export const READY_LINE = 'Nothing to have on hand: you type into the app. The report is filled in from the results screen afterward.'

export function ListsLeft({ ctx }: { ctx: PartContext<ListsStore> }) {
  const s = useStore(ctx.store)
  const lines = s.state === 'revealed' ? ['Finished'] : [`List ${Math.min(s.slot + 1, SLOT_COUNT)} of ${SLOT_COUNT}`.padEnd(16) + `done ${String(s.listsDone).padStart(2)}`, s.phaseLine()]
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.lists} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(s.state === 'intro' || s.state === 'recognition-intro') && <Note>What will happen is described over the view. Press “Begin” there.</Note>}
          <FixedLines lines={lines} testId="lists-status" />
          {(s.state === 'present' || s.state === 'then' || s.state === 'count' || s.state === 'recall') && <Note>This list is in progress. Leaving now would mean starting over with a new list.</Note>}
          {s.state === 'revealed' && <Note>The results are over the view, with the My results rows on the right.</Note>}
        </div>
      </Panel>
    </>
  )
}

export function ListsStage({ ctx }: { ctx: PartContext<ListsStore> }) {
  const s = useStore(ctx.store)
  switch (s.state) {
    case 'intro':
      return <InstructionScreen title={PART_TITLES.lists} willDo={LISTS_WILL_DO} minutes={LISTS_MINUTES} sitting="one sitting" ready={READY_LINE} keys={LISTS_KEYS} onBegin={() => s.beginList()} />
    case 'list-start':
      return (
        <StagePanel testId="list-start">
          <div style={{ fontSize: 14, fontWeight: 600 }}>{`List ${s.slot + 1} of ${SLOT_COUNT}`}</div>
          <Note>Press “Begin” when you are set. The words start at once.</Note>
          <div>
            <Btn primary onClick={() => s.beginList()}>
              Begin
            </Btn>
          </div>
        </StagePanel>
      )
    case 'present':
      return (
        <StagePanel testId="present">
          <BigWord word={s.word} />
        </StagePanel>
      )
    case 'then':
      return (
        <StagePanel testId="then">
          <div style={{ height: 120, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 600 }} data-then={s.materials?.recall}>
            {s.materials?.recall === 'delayed' ? 'Count backward' : 'Type the words'}
          </div>
        </StagePanel>
      )
    case 'count':
      return (
        <StagePanel testId="count">
          <CountingTask key={`count-${s.slot}`} from={s.materials!.countFrom!} seconds={DELAY_S} onDone={(typed, wrong) => s.countDone(typed, wrong)} />
        </StagePanel>
      )
    case 'recall':
      return (
        <StagePanel testId="recall">
          <RecallBox key={`recall-${s.slot}`} seconds={s.recallSeconds} onDone={(typed) => s.recallDone(typed)} />
        </StagePanel>
      )
    case 'recognition-intro':
      return <InstructionScreen title="One last test" willDo={RECOGNITION_WILL_DO} minutes={RECOGNITION_MINUTES} sitting="one sitting" ready="Nothing. If you leave partway, the test resumes where you left it." onBegin={() => s.beginRecognition()} />
    case 'recognition': {
      const it = s.currentItem
      return (
        <StagePanel testId="recognition">
          <FixedLines lines={[`Word ${String(s.item + 1).padStart(2)} of ${s.items.length}`]} />
          <BigWord word={it?.word ?? null} />
          {!s.awaitingJudgment ? (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }} data-old-new>
              <Btn primary onClick={() => s.answerOld(true)}>
                Old
              </Btn>
              <Btn primary onClick={() => s.answerOld(false)}>
                New
              </Btn>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }} data-judgment>
              <Note>You said Old. Do you remember it, or know it?</Note>
              <Choice value={null} options={[{ id: 'remember', label: 'Remember' }, { id: 'know', label: 'Know' }]} onChange={(j) => s.judge(j)} />
            </div>
          )}
          <Content>{REMEMBER_KNOW_LINES.short}</Content>
        </StagePanel>
      )
    }
    case 'revealed':
      return null
  }
}

export function ListsIdleNote() {
  return (
    <>
      <GroupLabel>My results</GroupLabel>
      <Note>The results appear here once the whole part is finished.</Note>
    </>
  )
}
