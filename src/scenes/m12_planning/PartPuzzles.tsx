import { useEffect, useState } from 'react'
import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/planning/progress/store'
import { PROCEDURE_IDS, PROCEDURES, shortestMoves } from '../../sim/planning/puzzles/procedures'
import { arrangementOf, idOf, isGoal } from '../../sim/planning/puzzles/hanoi'
import { sequences, minutesToExamine, timeInWords, FUTURES_PRESETS, STATES_PER_MINUTE } from '../../sim/planning/puzzles/futures'
import { LOOK_COST } from '../../sim/planning/puzzles/trees'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, RIGHT_STYLE, StagePanel, Para, useStore } from './ui'
import { InstructionScreen } from '../m10_memory/progress/InstructionScreen'
import type { PartContext, PartModule } from './contract'
import { PuzzlesStore, TOWER_UNIT, TREES_UNIT } from './puzzles/store'
import { SCREENS, NEXT_LINE, STEP_TITLES, READY_LINE, PROCEDURE_PREDICTIONS, type Step } from './puzzles/screens'
import { Pegs, StateGraphView, TreeView, TreePathPicker, TREE_LEGEND } from './puzzles/Views'
import { TowerReveal, TreesReveal, PuzzlesResults } from './puzzles/Reveal'
import { registerResults } from './Part0'

/**
 * Part 2's screens (spec §6): the left column runs the step; the stage
 * carries the instruction screen, the pegs, the walk through the five
 * procedures, or the tree; the right column carries the step's reveal once
 * its unit is complete, the procedures' table and the futures panel in
 * Step 2. In Step 2 everything the student acts on is on the stage, one
 * procedure at a time: its description, its prediction, then the puzzle
 * with the controls (Jon's walk, 2026-11-11).
 */

type Ctx = PartContext<PuzzlesStore>

registerResults(2, (progress: ProgressStore) => <PuzzlesResults progress={progress} />)

function Left({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const p = useStore(ctx.progress)
  const screen = SCREENS[s.step]
  const state = s.state
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.puzzles} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GroupLabel>Step</GroupLabel>
          <Choice value={String(s.step)} options={([1, 2, 3] as Step[]).map((st) => ({ id: String(st), label: `Step ${st}`, title: STEP_TITLES[st] }))} onChange={(v) => s.open(Number(v) as Step)} />
          <Note>{screen.title}</Note>
          <FixedLines lines={[`Step 1  ${p.isComplete(TOWER_UNIT(4)) ? 'both puzzles solved' : p.isComplete(TOWER_UNIT(3)) ? 'three disks solved' : 'not started'}`, `Step 2  an exploration`, `Step 3  ${p.isComplete(TREES_UNIT) ? 'done' : `${s.treesPartial.records.length} of ${s.totalTrees} trees done`}`]} testId="step-progress" />
          {state === 'intro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-intro>
              <Note>What you will do is described over the view. Read it, then press “Begin”.</Note>
              <Content>{`About ${screen.minutes} minutes. ${screen.kind === 'experiment' ? 'An experiment, done once.' : 'An exploration: leave and return at any time.'}`}</Content>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn primary onClick={() => s.begin()}>
                  Begin
                </Btn>
                {s.step > 1 && <Btn onClick={() => s.open((s.step - 1) as Step)}>Go back to Step {s.step - 1}</Btn>}
                {s.step < 3 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go to Step {s.step + 1}</Btn>}
              </div>
            </div>
          )}
          {state === 'running' && s.step === 1 && (
            <>
              <FixedLines lines={[`${'puzzle'.padEnd(26)}${`${s.disks} disks`.padStart(8)}`, `${'moves so far'.padEnd(26)}${String(s.moves.length).padStart(8)}`, `${'attempts not legal'.padEnd(26)}${String(s.illegalAttempts).padStart(8)}`]} testId="tower-status" />
              <Note>Click a peg to lift its top disk, then click the peg to put it on. The results of this step appear on the right when both puzzles are solved.</Note>
            </>
          )}
          {state === 'running' && s.step === 2 && <Note>The procedures are walked one at a time in the middle of the screen; the table on the right fills as they run.</Note>}
          {state === 'running' && s.step === 3 && (
            <>
              <FixedLines lines={[`${'tree'.padEnd(20)}${`${s.treesPartial.index + 1} of ${s.totalTrees}`.padStart(10)}`, `${'this tree is'.padEnd(20)}${(s.isPractice ? 'practice' : 'scored').padStart(10)}`, `${'clicks this tree'.padEnd(20)}${String(s.looks.length).padStart(10)}`, `${'running total'.padEnd(20)}${String(s.runningTotal).padStart(10)}`]} testId="tree-status" />
              <Note>Uncover numbers by clicking nodes, choose a path, and press “Take this path” over the view. The results of this step appear on the right after the last tree.</Note>
            </>
          )}
          {(state === 'done' || (state === 'running' && s.step === 2)) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {s.step === 2 && <Btn onClick={() => s.reopen()}>Show the instructions again</Btn>}
              {s.step > 1 && <Btn onClick={() => s.open((s.step - 1) as Step)}>Go back to Step {s.step - 1}</Btn>}
              {s.step < 3 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go on to Step {s.step + 1}</Btn>}
              {s.step === 3 && state === 'done' && <Btn onClick={() => ctx.openTab('band')}>Go on to Part 3</Btn>}
            </div>
          )}
          {state === 'done' && <Note>This step is done and saved. Its results are on the right. An experiment is not redone: someone who knows what it tests is no longer a naive subject.{s.step === 1 ? ' The tower can be played again over the view, unrecorded.' : ''}</Note>}
        </div>
      </Panel>
    </>
  )
}

