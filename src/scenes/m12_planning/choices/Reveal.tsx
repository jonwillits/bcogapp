import type { ProgressStore } from '../../../sim/planning/progress/store'
import { PAIRS, FRAMING, ANCHOR, CE_AMOUNT, MIXED_LOSS, type PairId } from '../../../sim/planning/choices/gambles'
import { dollars } from '../../../sim/planning/choices/options'
import { DELAYS, REVERSAL_PAIRS, LATER_AMOUNT } from '../../../sim/planning/choices/delays'
import { bestPolicy, DISPENSER_LABEL, DISPENSER_RULE, TAKE_PAUSE, DELIVERY_PAUSE } from '../../../sim/planning/choices/dispensers'
import { classEntry } from '../../../sim/planning/classes'
import { reference } from '../../../sim/planning/references'
import { ClassPanel } from '../ClassPanel'
import { ReferencePanel } from '../ReferencePanel'
import { ITEMS_DRAWN_SEPARATELY_LINE, ONE_VERSION_EACH_LINE, HYPOTHETICAL_MONEY_LINE, LABS_POINTS_LINE, RESTARTED_LINE } from '../lines'
import { Content, DotPlot, FixedLines, GroupLabel, Note, Para, Section } from '../ui'
import { GAMBLES_UNIT, DELAYS_UNIT, dispenserUnit, type GamblesResult, type DelaysResult, type DispenserResult } from './store'

/**
 * Part 1's reveals (spec §5.2, §5.3, §5.4), each rendered only from a
 * completed unit's saved result, and each saying what every axis, row,
 * column, mark and color is, how each number was computed, where every
 * reference value comes from, and the student's own numbers beside the
 * references in a sentence. None states the conclusion the handout asks
 * for. Step 1's reveal never names what Step 2 or Step 3 tests, and the
 * other way round (`naming.test.ts`).
 */

const money = (v: number) => (v < 0 ? `−${dollars(v)}` : dollars(v))

