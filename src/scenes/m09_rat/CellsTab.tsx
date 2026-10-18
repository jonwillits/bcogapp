import { memo } from 'react'
import { Panel } from '../../components/Panel'
import { CELL_KEYS } from '../../sim/rodent/recording'
import { GRID_SPACINGS } from '../../sim/rodent/spatial/maps'
import { HD_SHOWN } from '../../sim/rodent/spatial/system'
import { HeadDirection } from '../../sim/rodent/spatial/ring'
import { deg } from '../../sim/rodent/spatial/angles'
import { BoxOverhead } from './Overhead'
import { HeatMap, PolarPlot, Rings } from './RecordingPanel'
import { Btn, Choice, Content, FixedLines, GroupLabel, Intro, Note, PANEL_STYLE, WIDE_RIGHT_STYLE } from './ui'
import { ESTIMATE_LINE, GRID_LINE, LESION_ASSUMPTION_LINE, MAP_RULE_LINE, MODELS_LINE, PLACE_LINE, RINGS_LINE, THREE_GROUPS_LINE, TWO_RINGS_LINE } from './lines'
import { DAY_SKIP, SKIPS, STEPS, type CellsStore, type Step } from './cellsStore'
import { useStore, useThrottledStore } from './useStore'

/**
 * Part 3's panels (spec §9). Left: the step, its orienting screen, the
 * prediction and Commit my prediction, the step's controls, Let it explore
 * by itself, Skip ahead, Pin these maps, Clear the maps. Right: the
 * recording panel: the two rings, eight head-direction polar plots, six
 * place-cell maps, two grid-cell maps from each group, the four border
 * cells, the overhead inset with the true path and the estimate, and the
 * pinned maps. No result is rendered before the commit.
 */

export function CellsLeft({ store, header }: { store: CellsStore; header: React.ReactNode }) {
  const s = useStore(store)
  const spec = s.spec
  const session = s.session
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {header}
      <Panel title="Part 3 — Inside the Map" style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GroupLabel>Step</GroupLabel>
          <Choice value={String(s.step)} options={STEPS.map((st) => ({ id: String(st.step), label: `Step ${st.step}`, title: st.title }))} onChange={(v) => s.open(Number(v) as Step)} disabledIds={STEPS.filter((st) => !s.canOpen(st.step)).map((st) => String(st.step))} />
          <Note>{spec.title}</Note>
          {s.state === 'intro' && <Intro title="What will happen" lines={spec.what} time={`About ${spec.minutes} minutes. Drive for the first minute, then let the rat explore and skip the rest.`} onBegin={() => s.begin()} />}
          {s.state === 'predict' && spec.question && spec.choices && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-predict>
              <GroupLabel>Predict first</GroupLabel>
              <Note>{spec.question}</Note>
              <Choice value={s.prediction} options={spec.choices.map((c) => ({ id: c, label: c }))} onChange={(c) => s.choose(c)} />
              <div>
                <Btn primary onClick={() => s.commitPrediction()} disabled={!s.prediction}>
                  Commit my prediction
                </Btn>
              </div>
            </div>
          )}
          {(s.state === 'running' || s.state === 'done') && (
            <>
              {s.committed && <FixedLines lines={[`Your prediction: ${s.committed}`]} mono={false} />}
              <GroupLabel>Driving</GroupLabel>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn onClick={() => s.setExploring(!session.exploring)} primary={session.exploring}>
                  Let it explore by itself
                </Btn>
                {SKIPS.map((k) => (
                  <Btn key={k.label} onClick={() => s.skip(k.seconds, () => s.changed())} disabled={s.skipping}>
                    {k.label}
                  </Btn>
                ))}
                {s.step === 5 && (
                  <Btn onClick={() => s.skip(DAY_SKIP.seconds, () => s.changed())} disabled={s.skipping}>
                    {DAY_SKIP.label}
                  </Btn>
                )}
              </div>
              <GroupLabel>Maps</GroupLabel>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn onClick={() => s.pin()}>Pin these maps</Btn>
                <Btn onClick={() => s.clearMaps()}>Clear the maps</Btn>
                <Btn onClick={() => s.browsePlace()}>Browse other place cells</Btn>
                <Btn onClick={() => s.browseGrid()}>Browse other grid cells</Btn>
              </div>
              {s.step === 2 && s.state === 'running' && (
                <div>
                  <Btn onClick={() => s.finishStep()}>Lights on</Btn>
                </div>
              )}
              {s.step === 3 && s.state === 'running' && (
                <>
                  <GroupLabel>In sight</GroupLabel>
                  <Note>Face the card, then move it. Each move while the rat can see it counts.</Note>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <MoveCardButton store={s} />
                    <Btn onClick={() => s.finishStep()}>Go on</Btn>
                  </div>
                </>
              )}
              {s.step === 4 && s.state === 'running' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {s.inSecondRoom ? <Btn onClick={() => s.backToFirstRoom()}>Back to the first room</Btn> : <Btn onClick={() => s.finishStep()}>Go on</Btn>}
                </div>
              )}
              {s.step === 5 && s.state === 'running' && (
                <>
                  <Content>{LESION_ASSUMPTION_LINE}</Content>
                  <div>
                    <Btn onClick={() => s.finishStep()}>Go on</Btn>
                  </div>
                </>
              )}
              {s.step === 1 && s.state === 'running' && (
                <div>
                  <Btn onClick={() => s.finishStep()}>Go on</Btn>
                </div>
              )}
              {s.state === 'done' && s.step < 5 && (
                <div>
                  <Btn onClick={() => s.open((s.step + 1) as Step)}>Go on to Step {s.step + 1}</Btn>
                </div>
              )}
              <GroupLabel>What the step shows</GroupLabel>
              <FixedLines lines={s.resultLines()} testId="result" />
            </>
          )}
          <Content>{MODELS_LINE}</Content>
          <Content>{ESTIMATE_LINE}</Content>
          <Content>{MAP_RULE_LINE}</Content>
        </div>
      </Panel>
    </div>
  )
}

