import { Panel } from '../../../components/Panel'
import { InstructionScreen } from '../../m10_memory/progress/InstructionScreen'
import { Btn, FixedLines, Note, PANEL_STYLE, PART_TITLES, StagePanel, useStore } from '../ui'
import type { PartContext } from '../contract'
import { Creature, JudgmentBar } from './Creature'
import type { GroupsStore } from './groupsStore'

/**
 * Part 5's screens before the reveal (spec §9). The instruction screen
 * says only that the student will see the members of two groups and then
 * judge each one's height; nothing before the reveal says more.
 */

export const GROUPS_MINUTES = 12
export const GROUPS_WILL_DO = [
  'You will see the members of two groups of an invented animal, one group at a time: eight members in each, shown one at a time, four times each, for two seconds each. Look at each one.',
  'Then each member of the group is shown again, and you set a bar to the member’s height: drag the slider until the bar is as tall as the animal, then press “Set”. Each member is judged twice. Then the second group, in the same way.',
  'In one of the two groups, each member appears with its name; in the other, with no name. About 64 presentations and 32 judgments in all.',
]
export const GROUPS_KEYS = ['There is nothing to press while the members are shown.', 'The slider sets the bar’s height; “Set” records your judgment.']
export const GROUPS_SITTING_LINE = 'Once you press “Begin”, finish both groups in one sitting. If you leave partway, you will start again with two other groups.'

export const SET_LABEL = (k: number) => `Group ${k + 1} of 2`

export function GroupsLeft({ ctx }: { ctx: PartContext<GroupsStore> }) {
  const s = useStore(ctx.store)
  const n = s.state === 'present' ? s.current.presentation.length : s.state === 'judge' ? s.current.judgments.length : 0
  const lines = s.state === 'present' ? [SET_LABEL(s.set), `showing ${String(s.index + 1).padStart(2)} of ${n}`] : s.state === 'judge' ? [SET_LABEL(s.set), `judging ${String(s.index + 1).padStart(2)} of ${n}`] : s.state === 'revealed' ? ['Finished', ' '] : [' ', ' ']
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.groups} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {s.state === 'intro' && <Note>What will happen is described over the view. Press “Begin” there.</Note>}
          <FixedLines lines={lines} testId="groups-status" />
          {(s.state === 'present' || s.state === 'judge' || s.state === 'between') && <Note>This part is in progress. Leaving now would mean starting over with two other groups.</Note>}
          {s.state === 'revealed' && <Note>The results are over the view, with the rows for the report on the right.</Note>}
        </div>
      </Panel>
    </>
  )
}

export function GroupsStage({ ctx }: { ctx: PartContext<GroupsStore> }) {
  const s = useStore(ctx.store)
  switch (s.state) {
    case 'intro':
      return <InstructionScreen title={PART_TITLES.groups} willDo={GROUPS_WILL_DO} minutes={GROUPS_MINUTES} sitting="one sitting" sittingLine={GROUPS_SITTING_LINE} keys={GROUPS_KEYS} onBegin={() => s.begin()} />
    case 'present': {
      const k = s.shownMember
      const set = s.current
      const m = k === null ? null : set.members[k]
      return (
        <StagePanel testId="present">
          <FixedLines lines={[SET_LABEL(s.set)]} />
          <svg width={300} height={300} viewBox="0 0 300 300" style={{ display: 'block', background: 'var(--bg)', borderRadius: 8, margin: '0 auto' }} role="img" aria-label="a member of the group" data-member={k ?? ''}>
            {m && <Creature kind={set.spec.creature.kind} hue={set.spec.creature.hue} height={m.height} x={150} baseline={270} />}
            {m && m.label && (
              <text x={150} y={292} textAnchor="middle" fontSize={16} fontWeight={600} fill="var(--text)" data-label={m.label}>
                {m.label}
              </text>
            )}
          </svg>
        </StagePanel>
      )
    }
    case 'judge': {
      const k = s.judgedMember
      const set = s.current
      const m = k === null ? null : set.members[k]
      return (
        <StagePanel wide testId="judge">
          <FixedLines lines={[SET_LABEL(s.set), 'Set the bar to this member’s height.']} />
          <svg width={420} height={320} viewBox="0 0 420 320" style={{ display: 'block', background: 'var(--bg)', borderRadius: 8, margin: '0 auto' }} role="img" aria-label="a member of the group and the bar" data-member={k ?? ''}>
            {m && <Creature kind={set.spec.creature.kind} hue={set.spec.creature.hue} height={m.height} x={110} baseline={270} />}
            {m && m.label && (
              <text x={110} y={296} textAnchor="middle" fontSize={16} fontWeight={600} fill="var(--text)" data-label={m.label}>
                {m.label}
              </text>
            )}
            <JudgmentBar height={s.bar} x={320} baseline={270} offset={s.barOffset} />
          </svg>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
            <input type="range" min={10} max={260} step={1} value={s.bar} onChange={(e) => s.setBar(Number(e.target.value))} aria-label="the bar’s height" style={{ width: 260 }} />
            <Btn primary onClick={() => s.commitJudgment()}>
              Set
            </Btn>
          </div>
        </StagePanel>
      )
    }
    case 'between':
      return (
        <StagePanel testId="between">
          <div style={{ fontSize: 14, fontWeight: 600 }}>{SET_LABEL(1)}</div>
          <Note>The second group follows the same way: each member four times, then each judged twice. Press “Begin” when you are set.</Note>
          <div>
            <Btn primary onClick={() => s.beginSecondSet()}>
              Begin
            </Btn>
          </div>
        </StagePanel>
      )
    case 'revealed':
      return null
  }
}