export function GamblesReveal({ progress }: { progress: ProgressStore }) {
  if (!progress.isComplete(GAMBLES_UNIT)) return null
  const r = progress.result(GAMBLES_UNIT) as GamblesResult
  const res = r.results
  const framingText = r.framingMaterials === 1 ? FRAMING.reserve : FRAMING.published
  const anchorText = r.anchorMaterials === 1 ? ANCHOR.reserve : ANCHOR.published
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-reveal="gambles">
      <Content>{HYPOTHETICAL_MONEY_LINE}</Content>
      {r.restarts > 0 && <Content>{RESTARTED_LINE}</Content>}
      <Section n={1} title="Every choice, with both options’ expected values">
        <Para>The expected value of an option is the average of its outcomes, each weighted by its probability (§12.1.1). It is a standard for judging choices, not a description of how they are made. Each row below is one of your money choices: the two options’ expected values in dollars, the option you chose, and whether the option you chose had the higher expected value. A dash means the two were equal.</Para>
        <FixedLines lines={[`${'choice'.padEnd(52)}${'EV of A'.padStart(10)}${'EV of B'.padStart(10)}${'chose'.padStart(7)}${'higher?'.padStart(9)}`, ...res.choices.map((c) => `${c.label.slice(0, 51).padEnd(52)}${money(c.evA).padStart(10)}${money(c.evB).padStart(10)}${(c.chose === 0 ? 'A' : 'B').padStart(7)}${(c.higher === null ? '—' : c.chose === c.higher ? 'yes' : 'no').padStart(9)}`)]} testId="every-choice" />
        <Para>
          Of your {res.againstHigher.of} choices in which one option had the higher expected value, you chose against it {res.againstHigher.gains + res.againstHigher.losses + res.againstHigher.mixed} times: {res.againstHigher.gains} among choices about gains, {res.againstHigher.losses} among choices about losses, and {res.againstHigher.mixed} among the mixed gambles. “A” and “B” here are the options in the order this table lists them, not the sides they had on your screen.
        </Para>
      </Section>
      <Section n={2} title="The four pairs: your choice in the gain version and in the loss version, beside the published shares">
        <Para>Each pair was shown to you twice: once with gains and once with the same amounts and chances as losses, separated by other choices. The row gives what you chose in each version, then the share of the published study’s respondents who chose the counted option (the sure option for pairs 1 and 2, the more probable option for pairs 3 and 4), with the sample size and the source page. Pairs 1, 3 and 4 are from Kahneman and Tversky (1979), in Israeli pounds there; pair 2 is from Tversky and Kahneman (1981). Ruggeri and colleagues (2020) replicated pairs 1, 3 and 4 with 4,098 people in 19 countries; their pooled shares are given only in a figure, so the panel reports in how many countries each pair replicated instead.</Para>
        <FixedLines
          lines={[
            `${'pair'.padEnd(6)}${'version'.padEnd(9)}${'you chose'.padEnd(24)}${'published share'.padEnd(17)}N`,
            ...([1, 2, 3, 4] as PairId[]).flatMap((pair) =>
              (['gain', 'loss'] as const).map((v) => {
                const p = PAIRS[pair][v]
                const chose = r.responses.pairs[`${pair}-${v}`]
                const choseLabel = chose === undefined ? 'not answered' : chose === p.counted ? p.countedLabel : `the other option`
                return `${String(pair).padEnd(6)}${v.padEnd(9)}${choseLabel.padEnd(24)}${`${Math.round(p.source.share * 100)}% chose ${p.countedLabel.replace('the ', '')}`.slice(0, 16).padEnd(17)}${p.source.n}`
              }),
            ),
          ]}
          testId="pairs"
        />
        {([1, 2, 3, 4] as PairId[]).map((pair) => (
          <ClassPanel key={pair} entry={classEntry(`pair${pair}`)} own={[r.responses.pairs[`${pair}-gain`] === undefined ? null : r.responses.pairs[`${pair}-gain`] === PAIRS[pair].gain.counted ? 1 : 0, r.responses.pairs[`${pair}-loss`] === undefined ? null : r.responses.pairs[`${pair}-loss`] === PAIRS[pair].loss.counted ? 1 : 0]} />
        ))}
        <Content>{ITEMS_DRAWN_SEPARATELY_LINE}</Content>
        <ReferencePanel reference={reference('reflection-1979')} />
        <ReferencePanel reference={reference('reflection-2020')} />
        <ReferencePanel reference={reference('pair2-1981')} />
      </Section>
      <Section n={3} title="Your two certainty equivalents">
        <Para>
          Six of your choices were between a 50% chance of gaining ${CE_AMOUNT} and a sure amount that moved after each choice; six more were the same for a 50% chance of losing ${CE_AMOUNT}. The sure amount you treated as equal to each gamble, the midpoint of the last interval the choices narrowed it to, is your certainty equivalent for that gamble: {money(res.certaintyEquivalents.gain)} for the gain, and {money(res.certaintyEquivalents.loss)} for the loss. The gamble’s expected value is ${CE_AMOUNT / 2} in each case. The plot has the gamble’s expected value along the bottom and your certainty equivalent up the side, so a point on the diagonal line would mean you treated the gamble as worth exactly its expected value; a point below the line for the gain means you valued the gamble at less than its expected value, and a point above the line for the loss means you treated the loss as less bad than its expected value.
        </Para>
        <DotPlot points={[{ x: 50, y: res.certaintyEquivalents.gain, label: 'gain', color: 'var(--actuator)' }, { x: 50, y: Math.abs(res.certaintyEquivalents.loss), label: 'loss (size)', color: 'var(--avoid)' }]} xLabel="the gamble’s expected value, dollars" yLabel="your certainty equivalent, dollars" width={320} height={200} xMax={100} yMax={100} marks={[{ x: 50, label: 'EV = $50' }]} legend={[{ label: 'the gain gamble', color: 'var(--actuator)' }, { label: 'the loss gamble, as a size', color: 'var(--avoid)' }]} />
        <ValueFunctionSketch />
        <Para>The curve above is the shape of the value function of prospect theory, as the chapter draws it (§12.2.5; after Kahneman and Tversky, 1979, Figure 3): gains to the right of the reference point and losses to the left, with value up the side. It is drawn without numbers because it is hypothetical. It rises more slowly as gains grow, falls more slowly as losses grow, and is steeper for losses than for gains.</Para>
      </Section>
      <Section n={4} title="Your loss ratio">
        <Para>
          Six of your choices were whether to accept a gamble with a 50% chance of gaining some amount and a 50% chance of losing ${MIXED_LOSS}, the gain moving after each choice. The gain at which you were indifferent, divided by ${MIXED_LOSS}, is your loss ratio: {res.lossRatio.toFixed(2)}. A ratio of 1 would mean a loss counted as much as a gain of the same size; a ratio of 2 would mean a loss counted twice as much. Loss aversion, in the reading’s words, is the tendency for a loss to count for more than a gain of the same size (§12.2.5).
        </Para>
        <FixedLines lines={[`${'your loss ratio'.padEnd(34)}${res.lossRatio.toFixed(2).padStart(6)}`, `${'a loss counts as much as a gain'.padEnd(34)}${'1.00'.padStart(6)}`, `${'Huys et al. (2012), a different task'.padEnd(34)}${'1.40'.padStart(6)}`]} testId="loss-ratio" />
        <ClassPanel entry={classEntry('lossRatio')} own={[res.lossRatio]} />
        <ReferencePanel reference={reference('loss-ratio-huys')} />
        <ReferencePanel reference={reference('loss-ratio-1992')} />
      </Section>
      <Section n={5} title="The problem that was not about money">
        {res.framing ? (
          <>
            <Para>
              You saw the version of the problem in which the outcomes were described as {res.framing.version === 'saved' ? 'lives saved' : 'deaths'}, and you chose {res.framing.choseCertain ? 'the program with the certain outcome' : 'the program with the chance'}. Here is the other version, shown for the first time:
            </Para>
            <Note style={{ color: 'var(--text)' }}>{framingText.intro}</Note>
            <FixedLines lines={[...(res.framing.version === 'saved' ? framingText.lost : framingText.saved)]} mono={false} />
            <Para>Both versions describe the same outcomes: 200 of 600 people saved is 400 of 600 dead, and a one-third chance of saving all 600 is a one-third chance that nobody dies. A change in choice when the same options are described differently is a framing effect (§12.2.5).{r.framingMaterials === 1 ? ' The version you saw was the reserve, about a wildfire, used because the published problem had been shown before your sitting was interrupted; it has no published reference.' : ''}</Para>
            {r.framingMaterials === 0 && (
              <Para>In the published study (Tversky and Kahneman, 1981, p. 453), 72% of 152 people chose the certain program when the outcomes were described as lives saved, and 22% of 155 chose it when they were described as deaths, as the chapter reports (§12.2.5).</Para>
            )}
            <Content>{ONE_VERSION_EACH_LINE}</Content>
            <ClassPanel entry={classEntry('framing')} own={res.framing.version === 'saved' ? [res.framing.choseCertain ? 1 : 0, null] : [null, res.framing.choseCertain ? 1 : 0]} title="A simulated class, split by version: the share choosing the certain program" />
            <ReferencePanel reference={reference('framing-1981')} />
          </>
        ) : (
          <Note>The problem was not answered.</Note>
        )}
      </Section>
      <Section n={6} title="The wheel">
        {res.anchor ? (
          <>
            <Para>
              The wheel stopped at {res.anchor.anchor}, where the seed set it to stop; it looked random, and the number had nothing to do with the question. You then estimated {anchorText.quantity} at {res.anchor.estimate}. Tversky and Kahneman (1974, p. 1128) ran this design with a real wheel: the median estimate was 25 among people whose wheel stopped at 10, and 45 among people whose wheel stopped at 65, as the chapter describes (§12.2.5). The source reports those medians and no spread between people, so no simulated class is drawn.{r.anchorMaterials === 1 ? ' The quantity you were asked about was the reserve question, used because the wheel had been shown before your sitting was interrupted; it has no published reference.' : ''}
            </Para>
            <FixedLines lines={[`${'your anchor'.padEnd(36)}${String(res.anchor.anchor).padStart(5)}`, `${'your estimate'.padEnd(36)}${String(res.anchor.estimate).padStart(5)}`, `${'published median, wheel at 10'.padEnd(36)}${'25'.padStart(5)}`, `${'published median, wheel at 65'.padEnd(36)}${'45'.padStart(5)}`]} testId="anchor" />
            <ClassPanel entry={classEntry('anchor')} own={res.anchor.anchor === 10 ? [res.anchor.estimate, null] : [null, res.anchor.estimate]} />
            <ReferencePanel reference={reference('anchor-1974')} />
          </>
        ) : (
          <Note>The wheel was not answered.</Note>
        )}
      </Section>
    </div>
  )
}

