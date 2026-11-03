import { Panel } from '../../../components/Panel'
import { FILMS, filmById, CHECKLIST, DESCRIPTION_PROMPT, MIN_DESCRIPTION_CHARS, RATING_QUESTION, type CheckId } from '../../../sim/social/shapes/films'
import { GOALS } from '../../../sim/social/paths/maze'
import { InstructionScreen } from '../../m10_memory/progress/InstructionScreen'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, StagePanel, useStore } from '../ui'
import type { PartContext } from '../contract'
import { FilmPlayer, FilmFrame } from './FilmPlayer'
import { MazeView } from './MazeView'
import { ModelsIntroScreen } from './Reveal'
import { MAX_DESCRIPTION_CHARS, type ShapesStore } from './shapesStore'

/**
 * Part 3's screens before each reveal (spec §7). None names what Step 1
 * tests before all three films are described (the rating question and
 * the checklist come only then), and none shows a model's output before
 * the prediction; `shapes.test.tsx` and `naming.test.ts` hold them to that.
 * The two procedures' description, which names goals, lives in
 * `Reveal.tsx` and is shown only after both units are complete.
 */

export const FILMS_MINUTES = 7
export const PATHS_MINUTES = 8

export const FILMS_WILL_DO = [
  'You will watch three short films, about 30 seconds each, of a large triangle, a small triangle, and a small disc moving on a plain stage with a rectangle that has a door. They play by themselves and cannot be paused or replayed.',
  `After each film, you will see a text box, where you will type a reaction: “${DESCRIPTION_PROMPT}” At least ${MIN_DESCRIPTION_CHARS} characters. Write what you saw, in your own words; there is no right answer.`,
  'After the third film and its description, you will be given a few short questions about all three films together, each answered with a button or a check. Then this step is finished.',
]

export const FILMS_KEYS = ['There is nothing to press while a film plays.', '“Next” after a description opens the next film; after the third, the questions.']
export const FILMS_SITTING_LINE = 'Once you press “Begin”, finish the three films and their questions in one sitting. If you leave partway, you will see the same three films again from the first.'

export const PATHS_WILL_DO = [
  'You will see a grid maze with walls and three marked squares, A, B, and C. A dot moves through it, one square at a time, leaving a dashed trace behind it. Now and then the dot pauses.',
  'At each pause, say where the dot is heading: using the three sliders, assign 100 points across A, B, and C. Moving one slider rescales the other two, in proportion to where they stand, so the three always sum to 100. At a later pause on the same path the sliders start where you left them; each new path starts them equal. Press “Commit” and the dot goes on. There are 16 paths and about 40 pauses.',
  'If you leave partway, your answers so far are saved, and the path you were on is replaced by another of the same kind, so no path is shown twice.',
]

export const PATHS_KEYS = ['The three sliders set the points for A, B, and C.', '“Commit” records your answer at a pause; the dot goes on by itself.']
export const PATHS_SITTING_LINE = 'You can leave and come back: the answers you have committed are saved, and the path you were on is replaced by another of the same kind.'

export function ShapesLeft({ ctx }: { ctx: PartContext<ShapesStore> }) {
  const s = useStore(ctx.store)
  const lines = (() => {
    switch (s.state) {
      case 'film':
      case 'describe':
      case 'rate':
        return [`Step 1  film ${s.film} of 3`, s.state === 'film' ? `${String(Math.ceil(FILMS[s.film - 1].duration - s.filmClock)).padStart(3)} s left` : s.state === 'describe' ? 'Describe the film' : 'The questions']
      case 'path':
        return [`Step 2  path ${String(Math.min(s.pathIndex + 1, s.order.length)).padStart(2)} of ${s.order.length}`, `judgments ${String(s.judgmentsSoFar()).padStart(2)} of ${s.judgmentsInAll()}`]
      case 'revealed':
        return ['Finished', ' ']
      default:
        return [s.state === 'intro' ? 'Step 1 — Three films' : s.state === 'step1-done' || s.state === 'paths-intro' ? 'Step 2 — Where is it going?' : 'The two procedures', ' ']
    }
  })()
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.shapes} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FixedLines lines={lines} testId="shapes-status" />
          {(s.state === 'intro' || s.state === 'paths-intro') && <Note>What will happen is described over the view. Press “Begin” there.</Note>}
          {s.state === 'step1-done' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Note>Step 1 is finished and saved. Its results are shown with Step 2’s, after both.</Note>
              <div>
                <Btn primary onClick={() => s.openPaths()}>
                  Go on to Step 2
                </Btn>
              </div>
            </div>
          )}
          {(s.state === 'film' || s.state === 'describe' || s.state === 'rate') && <Note>This step is in progress. Leaving now would mean seeing the three films again from the first.</Note>}
          {s.state === 'path' && <Note>Your committed answers are kept if you leave; the path you are on would be replaced.</Note>}
          {s.state === 'revealed' && <Note>The results are over the view, with the rows for the report on the right.</Note>}
        </div>
      </Panel>
    </>
  )
}

