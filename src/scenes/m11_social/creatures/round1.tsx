import { InstructionScreen } from '../../m10_memory/progress/InstructionScreen'
import { ANSWER_SECONDS, FEEDBACK_SECONDS, SHOWINGS_PER_MEMBER, TRAINING_TRIALS, type Item, type Member, type RoundMaterials } from '../../../sim/social/creatures/materials'
import { BigChoice, FixedLines, Note, StagePanel, useStore } from '../ui'
import { Creature } from './Creature'
import type { CreaturesStore } from './store'

/**
 * Part 5's screens that a student can reach before Round 1's sorting test
 * (PART5_REDESIGN_2026-11-04.md §3.3, §4 item 1): Round 1's instruction
 * screen, the training screen of both rounds, and the memory test of both
 * rounds. No string in this file names a group, a kind, sorting, a
 * category, or a group's name; `naming.test.ts` holds it to that. Round
 * 2's prompt and its two buttons come in as data from `later.tsx`.
 */

export const ROUND_MINUTES = 5
export const ROUND1_TITLE = 'Part 5 — Two Rounds: Round 1'

export const ROUND1_WILL_DO = [
  'In this part, you will do two rounds of a task with the members of an invented animal. In each round, you will first watch a series of showings and answer a question on each one, and then you will answer two series of questions about the members you were shown. This screen describes Round 1. Round 2 is described when you reach it.',
  `In Round 1, you will see ${TRAINING_TRIALS / SHOWINGS_PER_MEMBER} members of one family of the animal, one at a time. Each member is shown ${SHOWINGS_PER_MEMBER} times, so there are ${TRAINING_TRIALS} showings in all. The members look alike in most ways, and each one differs from the others in two small marks on its body and in its size. Your job in this round is to remember each individual member well enough to tell, later, which members you were shown.`,
  `On each showing, you will answer one question with a button: has this member been shown before in this round, or is this the first time? Press “Seen before in this round” or “First time”. You have ${ANSWER_SECONDS} seconds to answer. Then the screen says “Right” or “Not quite” for ${FEEDBACK_SECONDS} second, with the member still in view, and the next showing follows. If you do not answer in time, the showing counts as wrong and the next one follows. On a member’s first showing, “First time” is the right answer; on its second, third, and fourth showings, “Seen before in this round” is the right answer.`,
  `After the ${TRAINING_TRIALS} showings, you will see a series of members one at a time, with no time limit, and you will say for each one whether it was among the members shown in this round, with “Seen before” or “New”. Some of them are members you were shown, exactly as you saw them. Some are members you were not shown, and a few of those look much like a member you were shown. A few further questions follow, and then Round 1 is finished.`,
  'Nothing is scored on the screen during the round. Your answers are saved, and the results of both rounds are shown together at the end of the part.',
  'When you are ready, press “Begin”.',
]

export const ROUND_KEYS = ['Two buttons answer each showing and each later question. The keys 1 and 2 press the left and the right button.', 'There is nothing else to press.']
export const ROUND1_SITTING_LINE = 'Once you press “Begin”, finish Round 1 in one sitting. If you leave partway, Round 1 starts again with other members of the same family.'

export function Round1Intro({ s }: { s: CreaturesStore }) {
  return <InstructionScreen title={ROUND1_TITLE} willDo={ROUND1_WILL_DO} minutes={ROUND_MINUTES} sitting="one sitting" sittingLine={ROUND1_SITTING_LINE} keys={ROUND_KEYS} onBegin={() => s.begin()} />
}

/** A member or an item on the stage, drawn at its height from a fixed baseline. */
export function MemberView({ family, hue, who, name, testId }: { family: RoundMaterials['family']; hue: number; who: Member | Item; name?: string; testId?: string }) {
  return (
    <svg width={300} height={300} viewBox="0 0 300 300" style={{ display: 'block', background: 'var(--bg)', borderRadius: 8, margin: '0 auto' }} role="img" aria-label="a member of the animal" data-member={'member' in who ? `item-${who.id}` : `member-${who.id}`} data-view={testId}>
      <Creature family={family.family} hue={hue} height={who.height} marking={who.marking} patch={who.patch} x={150} baseline={270} />
      {name && (
        <text x={150} y={292} textAnchor="middle" fontSize={16} fontWeight={600} fill="var(--text)" data-name={name}>
          {name}
        </text>
      )}
    </svg>
  )
}

export interface TrainingWords {
  /** The question over the member. */
  prompt: string
  /** The two buttons, left then right, with the answer each sends. */
  buttons: [{ id: string; label: string }, { id: string; label: string }]
  /** The name shown under the member during feedback, if any (Round 2 shows the correct one). */
  nameDuringFeedback?: (rightAnswer: string) => string
}

export const ROUND1_TRAINING: TrainingWords = {
  prompt: 'Has this member been shown before in this round?',
  buttons: [
    { id: 'seen', label: 'Seen before in this round' },
    { id: 'first', label: 'First time' },
  ],
}

export function TrainingScreen({ store, words, roundLabel }: { store: CreaturesStore; words: TrainingWords; roundLabel: string }) {
  const s = useStore(store)
  const m = s.currentMember
  if (!m) return null
  const feedback = s.trialStage === 'feedback'
  const right = s.rightAnswer()
  return (
    <StagePanel testId="train">
      <FixedLines lines={[roundLabel, `showing ${String(s.trial + 1).padStart(2)} of ${TRAINING_TRIALS}`]} testId="train-status" />
      <MemberView family={s.materials.family} hue={s.materials.family.hue} who={m} name={feedback && words.nameDuringFeedback ? words.nameDuringFeedback(right) : undefined} testId="training" />
      <Note style={{ color: 'var(--text)' }}>{words.prompt}</Note>
      <BigChoice value={s.trialAnswer as string | null} options={words.buttons.map((b) => ({ id: b.id, label: b.label }))} onChange={(v) => s.answerTraining(v)} disabled={feedback} testId="training-answer" />
      <FixedLines lines={[feedback ? (s.trialRight ? 'Right' : s.trialAnswer === null ? 'Not quite: no answer in time' : 'Not quite') : ' ']} lineStyle={(l) => (l === 'Right' ? { color: 'var(--accent)' } : l && l.startsWith('Not quite') ? { color: 'var(--sensor)' } : undefined)} testId="feedback" />
    </StagePanel>
  )
}

export function MemoryTestScreen({ store, roundLabel }: { store: CreaturesStore; roundLabel: string }) {
  const s = useStore(store)
  const item = s.currentMemoryItem
  if (!item) return null
  return (
    <StagePanel testId="memory">
      <FixedLines lines={[roundLabel, `question ${String(s.memoryIndex + 1).padStart(2)} of ${s.materials.memoryOrder.length}`]} testId="memory-status" />
      <MemberView family={s.materials.family} hue={s.materials.family.hue} who={item} testId="memory-item" />
      <Note style={{ color: 'var(--text)' }}>Was this member among the members shown in this round?</Note>
      <BigChoice
        value={null}
        options={[
          { id: 'seen', label: 'Seen before' },
          { id: 'new', label: 'New' },
        ]}
        onChange={(v) => s.answerMemory(v as 'seen' | 'new')}
        testId="memory-answer"
      />
    </StagePanel>
  )
}