/** The value function's shape, without numbers, as the chapter draws it. */
function ValueFunctionSketch() {
  const pts: string[] = []
  for (let x = -100; x <= 100; x += 4) {
    const v = x >= 0 ? 60 * Math.pow(x / 100, 0.6) : -90 * Math.pow(-x / 100, 0.6)
    pts.push(`${x >= -100 && pts.length === 0 ? 'M' : 'L'}${(x + 110).toFixed(1)},${(110 - v).toFixed(1)}`)
  }
  return (
    <svg width={220} height={220} viewBox="0 0 220 220" role="img" aria-label="the value function of prospect theory, sketched without numbers" data-value-function style={{ background: 'var(--bg)', borderRadius: 8 }}>
      <line x1={10} y1={110} x2={210} y2={110} stroke="var(--border)" />
      <line x1={110} y1={10} x2={110} y2={210} stroke="var(--border)" />
      <path d={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth={2} />
      <text x={200} y={124} fontSize={10} textAnchor="end" fill="var(--text-muted)">
        gains
      </text>
      <text x={20} y={124} fontSize={10} fill="var(--text-muted)">
        losses
      </text>
      <text x={116} y={20} fontSize={10} fill="var(--text-muted)">
        value
      </text>
      <text x={114} y={124} fontSize={9} fill="var(--text-muted)">
        reference point
      </text>
    </svg>
  )
}

export function DelaysReveal({ progress }: { progress: ProgressStore }) {
  if (!progress.isComplete(DELAYS_UNIT)) return null
  const r = progress.result(DELAYS_UNIT) as DelaysResult
  const res = r.results
  const maxDays = 1826
  const curve = (f: (d: number) => number, n = 60) => Array.from({ length: n + 1 }, (_, i) => ({ d: (maxDays * i) / n, v: f((maxDays * i) / n) }))
  const expCurve = curve((d) => LATER_AMOUNT * res.exponential.parameter ** d)
  const hypCurve = curve((d) => LATER_AMOUNT / (1 + res.hyperbolic.parameter * d))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-reveal="delays">
      <Content>{HYPOTHETICAL_MONEY_LINE}</Content>
      {r.restarts > 0 && <Content>{RESTARTED_LINE}</Content>}
      <Section n={1} title="Your indifference points, and two fitted curves">
        <Para>
          For each of five delays, six of your choices were between $100 after the delay and an amount today that moved after each choice. The amount today you treated as equal to $100 after the delay, the midpoint of the last interval the choices narrowed it to, is your indifference point for that delay. The plot has the delay in days along the bottom and the indifference point in dollars up the side, with your five points as dots. Two curves are fitted to the five points by least squares, which chooses each curve’s one parameter to make the summed squared distance between the curve and the points as small as possible. The first curve discounts by a constant factor for every day of delay, V = 100 · γ^D, which is how Module 5 defined discounting: a factor a little below one for every step of delay. The second is hyperbolic, V = 100 / (1 + kD).
        </Para>
        <CurvePlot points={res.points.map((p) => ({ d: p.delay.days, v: p.value }))} curves={[{ label: `constant factor, γ = ${res.exponential.parameter.toFixed(4)} a day`, color: 'var(--sensor)', data: expCurve }, { label: `hyperbolic, k = ${res.hyperbolic.parameter.toFixed(4)} a day`, color: 'var(--accent)', data: hypCurve }]} maxDays={maxDays} />
        <FixedLines lines={[`${'delay'.padEnd(12)}${'days'.padStart(6)}${'indifference point'.padStart(20)}`, ...res.points.map((p) => `${p.delay.label.padEnd(12)}${String(p.delay.days).padStart(6)}${money(p.value).padStart(20)}`), '', `${'curve'.padEnd(20)}${'parameter'.padStart(12)}${'summed squared error'.padStart(22)}`, `${'constant factor γ'.padEnd(20)}${res.exponential.parameter.toFixed(4).padStart(12)}${res.exponential.sse.toFixed(1).padStart(22)}`, `${'hyperbolic k'.padEnd(20)}${res.hyperbolic.parameter.toFixed(4).padStart(12)}${res.hyperbolic.sse.toFixed(1).padStart(22)}`]} testId="indifference" />
        <Para>A smaller summed squared error means the curve passes closer to your five points. γ is the share of a reward’s value that survives one day of delay under the first curve; k is how fast the hyperbolic curve falls at first.</Para>
      </Section>
      <Section n={2} title="The two reversal pairs">
        <Para>Two of your choices were between $50 and $55: once with the $50 today and the $55 in 1 week, and once with the $50 in 52 weeks and the $55 in 53 weeks. The two pairs are the same pair of rewards pushed 52 weeks into the future. The table gives your choice in each, and what each fitted curve says a chooser with your parameter would choose.</Para>
        <FixedLines
          lines={[`${'pair'.padEnd(34)}${'you chose'.padEnd(16)}${'constant factor says'.padEnd(22)}hyperbolic says`, ...res.reversals.map((rv) => `${`${rv.pair.sooner.label} or ${rv.pair.later.label}`.padEnd(34)}${(rv.choseLater === null ? 'not answered' : rv.choseLater ? rv.pair.later.label : rv.pair.sooner.label).padEnd(16)}${(rv.exponentialSaysLater ? rv.pair.later.label : rv.pair.sooner.label).padEnd(22)}${rv.hyperbolicSaysLater ? rv.pair.later.label : rv.pair.sooner.label}`)]}
          testId="reversals"
        />
        <Para>Discounting by a constant factor per day can never reverse a preference between two rewards when both are pushed equally far into the future: the later reward’s value is multiplied by γ⁷ relative to the sooner one in both pairs, since the two are 7 days apart in both, so whichever is worth more today is worth more in a year. A hyperbolic curve can reverse it: it falls steeply at first and slowly later, so 7 days of delay take a large share from a reward that is otherwise due today and a small share from one that is already a year away. This is a result the reading does not report.</Para>
      </Section>
      <Section n={3} title="Your k, and the class">
        <ClassPanel entry={classEntry('discountK')} own={[res.hyperbolic.parameter]} />
        <ReferencePanel reference={reference('discounting-sources')} />
      </Section>
      <Section n={4} title="From the reading">
        <Para>Delay discounting is the tendency for a reward to count for less the longer one must wait for it, measured by offering a smaller reward sooner against a larger reward later (§12.2.6). This step measured it from your choices: the five indifference points are how much $100 after each delay was worth to you today. Waiting for the larger reward is a test of self-control, in the reading’s words: acting for a later or larger outcome against a present temptation.</Para>
      </Section>
    </div>
  )
}

