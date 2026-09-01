import { defineConfig } from 'vitest/config'

/**
 * The unit suite and the tuning probes are separate bodies of work and must not
 * run together.
 *
 * `npm run test` gates the deploy, so it has to stay fast and deterministic —
 * it runs `*.test.ts` only. The `*.probe.ts` files sweep the evolution engine's
 * parameter space over dozens of fifty-generation runs; they take minutes, they
 * assert nothing, and their output is a table to read. They are kept in the
 * repo because the tuned constants in `food.ts` and `evolutionWorld.ts` are
 * only defensible alongside the measurements that chose them.
 *
 *   PROBE=1 npx vitest run --disable-console-intercept -t "cost model"
 */
export default defineConfig({
  test: {
    include: process.env.PROBE ? ['src/**/*.probe.ts'] : ['src/**/*.test.ts'],
    // The Module 2 acceptance tests run whole 50-generation populations over
    // ten seeds each; several take tens of seconds and none of them is hanging.
    testTimeout: 120_000,
  },
})
