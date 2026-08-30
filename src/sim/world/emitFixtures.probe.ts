/**
 * Emits the fixture data file. Not a test — a generator with a test runner for
 * a host, because the sim layer is TypeScript and this is the cheapest way to
 * run it. Regenerate with:
 *
 *   PROBE=1 npx vitest run --disable-console-intercept -t emit \
 *     2>/dev/null | sed -n '/BEGIN/,/END/p' | sed '1d;$d' > src/sim/world/lineageData.ts
 */
import { it } from 'vitest'
import { buildFixtureSet } from './lineages'

const r3 = (n: number) => Math.round(n * 1000) / 1000

it('emit', () => {
  const built = buildFixtureSet()
  const compact = built.map((fx) => ({
    id: fx.id,
    pool: fx.pool,
    memberIds: fx.memberIds,
    genomes: fx.genomes.map((g) => ({
      wLL: r3(g.wLL), wLR: r3(g.wLR), wRL: r3(g.wRL), wRR: r3(g.wRR),
      bias: r3(g.bias), hue: r3(g.hue),
    })),
    lineage: fx.lineage.map((n) => ({
      id: n.id, parentId: n.parentId, founderId: n.founderId,
      generation: n.generation, hue: r3(n.hue), energy: r3(n.energy),
      reproduced: n.reproduced,
    })),
  }))

  const body = [
    '// GENERATED FILE — do not edit by hand.',
    '//',
    '// The four saved populations of Part 3, produced by running the engine per',
    '// the recipes in `lineages.ts`. They are genuine engine output, and',
    '// `lineages.test.ts` proves it by regenerating all four and comparing —',
    '// which is what lets the lab claim a real history that a student can open',
    '// the tree and check.',
    '//',
    '// Regenerate (from the repo root):',
    '//   PROBE=1 npx vitest run --disable-console-intercept -t emit \\',
    "//     2>/dev/null | sed -n '/BEGIN/,/END/p' | sed '1d;$d' > src/sim/world/lineageData.ts",
    '',
    "import type { LineageFixture } from './lineages'",
    '',
    '// Compact on purpose: pretty-printed this file is 182KB of source noise.',
    'export const LINEAGE_DATA: LineageFixture[] = [',
    compact
      .map(
        (fx) =>
          `  {\n    id: '${fx.id}',\n    pool: '${fx.pool}',\n` +
          `    memberIds: ${JSON.stringify(fx.memberIds)},\n` +
          `    genomes: [\n${fx.genomes.map((g) => `      ${JSON.stringify(g)},`).join('\n')}\n    ],\n` +
          `    lineage: [\n${fx.lineage.map((n) => `      ${JSON.stringify(n)},`).join('\n')}\n    ],\n  },`,
      )
      .join('\n'),
    ']',
    '',
  ].join('\n')

  console.log('BEGIN')
  console.log(body)
  console.log('END')
})
