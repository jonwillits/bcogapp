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

const INTRO: Record<Block, { lines: string[]; content?: string[]; time: string }> = {
  practice: {
    lines: ['Up arrow or W walks forward; left and right arrows, or A and D, turn; down arrow or S steps back slowly. The buttons under the view do the same.', 'Eye view is the animal’s own eyes. Follow view sits behind it and a little above. Switch between them at any time; the trial does not care which you use.', 'Walk out to the beetle and back to the nest, once in each view. Nothing is scored.'],
    content: [SCREEN_LINE, COMFORT_LINE],
    time: 'About 3 minutes.',
  },
  dark: {
    lines: ['You start at the nest, and it disappears from view. Beetles appear one at a time; walk to each.', 'At the last beetle the light goes out. Walk back to where you think the nest is and press Here is my nest.', 'The landmarks are in view on the way out and gone on the way back. Keep track of your own turns and distances as you go: that is all there will be.', 'Six trials, from two legs to four. Each return ends where you press the button, or after two minutes.'],
    time: 'About 6 minutes.',
  },
  moonlight: {
    lines: ['The same, in moonlight throughout: the near landmarks and the tall tree stay in view.', 'Four trials of three legs.'],
    time: 'About 4 minutes.',
  },
  picture: {
    lines: ['Before each trial you see a still picture: the view from the nest, in moonlight. Then the screen fades and you are set down somewhere else, as if carried, with no trip out.', 'The picture stays in a corner. Find the nest by matching the view, and press Here is my nest.', 'Four trials: two set down near the nest, two far from it.'],
    time: 'About 5 minutes.',
  },
  moved: {
    lines: ['Moonlight on the way out, with the tall tree hidden by cloud, so the near landmarks are the only landmarks.', 'At the last beetle something startles you: the screen goes dark for two seconds. The return is in moonlight.', 'Four trials of two or three legs.'],
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
          {s.state === 'intro' && <Intro title="What will happen" lines={INTRO[s.block].lines} content={INTRO[s.block].content} time={INTRO[s.block].time} onBegin={() => s.begin()} />}
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
  const errorPoints = records.map((r, i) => ({ x: r.outwardLength, y: r.error ?? 0, label: `trial ${i + 1}` }))
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
              <RangeOverhead out={out.map((p) => ({ x: p.x, y: p.y }))} back={back.map((p) => ({ x: p.x, y: p.y }))} endpoint={r.endpoint} navigators={scored ? navs.map((n) => ({ label: NAVIGATORS.find((x) => x.id === n.id)!.label, x: n.endpoint.x, y: n.endpoint.y })) : undefined} moved={r.plan.block === 'moved' && r.plan.move !== 0 ? rotateNearLandmarks(r.plan.legs[r.plan.legs.length - 1], r.plan.move) : null} label={`trial ${i + 1} overhead`} />
              <FixedLines
                lines={[
                  `Outward path ${m1(r.outwardLength)}`,
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
