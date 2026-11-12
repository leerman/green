import { describe, expect, it } from 'vitest'
import { msUntilNextMidnight } from './use-now'

describe('msUntilNextMidnight', () => {
  it('counts to the next local midnight', () => {
    expect(msUntilNextMidnight(new Date(2026, 10, 14, 23, 59, 0).getTime())).toBe(60_000)
    expect(msUntilNextMidnight(new Date(2026, 10, 14, 0, 0, 0).getTime())).toBe(24 * 3600_000)
  })

  it('rolls over months and years', () => {
    expect(msUntilNextMidnight(new Date(2026, 11, 31, 23, 0).getTime())).toBe(3600_000)
  })
})
