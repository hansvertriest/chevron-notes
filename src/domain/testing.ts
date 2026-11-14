import type { Context } from './board'

/** A deterministic context for tests: ids `id1`, `id2`, … and a fixed clock. */
export function testContext(): Context {
  let n = 0
  return {
    newId: () => `id${++n}`,
    now: () => '2026-01-01T00:00:00.000Z',
  }
}
