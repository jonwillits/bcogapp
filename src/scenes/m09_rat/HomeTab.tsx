import { Panel } from '../../components/Panel'
import { BLOCKS, NAVIGATORS, type Block } from '../../sim/rodent/homing'
import { rotateNearLandmarks } from '../../sim/rodent/range'
import { RangeOverhead } from './Overhead'
import { Btn, Choice, ConflictLine, Content, DotPlot, FixedLines, GroupLabel, Intro, Note, PANEL_STYLE, RIGHT_STYLE, m1 } from './ui'
import { COMFORT_LINE, NAVIGATORS_LINE, SCREEN_LINE } from './lines'
import type { HomeStore } from './homeStore'
import { useStore } from './useStore'

/**
 * Part 1's panels (spec §7). The left panel runs the block: the orienting
 * screen with Begin, the trials' status lines, Here is my nest, Commit my
 * trials, Go on. The right panel is the reveal, and before the commit it
 * holds nothing from the records: no nest, no path, no error, no
 * navigator, and no overhead inset (§12, item 7).
 */

/** Each block's orienting text, shown over the view before Begin (the side panel keeps the time and the button). */
export const INTRO: Record<Block, { lines: string[]; content?: string[]; time: string }> = {
  practice: {
    lines: [
      'You are a small mammal on the forest floor at night, a few steps from your nest, the dark hole under the arched root. A beetle is a small green glint among the leaves. This step is for getting the feel of the keys and the two views; nothing is scored.',
      'Up arrow or W walks forward; left and right arrows, or A and D, turn; down arrow or S steps back slowly. The buttons under the view do the same.',
      'Eye view is the animal’s own eyes. Follow view sits behind it and a little above. Switch between them at any time; the trial does not care which you use.',
      'Walk out to the beetle; it is taken when you reach it. Walk back to the nest and press Here is my nest. Two trials: do one in each view.',
    ],
    content: [SCREEN_LINE, COMFORT_LINE],
    time: 'About 3 minutes.',
  },
  dark: {
    lines: [
      'For this step the range is bare: no log, no rocks, no stump, no tree. You start at the nest, a plain spot on the ground that you will not see again, and beetles appear one at a time, each a few meters from the last. Walk to each. After the last one, walk back to where you started and press Here is my nest.',
      'With nothing on the ground to steer by, the only way back is what the reading calls path integration: a running sum of your own turns and distances, kept as you go, that points to the start from wherever you are. Keep track of your own turns and distances as you go: that is all there will be.',
      'Six trials. Four in moonlight, with two, three, four and three beetles. Then two more of three beetles each, in which the light goes out at the last beetle and nothing is left but the ground within a step or two.',
      'Each return ends where you press the button, or after two minutes.',
    ],
    time: 'About 6 minutes.',
  },
  moonlight: {
    lines: [
      'The range as it was: the fallen log, the two rocks and the stump stand near the nest, and the tall tree can be seen from anywhere. Four trials of three beetles, in moonlight throughout, with the nest out of view from the start as before.',
      'Now there are two things to go by, your running sum and the landmarks. The reading asks how an animal combines them, and what each is worth. Use whatever helps you.',
      'After you commit, the reveal shows where you ended on each trial, and where four programs ended when given your exact trips.',
    ],
    time: 'About 4 minutes.',
  },
  picture: {
    lines: [
      'Before each trial you see a still picture in the lower right of the view: the scene from the nest, facing north, in moonlight. Then the screen fades and you are set down somewhere else, as if carried, with no trip out. The picture stays in its corner.',
      'A stored view of a place is what the reading calls a snapshot. Find the nest by matching what you see to the picture, and press Here is my nest.',
      'Four trials: two set down near the nest, two set down far from it. Being carried registers as no movement, so there is no running sum to fall back on.',
    ],
    time: 'About 5 minutes.',
  },
  moved: {
    lines: [
      'Moonlight on the way out, with the tall tree hidden by cloud, so the near landmarks are the only landmarks. Two or three beetles a trial.',
      'At the last beetle something startles you: the screen goes dark for two seconds. The return is in moonlight. Walk home and press Here is my nest.',
      'The reading says a landmark is worth using only if it stays where it is, and asks what an animal does when its running sum and its landmarks disagree. Four trials; on some of them, the range after the startle is not quite as it was.',
    ],
    time: 'About 5 minutes.',
  },
}

