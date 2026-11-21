import {
  Btn,
  Choice,
  Content,
  FixedLines,
  GroupLabel,
  Note,
  StagePanel,
  useRef,
  useWidth,
} from "../ui";
import { BarChart } from "../plots";
import { ONE_CORPUS_LINE } from "../lines";
import {
  VOCABULARY,
  END,
  WHO,
  kindOf,
  verbOf,
  start,
  step as parseStep,
  nextTokens,
} from "../../../sim/language/predictors/grammar";
import { embedding } from "../../../sim/language/predictors/counts";
import {
  predictFromOne,
  predictFromTwo,
  type Prediction,
} from "../../../sim/language/predictors/ngram";
import { STEP3_ONE_POINT, STEP3_PREDICT } from "./texts";
import { PREDICTIONS, type PredictorsStore } from "./store";

/**
 * Step 3's screens (spec §8.4; Jon, 2026-11-17: everything in the center;
 * 2026-11-19: two screens). Prediction from counts: three prompts side by
 * side (girls; girls who chase boys; girls who boys chase), each with what
 * the grammar allows next, the prediction from the one token before and
 * from the two tokens before, after the one prediction is committed and
 * Compute is pressed. One point per word: a token's one list of counts,
 * whatever sentence it is in, from the count model, counted here if Step
 * 2's Count has not run. The Order screen and its switch were cut: the
 * two settings showed nothing a student could see (store.ts).
 */
const idx = (t: string) => VOCABULARY.indexOf(t);

/** The three prompts: a subject alone; a subject with a clause whose last token is a plural noun; a subject with a clause whose last token is a verb. */
export const PROMPTS: string[][] = [
  ["girls"],
  ["girls", "who", "chase", "boys"],
  ["girls", "who", "boys", "chase"],
];

/** The two screens' names, at the top of the stage. */
export function Step3Screens({ s }: { s: PredictorsStore }) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
      data-step3-controls
    >
      <Choice
        value={s.screen3}
        options={[
          { id: "predict", label: "Prediction from counts" },
          { id: "point", label: "One point per word" },
        ]}
        onChange={(v) => s.goScreen3(v as "predict" | "point")}
      />
    </div>
  );
}

/** The Prediction screen's prediction and Compute, above the three columns. */
function PredictControls({ s }: { s: PredictorsStore }) {
  const committed = s.predicted("counts");
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
      data-step3-predict-controls
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: 8,
          border: "1px solid var(--border)",
          borderRadius: 8,
          maxWidth: 560,
        }}
        data-predict="counts"
      >
        <GroupLabel>Predict first</GroupLabel>
        <Note>{PREDICTIONS.counts.question}</Note>
        {committed ? (
          <FixedLines lines={[`Committed: ${committed}`]} mono={false} />
        ) : (
          <>
            <Choice
              value={s.drafts.counts ?? null}
              options={PREDICTIONS.counts.choices.map((c) => ({
                id: c,
                label: c,
              }))}
              onChange={(c) => s.draft("counts", c)}
            />
            <div>
              <Btn
                primary
                onClick={() => s.commit("counts")}
                disabled={!s.drafts.counts}
              >
                Commit my prediction
              </Btn>
            </div>
          </>
        )}
      </div>
      <div>
        <Btn
          primary
          onClick={() => s.compute()}
          disabled={!committed || s.computed}
        >
          Compute
        </Btn>
      </div>
    </div>
  );
}

/** What the grammar allows after a prompt, as kinds of token in plain words, from the parser. */
export function allowedNext(prompt: string[]): string {
  let st = start();
  for (const t of prompt) st = parseStep(st, t);
  if (!st.ok) return "the grammar does not allow this prompt";
  const next = nextTokens(st);
  const kinds: string[] = [];
  const pl = next.filter(
    (t) => kindOf(t) === "verb" && verbOf(t)!.number === "pl",
  ).length;
  const sg = next.filter(
    (t) => kindOf(t) === "verb" && verbOf(t)!.number === "sg",
  ).length;
  const nouns = next.filter((t) => kindOf(t) === "noun").length;
  if (pl) kinds.push("a plural verb form");
  if (sg) kinds.push("a singular verb form");
  if (nouns) kinds.push("a noun");
  if (next.includes(WHO)) kinds.push("“who”");
  if (next.includes(END)) kinds.push("the end mark");
  return kinds.length
    ? kinds.join(", or ")
    : "nothing: the sentence is complete";
}

const color = (t: string) =>
  kindOf(t) === "verb"
    ? verbOf(t)!.number === "pl"
      ? "var(--actuator)"
      : "var(--sensor)"
    : kindOf(t) === "noun"
      ? "var(--accent)"
      : "var(--text-muted)";
const bars = (p: Prediction) =>
  VOCABULARY.map((t, j) => ({ label: t, value: p.probs[j], color: color(t) }))
    .filter((x) => x.value > 0)
    .sort((x, y) => y.value - x.value)
    .slice(0, 12);
const sumOf = (p: Prediction, test: (t: string) => boolean) =>
  VOCABULARY.reduce((acc, t, j) => acc + (test(t) ? p.probs[j] : 0), 0);
const plural = (t: string) =>
  kindOf(t) === "verb" && verbOf(t)!.number === "pl";
const singular = (t: string) =>
  kindOf(t) === "verb" && verbOf(t)!.number === "sg";
const noun = (t: string) => kindOf(t) === "noun";
const sums = (p: Prediction) =>
  `plural verb forms ${sumOf(p, plural).toFixed(2)}, singular verb forms ${sumOf(p, singular).toFixed(2)}, nouns ${sumOf(p, noun).toFixed(2)}`;