function Sliders({ s }: { s: ShapesStore }) {
  const shown = s.splitRounded()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-sliders>
      {GOALS.map((g, i) => (
        <div key={g} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ width: 16, fontWeight: 700, color: '#f0a94b' }}>{g}</span>
          <input type="range" min={0} max={100} step={1} value={shown[i]} onChange={(e) => s.setSplit(i as 0 | 1 | 2, Number(e.target.value))} aria-label={`points for ${g}`} style={{ width: 220 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, width: 30, textAlign: 'right' }}>{shown[i]}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Btn primary onClick={() => s.commitJudgment()}>
          Commit
        </Btn>
        <FixedLines lines={[`sum ${String(shown[0] + shown[1] + shown[2]).padStart(3)}`]} />
      </div>
    </div>
  )
}

export function ShapesStage({ ctx }: { ctx: PartContext<ShapesStore> }) {
  const s = useStore(ctx.store)
  switch (s.state) {
    case 'intro':
      return <InstructionScreen title={`${PART_TITLES.shapes}: Step 1 — Three films`} willDo={FILMS_WILL_DO} minutes={FILMS_MINUTES} sitting="one sitting" sittingLine={FILMS_SITTING_LINE} keys={FILMS_KEYS} onBegin={() => s.beginFilms()} />
    case 'film':
      return (
        <StagePanel wide testId="film">
          <FixedLines lines={[`Film ${s.film} of 3`]} />
          <FilmPlayer film={filmById(s.film)} playing={s.filmPlaying} onClock={(t) => s.setFilmClock(t)} />
        </StagePanel>
      )
    case 'describe':
      return (
        <StagePanel testId="describe">
          <div style={{ fontSize: 14, fontWeight: 600 }}>{`Film ${s.film} of 3`}</div>
          <Note>{DESCRIPTION_PROMPT}</Note>
          <textarea value={s.descriptions[s.film - 1]} onChange={(e) => s.setDescription(e.target.value)} maxLength={MAX_DESCRIPTION_CHARS} aria-label={`description of film ${s.film}`} autoComplete="off" autoCorrect="off" spellCheck={false} autoFocus style={{ width: '100%', minHeight: 110, resize: 'vertical', fontSize: 13, padding: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)' }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Btn primary onClick={() => s.finishDescription()} disabled={!s.canFinishDescription}>
              Next
            </Btn>
            <FixedLines lines={[`${String(s.descriptions[s.film - 1].trim().length).padStart(4)} characters, at least ${MIN_DESCRIPTION_CHARS}`]} />
          </div>
        </StagePanel>
      )
    case 'rate':
      return (
        <StagePanel wide testId="rate">
          <div style={{ fontSize: 14, fontWeight: 600 }}>The three films</div>
          <Note>For each film, your own description is shown back. Answer the question with a button from 1 to 7, and tick what your description did; “none of these” if none.</Note>
          {FILMS.map((f, k) => (
            <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} data-rate-film={f.id}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 160, flex: 'none' }}>
                  <div style={{ transform: 'scale(0.33)', transformOrigin: 'top left', width: 480, height: 320, marginBottom: -214 }}>
                    <FilmFrame film={f} t={f.duration * 0.4} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <GroupLabel>{f.title}: what you wrote</GroupLabel>
                  <Note style={{ whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{s.descriptions[k]}</Note>
                </div>
              </div>
              <Note>{RATING_QUESTION} 1 is not at all, 7 is very much.</Note>
              <Choice value={s.ratings[k] === null ? null : String(s.ratings[k])} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: String(n), label: String(n) }))} onChange={(v) => s.rate(k, Number(v))} />
              <Note>Your description…</Note>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-checklist={f.id}>
                {CHECKLIST.map((c) => (
                  <label key={c.id} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={s.checks[k].includes(c.id as CheckId)} onChange={() => s.toggleCheck(k, c.id as CheckId)} /> {c.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div>
            <Btn primary onClick={() => s.commitRatings()} disabled={!s.canCommitRatings}>
              Commit my answers
            </Btn>
          </div>
          {!s.canCommitRatings && <Note>“Commit my answers” is available once every film has a number and at least one check.</Note>}
        </StagePanel>
      )
    case 'step1-done':
      return (
        <StagePanel testId="step1-done">
          <div style={{ fontSize: 14, fontWeight: 600 }}>Step 1 is finished</div>
          <Note>Your descriptions and answers are saved. What they show is in the results after Step 2. Press “Go on to Step 2” on the left.</Note>
        </StagePanel>
      )
    case 'paths-intro':
      return <InstructionScreen title={`${PART_TITLES.shapes}: Step 2 — Where is it going?`} willDo={PATHS_WILL_DO} minutes={PATHS_MINUTES} sitting="one sitting" sittingLine={PATHS_SITTING_LINE} keys={PATHS_KEYS} onBegin={() => s.beginPaths()} />
    case 'path': {
      const p = s.path
      if (!p) return null
      return (
        <StagePanel wide testId="path">
          <FixedLines lines={[`Path ${String(s.pathIndex + 1).padStart(2)} of ${s.order.length}`, s.atJudgment ? 'Where is it heading? Give 100 points across A, B and C.' : 'The dot is moving.']} testId="path-status" />
          <MazeView path={p} steps={s.steps} />
          {s.atJudgment && <Sliders s={s} />}
        </StagePanel>
      )
    }
    case 'models-intro':
      return <ModelsIntroScreen s={s} />
    case 'revealed':
      return null
  }
}

export { Content }