function CurvePlot({ points, curves, maxDays }: { points: { d: number; v: number }[]; curves: { label: string; color: string; data: { d: number; v: number }[] }[]; maxDays: number }) {
  const w = 420
  const h = 220
  const pad = { l: 44, r: 12, t: 10, b: 30 }
  const X = (d: number) => pad.l + (d / maxDays) * (w - pad.l - pad.r)
  const Y = (v: number) => h - pad.b - (Math.min(100, Math.max(0, v)) / 100) * (h - pad.t - pad.b)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-curveplot>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="indifference point against delay, with two fitted curves" style={{ background: 'var(--bg)', borderRadius: 8, maxWidth: '100%' }}>
        <line x1={pad.l} y1={Y(0)} x2={w - pad.r} y2={Y(0)} stroke="var(--border)" />
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={Y(0)} stroke="var(--border)" />
        {curves.map((c) => (
          <path key={c.label} d={c.data.map((p, i) => `${i ? 'L' : 'M'}${X(p.d).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')} fill="none" stroke={c.color} strokeWidth={1.6} data-series={c.label} />
        ))}
        {points.map((p) => (
          <circle key={p.d} cx={X(p.d)} cy={Y(p.v)} r={4} fill="var(--text)" />
        ))}
        <text x={pad.l - 4} y={Y(100) + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">
          $100
        </text>
        <text x={pad.l - 4} y={Y(0) + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">
          $0
        </text>
        <text x={w - pad.r} y={Y(0) + 12} fontSize={9} textAnchor="end" fill="var(--text-muted)">
          {maxDays} days
        </text>
        <text x={(pad.l + w - pad.r) / 2} y={h - 8} fontSize={10} textAnchor="middle" fill="var(--text-muted)">
          delay, days
        </text>
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 10.5, color: 'var(--text-muted)' }}>
        {curves.map((c) => (
          <span key={c.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 3, background: c.color, display: 'inline-block' }} />
            {c.label}
          </span>
        ))}
        <span>● your indifference points</span>
      </div>
    </div>
  )
}

export function DispensersReveal({ progress }: { progress: ProgressStore }) {
  if (!progress.isComplete(dispenserUnit(0)) || !progress.isComplete(dispenserUnit(1))) return null
  const blocks = [progress.result(dispenserUnit(0)) as DispenserResult, progress.result(dispenserUnit(1)) as DispenserResult]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-reveal="dispensers">
      <Content>{LABS_POINTS_LINE}</Content>
      {blocks.some((b) => b.restarts > 0) && <Content>{RESTARTED_LINE}</Content>}
      <Section n={1} title="Each dispenser’s trials, in order">
        {blocks.map((b) => {
          const best = bestPolicy(b.dispenser)
          return (
            <div key={b.dispenser} style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-block-result={b.dispenser}>
              <GroupLabel>
                Block {b.order + 1}: {DISPENSER_LABEL[b.dispenser]}
              </GroupLabel>
              <Para>
                Each row is one trial: how many seconds you waited from the trial’s start, and how it ended: a delivery of 5 points, your taking 1 point, or the end of the block. Over the block you waited for the delivery on {b.waitedForDelivery} of {b.trials.length} trials and took 1 point on {b.tookEarly}, for {b.points} points, which is {b.pointsPerMinute.toFixed(1)} points a minute. The best policy for this dispenser, computed exactly from its rule, is: {best.description} It earns {best.pointsPerMinute.toFixed(1)} points a minute on average.
              </Para>
              <FixedLines lines={[`${'trial'.padEnd(7)}${'waited, s'.padStart(10)}  how it ended`, ...b.trials.map((t, i) => `${String(i + 1).padEnd(7)}${t.waited.toFixed(1).padStart(10)}  ${t.end === 'delivered' ? '5 points delivered' : t.end === 'took' ? 'you took 1 point' : 'the block ended'}`)]} testId={`trials-${b.dispenser}`} />
            </div>
          )
        })}
      </Section>
      <Section n={2} title="What was hidden: each dispenser’s rule">
        <Para>{DISPENSER_RULE.blue}</Para>
        <Para>{DISPENSER_RULE.orange}</Para>
        <Para>
          After a delivery the next trial started after {DELIVERY_PAUSE} second; after a take, after {TAKE_PAUSE} seconds. So at the blue dispenser, always waiting earned 5 points every 9 seconds, and at the orange, waiting 8 seconds and then taking a point earned 5 points on the trials that delivered and 1 point on the trials that did not.
        </Para>
      </Section>
      <Section n={3} title="The reading’s comparison">
        <Para>In the study the reading describes (§12.2.6), an experimenter twice promised children better art supplies and then either brought them or returned empty-handed. In the marshmallow test that followed, children whose experimenter had broken her promises waited about 3 minutes on average, against about 12 minutes for children whose experimenter had kept them (Kidd, Palmeri and Aslin, 2013). The lab’s dispensers are a version of a design by McGuire and Kable (2012), which the reading does not report: whether waiting is worth it depends on what the dispenser has done before, and a person who waits at one and not the other is tracking that history.</Para>
        <ReferencePanel reference={reference('kidd-2013')} />
        <ReferencePanel reference={reference('mcguire-kable-2012')} />
      </Section>
    </div>
  )
}

/** Part 1's My results: every finished step's reveal, and a line for each step not done. */
export function ChoicesResults({ progress }: { progress: ProgressStore }) {
  const gambles = progress.isComplete(GAMBLES_UNIT)
  const delays = progress.isComplete(DELAYS_UNIT)
  const dispensers = progress.isComplete(dispenserUnit(0)) && progress.isComplete(dispenserUnit(1))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} data-results="choices">
      <GroupLabel>Step 1 — Gambles</GroupLabel>
      {gambles ? <GamblesReveal progress={progress} /> : <Note>Step 1 is not finished. Its results appear here once its last choice is made.</Note>}
      <GroupLabel>Step 2 — Delays</GroupLabel>
      {delays ? <DelaysReveal progress={progress} /> : <Note>Step 2 is not finished. Its results appear here once its last choice is made.</Note>}
      <GroupLabel>Step 3 — Two dispensers</GroupLabel>
      {dispensers ? <DispensersReveal progress={progress} /> : <Note>Step 3 is not finished. Its results appear here once both blocks are done.</Note>}
    </div>
  )
}

export { DELAYS, REVERSAL_PAIRS }
