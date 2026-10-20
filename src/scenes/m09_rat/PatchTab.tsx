import { Panel } from '../../components/Panel'
import { HABITATS, SETTINGS, averageRate, habitatById, type Habitat } from '../../sim/rodent/patch'
import { Btn, Choice, Content, DotPlot, FixedLines, GroupLabel, Intro, Note, PANEL_STYLE, RIGHT_STYLE } from './ui'
import { LEAVING_LINE } from './lines'
import type { PatchStore } from './patchStore'
import { useStore } from './useStore'

/**
 * The closer's panels (spec §10.1): the habitat, the one rule, Run a
 * night with Skip ahead, Try every setting, and the prediction committed
 * before the answer is shown.
 */

/** The closer's orienting text, shown over the view until Begin. */
export const PATCH_INTRO = {
  title: 'Closer — Stay or Go',
  lines: [
    'The forager goes out at night to patches of beetles under logs and leaf piles. In a patch, beetles turn up quickly at first and then more and more slowly, as the patch runs down. Moving to another patch takes time. The question of this closer is when leaving pays best.',
    'Two habitats. In the rich habitat a fresh patch gives about one beetle every 2 s and the next patch is 12 m away; in the poor habitat, one every 5 s and 30 m away. The forager follows one rule, set by the slider: leave a patch when beetles turn up there more slowly than one every so many seconds.',
    'Predict first, on the left, in which habitat the best rule leaves sooner, and commit the prediction. Then Run a night in each habitat, or Skip ahead to the end of the night, and press Try every setting to see beetles per minute at each of the ten settings. The answer appears once both habitats have been tried.',
  ],
  content: [LEAVING_LINE],
  time: 'About 8 minutes.',
}

export function PatchLeft({ store, header }: { store: PatchStore; header: React.ReactNode }) {
  const s = useStore(store)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {header}
      <Panel title="Closer — Stay or Go" style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!s.started && <Intro time={PATCH_INTRO.time} onBegin={() => s.begin()} />}
          <GroupLabel>Predict first</GroupLabel>
          <Note>In which habitat does the best rule leave a patch sooner?</Note>
          <Choice value={s.prediction} options={HABITATS.map((h) => ({ id: h.id, label: `the ${h.label}` }))} onChange={(h) => s.predict(h as Habitat)} disabledIds={s.committed ? HABITATS.map((h) => h.id).filter((h) => h !== s.committed) : []} />
          <div>
            <Btn primary onClick={() => s.commit()} disabled={!s.prediction || !!s.committed}>
              Commit my prediction
            </Btn>
          </div>
          <GroupLabel>Habitat</GroupLabel>
          <Choice value={s.habitat} options={HABITATS.map((h) => ({ id: h.id, label: h.label }))} onChange={(h) => s.setHabitat(h as Habitat)} />
          <GroupLabel>The rule</GroupLabel>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Leave a patch when beetles turn up there more slowly than one every</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{`${String(s.setting).padStart(2)} s`}</span>
            </span>
            <input type="range" min={0} max={SETTINGS.length - 1} step={1} value={SETTINGS.indexOf(s.setting)} onChange={(e) => s.setSetting(SETTINGS[Number(e.target.value)])} />
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Btn primary onClick={() => s.startNight()} disabled={s.skipping}>
              Run a night
            </Btn>
            <Btn onClick={() => s.skipNight(() => s.changed())} disabled={!s.night || s.skipping}>
              Skip ahead to the end of the night
            </Btn>
            <Btn onClick={() => s.tryEvery(() => s.changed())} disabled={s.skipping}>
              Try every setting
            </Btn>
          </div>
          <FixedLines lines={s.lines()} testId="night-lines" />
          <Content>{LEAVING_LINE}</Content>
        </div>
      </Panel>
    </div>
  )
}

export function PatchRight({ store }: { store: PatchStore }) {
  const s = useStore(store)
  const h = habitatById(s.habitat)
  const curve = s.curves.get(s.habitat)
  const avg = averageRate(h)
  return (
    <Panel title="Beetles per minute against the setting" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Note>{`${h.label}: a fresh patch gives about one beetle every ${(1 / h.rate0).toFixed(0)} s, and the next patch is ${h.spacing} m away.`}</Note>
        {curve ? (
          <>
            <DotPlot points={curve.map((p) => ({ x: p.setting, y: p.perMinute, label: `${p.setting} s: ${p.perMinute.toFixed(2)} per minute` }))} xLabel="leave when slower than one every … s" yLabel="beetles per minute" xMax={27} marks={[{ x: avg.setting, label: `average rate: one every ${avg.setting.toFixed(1)} s` }]} />
            <FixedLines lines={[`Best setting in the ${h.label}: one every ${String(s.bestFor(s.habitat)).padStart(2)} s`, `The habitat’s average rate predicts one every ${avg.setting.toFixed(1).padStart(4)} s`]} testId="best-lines" />
          </>
        ) : (
          <Note>Press Try every setting to run a seeded night at each of ten settings.</Note>
        )}
        <GroupLabel>Both habitats</GroupLabel>
        <FixedLines lines={HABITATS.map((hh) => `${hh.label.padEnd(13)} best ${s.bestFor(hh.id) === null ? ' —' : String(s.bestFor(hh.id)).padStart(2)} s   predicted ${averageRate(hh).setting.toFixed(1).padStart(4)} s`)} />
        {s.committed && <FixedLines lines={[`Your prediction: the ${habitatById(s.committed).label}`, s.answer()]} mono={false} testId="answer" />}
        {!s.committed && <Note>The answer appears here after Commit my prediction, once both habitats have been tried.</Note>}
      </div>
    </Panel>
  )
}