function MoveCardButton({ store }: { store: CellsStore }) {
  const s = useStore(store)
  return (
    <Btn onClick={() => s.moveCardInSight()} title="Moves the card 90° around the walls while the rat watches">
      Move the card
    </Btn>
  )
}

/** Memoized, so the scene's own re-renders do not redraw it; it redraws on the store's notices, at most twice a second. */
export const CellsRight = memo(function CellsRight({ store }: { store: CellsStore }) {
  // The maps are the cost: redraw this panel at most twice a second.
  const s = useThrottledStore(store, 500)
  const session = s.session
  const hd = session.spatial.hd
  const lower = hd.decodeLower()
  const upper = hd.decodeUpper()
  const maps = session.maps
  const polarKeys = CELL_KEYS.hd
  return (
    <Panel title="The recording" style={WIDE_RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-recording>
        <FixedLines lines={s.lines()} testId="recording-lines" />
        <GroupLabel>The rings: a ring attractor below, the recorded cells above</GroupLabel>
        <Rings lower={hd.lowerRate} upper={hd.upperRate} lowerHeading={lower.heading} upperHeading={upper.heading} lowerStrength={lower.strength} upperStrength={upper.strength} />
        <Content>{TWO_RINGS_LINE}</Content>
        <Content>{RINGS_LINE}</Content>
        <GroupLabel>Head-direction cells</GroupLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {polarKeys.map((k, i) => {
            const t = maps.hdTuning(k)
            return <PolarPlot key={k} rates={t.rates} label={`HD ${Math.round(deg(HeadDirection.preferred(HD_SHOWN[i])))}°`} preferred={t.index > 0.2 ? t.preferred : undefined} />
          })}
        </div>
        <GroupLabel>Firing maps: place cells</GroupLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {s.placeShown.map((i) => (
            <HeatMap key={i} map={maps.rateMap(CELL_KEYS.place[i])} nx={maps.nx} ny={maps.ny} label={`place ${i + 1}`} />
          ))}
        </div>
        <Content>{PLACE_LINE}</Content>
        <GroupLabel>Grid cells</GroupLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {s.gridShown.map(([g, c]) => (
            <HeatMap key={`${g}-${c}`} map={maps.rateMap(CELL_KEYS.grid[g][c])} nx={maps.nx} ny={maps.ny} label={`grid ${g + 1}.${c + 1} ${(GRID_SPACINGS[g] * 100).toFixed(0)}cm`} />
          ))}
        </div>
        <Content>{GRID_LINE}</Content>
        <Content>{THREE_GROUPS_LINE}</Content>
        <GroupLabel>Border cells</GroupLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CELL_KEYS.border.map((k, i) => (
            <HeatMap key={k} map={maps.rateMap(k)} nx={maps.nx} ny={maps.ny} label={['east wall', 'north wall', 'west wall', 'south wall'][i]} />
          ))}
        </div>
        <GroupLabel>Overhead</GroupLabel>
        <BoxOverhead shape={session.room.shape} trace={session.trace} />
        {session.pinned.length > 0 && (
          <>
            <GroupLabel>Pinned maps</GroupLabel>
            {session.pinned.map((p, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-pinned={p.label}>
                <Note>{`${p.label} (${(p.maps.seconds / 60).toFixed(1)} min)`}</Note>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {CELL_KEYS.hd.slice(0, 4).map((k, j) => {
                    const t = p.maps.hdTuning(k)
                    return <PolarPlot key={k} rates={t.rates} label={`HD ${Math.round(deg(HeadDirection.preferred(HD_SHOWN[j])))}°`} size={56} />
                  })}
                  {s.placeShown.slice(0, 4).map((idx) => (
                    <HeatMap key={idx} map={p.maps.rateMap(CELL_KEYS.place[idx])} nx={p.maps.nx} ny={p.maps.ny} label={`place ${idx + 1}`} size={56} />
                  ))}
                  {[0, 1, 2].map((g) => (
                    <HeatMap key={`g${g}`} map={p.maps.rateMap(CELL_KEYS.grid[g][s.gridShown[2 * g][1]])} nx={p.maps.nx} ny={p.maps.ny} label={`grid ${g + 1}`} size={56} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Panel>
  )
})