function Stage({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  const screen = SCREENS[s.step]
  const state = s.state
  if (state === 'intro') return <InstructionScreen title={screen.title} willDo={screen.willDo} minutes={screen.minutes} sitting={screen.sitting} sittingLine={screen.sittingLine} ready={READY_LINE} keys={screen.keys} content={screen.content} next={NEXT_LINE[s.step]} onBegin={() => s.begin()} />
  if (s.step === 1) {
    if (state === 'done' && s.replay) {
      const n = s.replay.disks
      const solved = isGoal(s.arrangement)
      return (
        <StagePanel wide testId="replay">
          <div style={{ fontSize: 14, fontWeight: 600 }}>{screen.title}: playing again, not recorded</div>
          <Note>
            {n} disks again, with the map of every arrangement in view. Nothing here is saved: your results on the right stay as they are. The shortest solution is {shortestMoves(n)} moves.
          </Note>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Pegs arrangement={s.arrangement} lifted={s.lifted} onPeg={(p) => s.clickPeg(p)} width={320} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
              <FixedLines lines={[`${'moves'.padEnd(10)}${String(s.moves.length).padStart(4)}`, `${'shortest'.padEnd(10)}${String(shortestMoves(n)).padStart(4)}`]} testId="replay-counter" />
              {s.refusal && <Note style={{ color: 'var(--avoid)' }}>{s.refusal}</Note>}
              {s.lifted !== null && !s.refusal && <Note>A disk is lifted from the {s.lifted === 0 ? 'left' : s.lifted === 1 ? 'middle' : 'right'} peg. Click the peg to put it on, or the same peg to put it back.</Note>}
              {solved && <Note data-replay-solved>Solved in {s.moves.length} moves{s.moves.length === shortestMoves(n) ? ', the shortest possible' : `; the shortest is ${shortestMoves(n)}`}. Nothing is saved.</Note>}
            </div>
          </div>
          <StateGraphView disks={n} path={s.path} width={n === 4 ? 400 : 340} />
          <Note>Dots are arrangements; lines join arrangements one move apart; the heavier line is the shortest solution; the second color is this replay's path so far.</Note>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Btn onClick={() => s.startReplay(n)}>Start this replay again</Btn>
            <Btn onClick={() => s.startReplay(n === 3 ? 4 : 3)}>Play {n === 3 ? 4 : 3} disks instead</Btn>
            <Btn primary onClick={() => s.endReplay()}>
              Back to the results
            </Btn>
          </div>
        </StagePanel>
      )
    }
    if (state === 'done')
      return (
        <StagePanel testId="done">
          <div style={{ fontSize: 14, fontWeight: 600 }}>{screen.title}</div>
          <Note>Both puzzles are solved. The results are on the right, and under “My results, all parts” on the Open tab.</Note>
          <Note>You can play either puzzle again, with the map in view, to try for fewer moves. A replay is not recorded: your results stay as they are.</Note>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Btn onClick={() => s.startReplay(3)}>Play 3 disks again (not recorded)</Btn>
            <Btn onClick={() => s.startReplay(4)}>Play 4 disks again (not recorded)</Btn>
          </div>
          <Note data-next>When you are ready to move on, press “Go on to Step 2” here or on the left.</Note>
          <div>
            <Btn primary onClick={() => s.open(2)}>
              Go on to Step 2
            </Btn>
          </div>
        </StagePanel>
      )
    return (
      <StagePanel testId="tower">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{screen.title}</div>
        <Note>Puzzle {s.disks === 3 ? '1 of 2' : '2 of 2'}: {s.disks} disks. Move the whole stack from the left peg to the right peg.</Note>
        <Pegs arrangement={s.arrangement} lifted={s.lifted} onPeg={(p) => s.clickPeg(p)} />
        <FixedLines lines={[`${'moves'.padEnd(10)}${String(s.moves.length).padStart(4)}`]} testId="move-counter" />
        {s.refusal && <Note style={{ color: 'var(--avoid)' }}>{s.refusal}</Note>}
        {s.lifted !== null && !s.refusal && <Note>A disk is lifted from the {s.lifted === 0 ? 'left' : s.lifted === 1 ? 'middle' : 'right'} peg. Click the peg to put it on, or the same peg to put it back.</Note>}
      </StagePanel>
    )
  }
  if (s.step === 2) return <ProcedureTour s={s} title={screen.title} />
  if (state === 'done')
    return (
      <StagePanel testId="done">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{screen.title}</div>
        <Note>The last path is taken. The results are on the right, and under “My results, all parts” on the Open tab.</Note>
        <Note data-next>When you are ready to move on, press “Go on to Part 3” here or on the left, or choose the Band tab at the top left.</Note>
        <div>
          <Btn primary onClick={() => ctx.openTab('band')}>
            Go on to Part 3
          </Btn>
        </div>
      </StagePanel>
    )
  const t = s.currentTree
  if (!t) return null
  return (
    <StagePanel wide testId="trees">
      <div style={{ fontSize: 14, fontWeight: 600 }}>{screen.title}</div>
      <Note>
        Tree {s.treesPartial.index + 1} of {s.totalTrees}{s.isPractice ? ' (practice, not scored)' : ''}. Each click costs {LOOK_COST} point.
      </Note>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <Big label="points this tree so far" value={String(s.pointsThisTree()).padStart(4)} />
        <Big label="running total, scored trees" value={String(s.runningTotal).padStart(4)} />
      </div>
      <TreeView tree={t} known={s.known} chosen={s.chosen} revealAll={s.revealAll} onLook={(n) => s.look(n)} onChoose={(n) => s.choosePathNode(n)} />
      {!s.revealAll && <TreePathPicker chosen={s.chosen} known={s.known} onChoose={(n) => s.choosePathNode(n)} />}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Btn primary onClick={() => s.takePath()} disabled={!s.canTake}>
          Take this path
        </Btn>
        <Note>{s.revealAll ? 'Every number is shown for a moment; the next tree follows.' : s.chosen.length < 3 ? `Choose ${3 - s.chosen.length} more node${3 - s.chosen.length === 1 ? '' : 's'} for your path.` : 'Your path is chosen.'}</Note>
      </div>
      <Note>{TREE_LEGEND}</Note>
    </StagePanel>
  )
}

/**
 * Step 2's stage: the walk through the five procedures. A row of names at
 * the top goes to any of them; the one on view is read (how it works, what
 * it stores, where it comes from), predicted, then run on the puzzle with
 * the controls under the pegs. Pointing at a dot on the map draws that
 * arrangement in the box beside it. “Go on to the next procedure” appears
 * once the procedure has run; under the fifth, “Go on to Step 3”.
 */
function ProcedureTour({ s, title }: { s: PuzzlesStore; title: string }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const id = s.current
  // The dot under the pointer belongs to one map: a new procedure, setting or start clears it.
  useEffect(() => setHovered(null), [id, s.procDisks, s.start])
  const proc = PROCEDURES[id]
  const pred = PROCEDURE_PREDICTIONS[id]
  const committed = s.predicted(id)
  const k = s.tourIndex + 1
  const last = s.tourIndex === PROCEDURE_IDS.length - 1
  const a = s.arrangementOnView
  const v = s.onView
  const run = v?.run ?? null
  const at = v ? Math.floor(v.index) : 0
  const finished = !!v && !v.playing && at >= run!.states.length - 1
  const path = run ? run.states.slice(0, at + 1).map((st) => idOf(st)) : undefined
  return (
    <StagePanel wide testId="procedures">
      {/* One block inside the scrolling panel, so the pegs, the status lines and the map keep their height when the card is taller than the window: a flex column squashes an SVG and an overflow-hidden block to nothing. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }} data-procedure-card={id}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        <div data-procedure-strip>
          <Choice value={id} options={PROCEDURE_IDS.map((p, i) => ({ id: p, label: `${i + 1}. ${PROCEDURES[p].label}${s.predicted(p) !== null ? ' ✓' : ''}`, title: s.predicted(p) !== null ? 'predicted' : 'not yet predicted' }))} onChange={(p) => s.goTo(p)} />
        </div>
        <GroupLabel>
          Procedure {k} of {PROCEDURE_IDS.length}: {proc.label}
        </GroupLabel>
        <Para>
          {proc.does} It stores {proc.stores}. Source: {proc.source}.
        </Para>
        {committed === null ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, border: '1px solid var(--accent)', borderRadius: 8 }} data-predict={id}>
            <GroupLabel>Predict first</GroupLabel>
            <Note>Use what you have just read. The prediction is saved, and the procedure runs only after it; the puzzle appears here once it is committed.</Note>
            <Content>{pred.question}</Content>
            <Choice value={s.draft[id] ?? null} options={pred.choices.map((c) => ({ id: c, label: c }))} onChange={(c) => s.chooseDraft(id, c)} />
            <div>
              <Btn primary onClick={() => s.commitPrediction()} disabled={!s.draft[id]}>
                Commit my prediction
              </Btn>
            </div>
          </div>
        ) : (
          <>
            <div data-prediction={id}>
              <Note>
                Your prediction: <strong>{committed}</strong>. {pred.check}
              </Note>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }} data-procedure-controls>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <GroupLabel>Disks</GroupLabel>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="range" min={3} max={6} step={1} value={s.procDisks} onChange={(e) => s.setProcDisks(Number(e.target.value))} aria-label="number of disks" style={{ width: 110 }} />
                  <FixedLines lines={[`${s.procDisks} disks, ${3 ** s.procDisks} arrangements`]} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <GroupLabel>Start</GroupLabel>
                <Choice value={s.start} options={[{ id: 'usual', label: 'Usual start' }, { id: 'scramble', label: 'Scramble' }]} onChange={(st) => s.setStart(st as 'usual' | 'scramble')} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <GroupLabel>Speed</GroupLabel>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="range" min={1} max={20} step={1} value={s.speed} onChange={(e) => s.setSpeed(Number(e.target.value))} aria-label="moves a second" style={{ width: 110 }} />
                  <FixedLines lines={[`${String(s.speed).padStart(2)} moves a second`]} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Btn primary onClick={() => s.requestRun(id)} disabled={!!v?.playing}>
                Run
              </Btn>
              {v?.playing && <Btn onClick={() => s.skipToEnd()}>Skip to the end</Btn>}
              <Note>“Run” runs {proc.label} from the start shown, at the setting above.</Note>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Pegs arrangement={a} interactive={false} width={320} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
                <FixedLines
                  lines={[
                    run ? `${PROCEDURES[run.procedure].label}: move ${at} of ${run.moves.length}` : 'No procedure has run at this setting.',
                    run && run.procedure === 'recursion' && run.stackDepths ? `goals on the stack: ${String(run.stackDepths[at] ?? 0).padStart(2)}` : ' ',
                    finished ? (run!.solved ? 'The run is over: the goal is reached.' : 'Stopped short of the goal: the table says why.') : ' ',
                  ]}
                  testId="procedure-status"
                />
                <Note>The pegs show the arrangement as the procedure moves the disks. A finished run stays on view until the next “Run”, or a change of “Disks” or “Start”.</Note>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <StateGraphView disks={s.procDisks} path={path} width={s.procDisks >= 5 ? 400 : 360} hovered={hovered} onHover={setHovered} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
                <Snapshot id={hovered} disks={s.procDisks} path={path} />
                <Note>The map marks the arrangements the run has passed through. Dots are arrangements; lines join arrangements one move apart; the heavier line is the shortest solution. Point at a dot to see that arrangement in the box above.</Note>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} data-go-on>
              {s.hasRun.has(id) ? (
                last ? (
                  <>
                    <Btn primary onClick={() => s.open(3)}>
                      Go on to Step 3
                    </Btn>
                    <Note data-next>All five procedures are predicted and run. Go back to any of them from the row of names, or go on to Step 3.</Note>
                  </>
                ) : (
                  <>
                    <Btn primary onClick={() => s.nextProcedure()}>
                      Go on to the next procedure
                    </Btn>
                    <Note data-next>Next: {PROCEDURES[PROCEDURE_IDS[s.tourIndex + 1]].label}. Or run this one again at another setting first.</Note>
                  </>
                )
              ) : (
                <Note data-next>Press “Run” to see the procedure on the puzzle. {last ? '“Go on to Step 3” appears after the run.' : '“Go on to the next procedure” appears after the run.'}</Note>
              )}
            </div>
          </>
        )}
      </div>
    </StagePanel>
  )
}

/** The arrangement under the pointer, drawn small beside the map, with where the run on view passed through it. */
function Snapshot({ id, disks, path }: { id: number | null; disks: number; path?: number[] }) {
  const box = { width: 220, minHeight: 130, padding: 8, borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column' as const, gap: 4, flexShrink: 0 }
  if (id === null)
    return (
      <div style={box} data-snapshot="none">
        <GroupLabel>Snapshot</GroupLabel>
        <Note>Point at a dot on the map to see that arrangement here.</Note>
      </div>
    )
  const a = arrangementOf(id, disks)
  const k = path ? path.indexOf(id) : -1
  const where = isGoal(a) ? 'the goal' : id === 0 ? 'the usual start' : `arrangement ${id}`
  return (
    <div style={box} data-snapshot={id}>
      <GroupLabel>Snapshot: {where}</GroupLabel>
      <Pegs arrangement={a} interactive={false} width={200} />
      <Note>{k < 0 ? 'The run on view has not passed through it.' : k === 0 ? 'The start of the run on view.' : `The run on view reached it at move ${k}.`}</Note>
    </div>
  )
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} data-big={label}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 600, lineHeight: 1, whiteSpace: 'pre' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const p = useStore(ctx.progress)
  if (s.step === 2) return <ProceduresRight s={s} />
  const done = s.step === 1 ? p.isComplete(TOWER_UNIT(3)) && p.isComplete(TOWER_UNIT(4)) : p.isComplete(TREES_UNIT)
  return (
    <Panel title={`My results: ${STEP_TITLES[s.step]}`} style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!done && <Note>{s.step === 1 ? 'The results of this step appear here once both puzzles are solved. The map of every arrangement is shown only then.' : 'The results of this step appear here once the last path is taken. Nothing about what the trees measure is shown before then.'}</Note>}
        {done && s.step === 1 && <TowerReveal progress={p} />}
        {done && s.step === 3 && <TreesReveal progress={p} />}
      </div>
    </Panel>
  )
}

function ProceduresRight({ s }: { s: PuzzlesStore }) {
  const n = s.procDisks
  const cell = (v: string | number | null) => (v === null ? '—' : String(v))
  const rows = PROCEDURE_IDS.map((id) => {
    const r = s.runs[id]
    const sc = s.scrambledRuns[id]
    const tr = s.transferRuns[id]
    return `${PROCEDURES[id].label.padEnd(28)}${cell(r ? r.moves.length : null).padStart(6)}${cell(r ? r.examined : null).padStart(9)}${cell(r ? r.stored : null).padStart(8)}${cell(sc ? (sc.solved ? 'yes' : 'no') : null).padStart(10)}${cell(tr ? (tr.solved ? 'yes' : 'no') : null).padStart(12)}`
  })
  const stopped = PROCEDURE_IDS.map((id) => [s.runs[id], s.scrambledRuns[id], s.transferRuns[id]]).flat().filter((r) => r && r.stopped)
  const f = s.futures
  return (
    <Panel title="The results table" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Note>
          Each row is a procedure, filled when it has run at the current setting of {n} disks. Moves: how many it made. Examined: how many arrangements it examined (for Search everything, every arrangement taken from its waiting list; for the others, every arrangement passed through). Stored: the most it had to store at once (arrangements waiting, goals on a stack, moves in a list, or one fact). Scrambled: whether its most recent run from a scrambled start solved the puzzle. {n + 1} disks: whether it solved the puzzle with one more disk than the setting, from the usual start.
        </Note>
        <FixedLines lines={[`${'procedure'.padEnd(28)}${'moves'.padStart(6)}${'examined'.padStart(9)}${'stored'.padStart(8)}${'scrambled'.padStart(10)}${`${n + 1} disks`.padStart(12)}`, ...rows, `${'shortest solution'.padEnd(28)}${String(shortestMoves(n)).padStart(6)}`]} testId="procedures-table" />
        {stopped.map((r, i) => (
          <Note key={i} style={{ color: 'var(--avoid)' }}>
            {PROCEDURES[r!.procedure].label}, on {r!.disks} disks: {r!.stopped}
          </Note>
        ))}
        <Note>What each procedure does, what it stores and where it comes from is on the stage, with your prediction, as the walk reaches it.</Note>
        <GroupLabel>The futures panel</GroupLabel>
        <Para>With a number of options at each step and a number of steps ahead, the number of possible sequences is the options multiplied by themselves once per step. At about {STATES_PER_MINUTE} states a minute, the rate the reading gives for people thinking aloud (§12.2.2), examining every sequence takes the time printed.</Para>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, width: 120 }}>Options at each step</span>
          <input type="range" min={2} max={40} step={1} value={f.options} onChange={(e) => s.setFutures(Number(e.target.value), f.steps)} aria-label="options at each step" style={{ width: 140 }} />
          <FixedLines lines={[String(f.options).padStart(3)]} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, width: 120 }}>Steps ahead</span>
          <input type="range" min={1} max={8} step={1} value={f.steps} onChange={(e) => s.setFutures(f.options, Number(e.target.value))} aria-label="steps ahead" style={{ width: 140 }} />
          <FixedLines lines={[String(f.steps).padStart(3)]} />
        </div>
        <FixedLines lines={[`${'possible sequences'.padEnd(22)}${sequences(f.options, f.steps).toLocaleString('en-US').padStart(16)}`, `${'time to examine all'.padEnd(22)}${timeInWords(minutesToExamine(f.options, f.steps)).padStart(16)}`]} testId="futures" />
        <div style={{ display: 'flex', gap: 6 }}>
          {FUTURES_PRESETS.map((pr) => (
            <Btn key={pr.label} small onClick={() => s.setFutures(pr.options, pr.steps)}>
              {pr.label}
            </Btn>
          ))}
        </div>
      </div>
    </Panel>
  )
}

export { PuzzlesStore }

export const puzzles: PartModule<PuzzlesStore> = {
  createStore: (seed, progress) => new PuzzlesStore(seed, progress),
  Left,
  Stage,
  Right,
  Results: ({ progress }) => <PuzzlesResults progress={progress} />,
}
