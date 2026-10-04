import { Panel } from '../../components/Panel'
import { Section } from '../../components/Section'
import { Button, Toggle } from '../../components/controls'
import { FISH_ANIMALS, fishById } from '../../sim/fish/animals'
import type { FishSceneState } from './FishScene'
import { ByHandBox, FourCounts } from './DecisionTab'
import { GroupLabel, Note, PANEL_STYLE, RIGHT_STYLE, Row, TabBar } from './ui'

/**
 * The Fish tab — Part 2's diagnosis, on the pattern of Lab 4's Worms tab.
 * The healthy fish, then F1 to F4, loaded one at a time into Part 2's stream
 * with the same seed. Each hidden fish hides its numbers, not its structure.
 */
export function FishTab(s: FishSceneState) {
  const { world, scenario } = s
  const inDiagnosis = scenario.key === 'diagnosis'
  const animal = fishById(s.fish)
  const counts = world.testCounts(world.tests[0])

  const left = (
    <Panel title="The fish" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <Note>
        Five fish for Part 2’s stream. One is healthy. Each of the other four is the healthy fish with exactly one thing changed. Loading one puts it in Part 2’s stream with the same seed, so all five face the same test set.
      </Note>
      <GroupLabel>Load a fish</GroupLabel>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FISH_ANIMALS.map((a) => (
          <Button key={a.id} variant={inDiagnosis && a.id === s.fish ? 'primary' : 'default'} onClick={() => s.loadFish(a.id)}>
            {a.label}
          </Button>
        ))}
      </div>
      {!inDiagnosis && <Note>Loading a fish switches the scenario to Part 2.</Note>}
      {inDiagnosis && (
        <>
          <Row label="In the stream now" value={animal.label} mono={false} />
          {animal.hidden && (
            <>
              <Button variant={s.revealed ? 'default' : 'primary'} onClick={() => s.setRevealed(!s.revealed)}>
                {s.revealed ? 'Hide again' : 'Reveal'}
              </Button>
              <Note>
                Until you reveal it, this fish’s numbers are withheld on the Network, Learning and Decision tabs, and so is the evidence panel. What stays: the diagram’s structure, the stream, and its four counts. Commit to a diagnosis before you reveal.
              </Note>
            </>
          )}
          {animal.ownStream && (
            <>
              <Toggle label="This fish’s stream" checked={s.ownStream} onChange={(v) => s.setOwnStream(v)} />
              <Note>{animal.ownStream.says} Switching this on puts the fish in the stream its criterion is set for, with the fish’s stakes. Load the healthy fish and compare its energy there on the Decision tab.</Note>
            </>
          )}
        </>
      )}
    </Panel>
  )

  const right = (
    <Panel title="Diagnosis" style={RIGHT_STYLE}>
      {inDiagnosis ? (
        <>
          <Section key={`${s.fish}-${s.ownStream}-counts`} title={`The four counts — ${animal.label}`} defaultOpen>
            <FourCounts world={world} counts={counts} />
            <Note>On the test set of {world.tests[0].x1.length.toLocaleString('en-US')} encounters, which is the same for every fish at this seed.</Note>
          </Section>
          {animal.hidden && s.revealed && (
            <Section key={`${s.fish}-reveal`} title="Revealed" defaultOpen>
              <Row label="The one change" value="" />
              <Note>{animal.change}</Note>
              <Row label="Where it lives" value="" />
              <Note>{animal.whereText}</Note>
              <Row label="What gives it away" value="" />
              <Note>{animal.gives}</Note>
            </Section>
          )}
          <Section key="by-hand-fish" title="By hand" defaultOpen>
            <ByHandBox />
          </Section>
        </>
      ) : (
        <Note>Load a fish to begin.</Note>
      )}
    </Panel>
  )

  return { left, right }
}