export function HomeLeft({ store, header }: { store: HomeStore; header: React.ReactNode }) {
  const s = useStore(store)
  const spec = s.spec
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {header}
      <Panel title="Part 1 — The Way Home" style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GroupLabel>Step</GroupLabel>
          <Choice value={s.block} options={BLOCKS.map((b) => ({ id: b.id, label: b.title.replace(/ — .*/, ''), title: b.title }))} onChange={(b) => s.open(b)} disabledIds={BLOCKS.filter((b) => !s.canOpen(b.id)).map((b) => b.id)} />
          <Note>{spec.title}</Note>
          {s.state === 'intro' && <Intro time={INTRO[s.block].time} onBegin={() => s.begin()} />}
          {s.state === 'trials' && (
            <>
              <FixedLines lines={s.statusLines()} testId="status" />
              <div>
                <Btn primary onClick={() => s.here()} disabled={!s.trial || s.trial.phase !== 'return' || s.trial.blackout > 0}>
                  Here is my nest
                </Btn>
              </div>
              <Note>Nothing about where the nest truly is appears until you commit the block’s trials.</Note>
            </>
          )}
          {s.state === 'awaiting-commit' && (
            <>
              <FixedLines lines={[`Trials done ${s.records.length} of ${spec.trials}`, null]} />
              <div>
                <Btn primary onClick={() => s.commit()}>
                  Commit my trials
                </Btn>
              </div>
              <Note>After the commit the overhead view opens for every trial, with the nest, your endpoint and the error, and the four navigators take your trips.</Note>
            </>
          )}
          {s.state === 'revealed' && (
            <>
              <FixedLines lines={[`Trials committed ${s.records.length} of ${spec.trials}`, s.block === 'practice' ? 'Nothing is scored in practice' : null]} />
              {s.nextBlock && (
                <div>
                  <Btn onClick={() => s.goOn()}>Go on to {BLOCKS.find((b) => b.id === s.nextBlock)!.title.replace(/ — .*/, '')}</Btn>
                </div>
              )}
            </>
          )}
        </div>
      </Panel>
    </div>
  )
}

export function HomeRight({ store }: { store: HomeStore }) {
  const s = useStore(store)
  const reveal = s.revealed()
  if (!reveal) {
    return (
      <Panel title="The reveal" style={RIGHT_STYLE}>
        <Note>{s.state === 'intro' ? 'Press Begin on the left.' : 'The overhead view, the errors and the navigators appear here after Commit my trials.'}</Note>
      </Panel>
    )
  }
  const { records, navigators } = reveal
  const scored = s.block !== 'practice'
  const errorPoints = records.map((r, i) => ({ x: r.outwardLength, y: r.error ?? 0, label: `trial ${i + 1}${r.plan.lightBack === 'dark' ? ', dark' : ''}` }))
  return (
    <Panel title="The reveal" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-reveal>
        {records.map((r, i) => {
          const out = r.steps.filter((st) => st.phase === 'out')
          const back = r.steps.filter((st) => st.phase === 'return')
          const navs = navigators[i]
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-trial-reveal={i}>
              <GroupLabel>{`Trial ${i + 1}`}</GroupLabel>
              <RangeOverhead bare={r.plan.bare} out={out.map((p) => ({ x: p.x, y: p.y }))} back={back.map((p) => ({ x: p.x, y: p.y }))} endpoint={r.endpoint} navigators={scored ? navs.map((n) => ({ label: NAVIGATORS.find((x) => x.id === n.id)!.label, x: n.endpoint.x, y: n.endpoint.y })) : undefined} moved={r.plan.block === 'moved' && r.plan.move !== 0 ? rotateNearLandmarks(r.plan.legs[r.plan.legs.length - 1], r.plan.move) : null} label={`trial ${i + 1} overhead`} />
              <FixedLines
                lines={[
                  `Outward path ${m1(r.outwardLength)}${r.plan.block === 'dark' ? (r.plan.lightBack === 'dark' ? '   return in the dark' : '   return in moonlight') : ''}`,
                  `Error from the nest ${m1(r.error ?? 0)}${r.timedOut ? '  (time ran out)' : ''}`,
                  `Time in eye view ${r.viewSeconds.eye.toFixed(0).padStart(4)} s, in follow view ${r.viewSeconds.follow.toFixed(0).padStart(4)} s`,
                  r.plan.block === 'moved' ? (r.plan.move === 0 ? 'Landmarks not moved on this trial' : `Landmarks moved ${Math.round((Math.abs(r.plan.move) * 180) / Math.PI)}°; your score on the line ${(r.conflictScore ?? 0).toFixed(2)}`) : null,
                ]}
              />
              {r.plan.block === 'moved' && r.plan.move !== 0 && <ConflictLine score={r.conflictScore} others={navs.map((n) => ({ label: NAVIGATORS.find((x) => x.id === n.id)!.label, score: n.conflictScore ?? 0 }))} />}
              {scored && (
                <FixedLines
                  lines={navs.map((n) => `${NAVIGATORS.find((x) => x.id === n.id)!.label.padEnd(17)} error ${m1(n.error)}   from you ${m1(n.fromStudent ?? 0)}`)}
                  testId={`navigators-${i}`}
                />
              )}
            </div>
          )
        })}
        {s.block === 'dark' && (
          <>
            <GroupLabel>Error against the length of the outward path</GroupLabel>
            <DotPlot points={errorPoints} xLabel="outward path, m" yLabel="error, m" />
          </>
        )}
        {scored && (
          <>
            <GroupLabel>The navigators</GroupLabel>
            {NAVIGATORS.map((n) => (
              <Note key={n.id}>
                <b style={{ color: 'var(--text)' }}>{n.label}.</b> {n.line}
              </Note>
            ))}
            <Content>{NAVIGATORS_LINE}</Content>
          </>
        )}
      </div>
    </Panel>
  )
}