/** One prompt's column: the prompt, what the grammar allows next, then the two predictions from counts. */
function PromptColumn({
  s,
  prompt,
  k,
  width,
}: {
  s: PredictorsStore;
  prompt: string[];
  k: number;
  width: number;
}) {
  const last = prompt[prompt.length - 1];
  // The token before a sentence's first token is the end mark of the sentence before, as the corpus is counted as one stream.
  const before = prompt.length >= 2 ? prompt[prompt.length - 2] : END;
  const one = predictFromOne(s.ngram, idx(last));
  const two = predictFromTwo(s.ngram, idx(before), idx(last));
  const pair =
    prompt.length >= 2 ? `“${before} ${last}”` : `the end mark, then “${last}”`;
  const pairCount =
    prompt.length >= 2 ? `“${before} ${last}”` : `the end mark then “${last}”`;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width,
        minWidth: 0,
      }}
      data-prompt-column={prompt.join(" ")}
    >
      <GroupLabel>{`Prompt ${k + 1}: “${prompt.join(" ")}”`}</GroupLabel>
      <Note
        data-allowed-next
      >{`The grammar allows next: ${allowedNext(prompt)}.`}</Note>
      {s.computed && (
        <>
          <Note
            style={{ color: "var(--text)" }}
          >{`From the one token before: after “${last}”`}</Note>
          <Note>{`Each probability is the count of “${last}” followed by the token, divided by ${one.denominator.toLocaleString()}, the count of “${last}” followed by anything. Summed: ${sums(one)}.`}</Note>
          <BarChart
            bars={bars(one)}
            width={width}
            format={(v) => v.toFixed(3)}
            rowH={12}
            testId={`from-one-${k + 1}`}
          />
          <Note
            style={{ color: "var(--text)" }}
          >{`From the two tokens before: after ${pair}`}</Note>
          <Note>{`Each probability is the count of ${pairCount} followed by the token, divided by ${two.denominator.toLocaleString()}. Summed: ${sums(two)}.`}</Note>
          <BarChart
            bars={bars(two)}
            width={width}
            format={(v) => v.toFixed(3)}
            rowH={12}
            testId={`from-two-${k + 1}`}
          />
        </>
      )}
    </div>
  );
}

export function Step3Stage({ s }: { s: PredictorsStore }) {
  const ref = useRef<HTMLDivElement>(null);
  const room = useWidth(ref, 1000);
  // Three columns across only where each gets at least about 320 px; otherwise one under another at a reading width (Jon, 2026-11-20: the columns were a few words wide).
  const inRow = room >= 1000;
  const col = inRow ? Math.floor((room - 32) / 3) : Math.min(640, room);
  return (
    <StagePanel wide testId={`predictors-3-${s.screen3}`}>
      {/* The width is read from this always-mounted wrapper, not from the prompts row, which unmounts with its screen (Jon, 2026-11-20). */}
      <div
        ref={ref}
        style={{
          width: "100%",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          What counts cannot do
        </div>
        <Note>Two screens. Press a screen’s name to go to it.</Note>
        <Step3Screens s={s} />
        {s.screen3 === "predict" && (
          <>
            {STEP3_PREDICT.map((p) => (
              <Note key={p.slice(0, 12)} style={{ color: "var(--text)" }}>
                {p}
              </Note>
            ))}
            <PredictControls s={s} />
            {!s.computed && (
              <Note data-awaiting-commit>
                The predictions from counts appear once your prediction above is
                committed and “Compute” is pressed.
              </Note>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: inRow ? "row" : "column",
                gap: 16,
                alignItems: "flex-start",
                width: "100%",
                minWidth: 0,
              }}
              data-reveal={s.computed ? "ngram" : undefined}
              data-prompts-layout={inRow ? "three-in-a-row" : "stacked"}
            >
              {PROMPTS.map((p, k) => (
                <PromptColumn
                  key={p.join(" ")}
                  s={s}
                  prompt={p}
                  k={k}
                  width={col}
                />
              ))}
            </div>
            {s.computed && (
              <>
                <Note>
                  Plural verb forms are green, singular forms orange, nouns
                  blue, and “who” and the end mark gray. The twelve most
                  probable tokens are shown.
                </Note>
                <Note
                  data-after-compute
                >{`Your prediction: ${s.predicted("counts")}. What decides each prediction is the token or two tokens just before it. After “girls”, and after “girls who chase boys”, the token just before is a plural noun. After “girls who boys chase”, the token just before is a verb, “chase”. The subject of the sentence, “girls”, is further back than either count reaches when a clause stands between.`}</Note>
              </>
            )}
          </>
        )}
        {s.screen3 === "point" && <OnePoint s={s} />}
        <Content>{ONE_CORPUS_LINE}</Content>
      </div>
    </StagePanel>
  );
}

function OnePoint({ s }: { s: PredictorsStore }) {
  const m = s.ensureCounted();
  const e = embedding(m, idx("chases"));
  return (
    <>
      {STEP3_ONE_POINT.map((p) => (
        <Note key={p.slice(0, 12)} style={{ color: "var(--text)" }}>
          {p}
        </Note>
      ))}
      <FixedLines
        lines={[
          `“chases”, in “boys who Mary chases walk”:  the one list of ${e.length} counts`,
          `“chases”, in “Mary chases boys”:           the same list of ${e.length} counts`,
          `the first ten counts of that list: ${Array.from(e.slice(0, 10))
            .map((v) => Math.round(v))
            .join(" ")}`,
        ]}
        testId="one-point"
        scroll
      />
    </>
  );
}
