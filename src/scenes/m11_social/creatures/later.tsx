import { InstructionScreen } from '../../m10_memory/progress/InstructionScreen'
import { ANSWER_SECONDS, FEEDBACK_SECONDS, SHOWINGS_PER_MEMBER, TRAINING_TRIALS } from '../../../sim/social/creatures/materials'
import { BigChoice, Btn, Choice, FixedLines, GroupLabel, Note, StagePanel, useStore } from '../ui'
import { MemberView, ROUND_KEYS, ROUND_MINUTES, type TrainingWords } from './round1'
import { PREDICTION_KEYS, type CreaturesStore } from './store'

/**
 * Part 5's screens from Round 1's surprise onward (PART5_REDESIGN §3.2,
 * §3.3, §7 item 1): the surprise screen, the sorting test of both rounds,
 * Round 2's instruction screen and its training words, and the
 * predictions before the reveal. These may name groups and kinds; none
 * says what the comparison is, and Round 2's instruction promises nothing
 * about tests (`naming.test.ts`).
 */

export const ROUND2_TITLE = 'Part 5 — Two Rounds: Round 2'

export const SURPRISE_LINES = [
  'Before the last questions of this round, one more thing about the members you were shown: they were of two kinds. Six of the members belonged to one kind and six to the other.',
  'Did you notice, while the members were being shown, that they fell into two kinds? Press “Yes” or “No”. There is no right answer; say what you noticed.',
  'Then you will see the members one at a time again, and for each one you will say which kind it belongs to, by pressing “Kind 1” or “Kind 2”. Which kind you call Kind 1 is up to you; keep to your own choice from one member to the next.',
]

export function SurpriseScreen({ s }: { s: CreaturesStore }) {
  return (
    <StagePanel testId="surprise">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Round 1: two kinds</div>
      {SURPRISE_LINES.map((l) => (
        <Note key={l} style={{ color: 'var(--text)' }}>
          {l}
        </Note>
      ))}
      <BigChoice
        value={null}
        options={[
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ]}
        onChange={(v) => s.answerNoticed(v as 'yes' | 'no')}
        testId="noticed"
      />
    </StagePanel>
  )
}

/** The sorting test: by kind in Round 1, by the two names in Round 2. */
export function SortScreen({ store, roundLabel }: { store: CreaturesStore; roundLabel: string }) {
  const s = useStore(store)
  const item = s.currentSecondItem
  if (!item) return null
  const byName = s.round === 1
  const labels: [string, string] = byName ? [s.materials.names[0], s.materials.names[1]] : ['Kind 1', 'Kind 2']
  return (
    <StagePanel testId="sort">
      <FixedLines lines={[roundLabel, `question ${String(s.secondIndex + 1).padStart(2)} of ${s.materials.secondOrder.length}`]} testId="sort-status" />
      <MemberView family={s.materials.family} hue={s.materials.family.hue} who={item} testId="sort-item" />
      <Note style={{ color: 'var(--text)' }}>{byName ? 'Which group does this member belong to?' : 'Which kind does this member belong to?'}</Note>
      <BigChoice
        value={null}
        options={[
          { id: '0', label: labels[0] },
          { id: '1', label: labels[1] },
        ]}
        onChange={(v) => s.answerSecond(Number(v) as 0 | 1)}
        testId="sort-answer"
      />
    </StagePanel>
  )
}

/** Round 2's instruction screen, in substance decision 4 of the redesign; Jon's wording replaces it when it arrives. The names are read from the materials, never written here. */
export function round2WillDo(names: [string, string]): string[] {
  return [
    `Round 2 uses the other family of the animal: ${TRAINING_TRIALS / SHOWINGS_PER_MEMBER} new members, each shown ${SHOWINGS_PER_MEMBER} times, ${TRAINING_TRIALS} showings in all, as in Round 1. These members belong to two groups, named ${names[0]} and ${names[1]}, with six members in each group.`,
    'At the end of Round 1, you were asked to say which of two kinds each member belonged to. That was probably hard, because nothing had asked you to look for kinds while the members were being shown. This time, learning the two groups is your job, so it should be easier.',
    `On each showing, you will say which group the member belongs to, by pressing the button with the group’s name, “${names[0]}” or “${names[1]}”. You have ${ANSWER_SECONDS} seconds to answer. Then the correct name is shown under the member for ${FEEDBACK_SECONDS} second, with “Right” or “Not quite”, and the next showing follows. On a member’s first showing you have no way to know its group yet, and a guess is fine; the correct name is shown either way, so that on its later showings you can know it. If you do not answer in time, the showing counts as wrong and the next one follows.`,
    `After the ${TRAINING_TRIALS} showings, two series of questions follow, as in Round 1. Then the results of both rounds are shown together.`,
    'When you are ready, press “Begin”.',
  ]
}

export const ROUND2_SITTING_LINE = 'Once you press “Begin”, finish Round 2 in one sitting. If you leave partway, Round 2 starts again with other members of the same family.'

export function Round2Intro({ s }: { s: CreaturesStore }) {
  return <InstructionScreen title={ROUND2_TITLE} willDo={round2WillDo(s.materials.names)} minutes={ROUND_MINUTES} sitting="one sitting" sittingLine={ROUND2_SITTING_LINE} keys={ROUND_KEYS} onBegin={() => s.begin()} />
}

export function round2Training(names: [string, string]): TrainingWords {
  return {
    prompt: 'Which group does this member belong to?',
    buttons: [
      { id: '0', label: names[0] },
      { id: '1', label: names[1] },
    ],
    nameDuringFeedback: (right) => names[Number(right)],
  }
}

export const PREDICTIONS = [
  { key: PREDICTION_KEYS.memory, question: 'In which round was your memory for individual members better, telling a member you were shown from one with a detail changed?' },
  { key: PREDICTION_KEYS.second, question: 'In which round was your sorting better?' },
  { key: PREDICTION_KEYS.newItems, question: 'In which round did you more often say “Seen before” to a new member that was not shown but belonged to one of the two groups?' },
] as const
export const PREDICTION_CHOICES = ['Round 1', 'Round 2', 'about the same']

export function PredictScreen({ store }: { store: CreaturesStore }) {
  const s = useStore(store)
  return (
    <StagePanel testId="predict">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Before your results: three predictions</div>
      <Note style={{ color: 'var(--text)' }}>Both rounds are finished. Round 1 asked you to remember individual members; Round 2 asked you to learn two groups. Both rounds were then tested in the same way: the memory questions, then the sorting. Before any score is shown, predict how the two rounds compare.</Note>
      {PREDICTIONS.map((p) => (
        <div key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-prediction={p.key}>
          <GroupLabel>{p.question}</GroupLabel>
          <Choice value={s.drafts[p.key] ?? null} options={PREDICTION_CHOICES.map((c) => ({ id: c, label: c }))} onChange={(v) => s.choose(p.key, v)} />
        </div>
      ))}
      <div>
        <Btn primary onClick={() => s.commitPredictions()} disabled={!s.canCommit}>
          Commit my prediction
        </Btn>
      </div>
    </StagePanel>
  )
}
