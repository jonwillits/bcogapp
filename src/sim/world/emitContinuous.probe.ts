/**
 * Emits the continuous fixture data file. Regenerate with:
 *
 *   PROBE=1 npx vitest run --disable-console-intercept -t emitContinuous \
 *     2>/dev/null | sed -n '/BEGIN/,/END/p' | sed '1d;$d' \
 *     > src/sim/world/continuousLineageData.ts
 */
import { it } from 'vitest'
import { buildContinuousFixtureSet } from './continuousLineages'

const r3 = (n: number) => Math.round(n * 1000) / 1000

it('emitContinuous', () => {
  const built = buildContinuousFixtureSet()
  const body = [
    '// GENERATED FILE — do not edit by hand.',
    '//',
    '// The four saved populations of Part 3, produced by running the continuous',
    '// engine per the recipes in `continuousLineages.ts`. Genuine engine output,',
    '// and `continuousLineages.test.ts` proves it by regenerating all four and',
    '// comparing — which is what lets the lab claim a history a student can open',
    '// the tree and check.',
    '//',
    '// Regenerate (from the repo root):',
    '//   PROBE=1 npx vitest run --disable-console-intercept -t emitContinuous \\',
    "//     2>/dev/null | sed -n '/BEGIN/,/END/p' | sed '1d;$d' \\",
    '//     > src/sim/world/continuousLineageData.ts',
    '',
    "import type { ContinuousFixture } from './continuousLineages'",
    '',
    'export const CONTINUOUS_LINEAGE_DATA: ContinuousFixture[] = [',
    built
      .map(
        (fx) =>
          `  {\n    id: '${fx.id}',\n    pool: '${fx.pool}',\n    duration: ${fx.duration},\n` +
          `    memberIds: ${JSON.stringify(fx.memberIds)},\n` +
          `    genomes: [\n${fx.genomes
            .map(
              (g) =>
                `      ${JSON.stringify({
                  wLL: r3(g.wLL), wLR: r3(g.wLR), wRL: r3(g.wRL), wRR: r3(g.wRR),
                  bias: r3(g.bias), hue: r3(g.hue),
                })},`,
            )
            .join('\n')}\n    ],\n` +
          `    lineage: [\n${fx.lineage
            .map(
              (n) =>
                `      ${JSON.stringify({
                  id: n.id, parentId: n.parentId, founderId: n.founderId,
                  bornAt: r3(n.bornAt), diedAt: n.diedAt === null ? null : r3(n.diedAt),
                  mark: r3(n.mark), reproduced: n.reproduced,
                })},`,
            )
            .join('\n')}\n    ],\n  },`,
      )
      .join('\n'),
    ']',
    '',
  ].join('\n')
  console.log('BEGIN')
  console.log(body)
  console.log('END')
}, 900_000)
