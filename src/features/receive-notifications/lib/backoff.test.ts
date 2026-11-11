import { describe, expect, it } from 'vitest'
import { createBackoff } from './backoff'

describe('backoff', () => {
  it('grows 1, 2, 5, 10 s and stays at the limit', () => {
    const b = createBackoff()
    expect(Array.from({ length: 7 }, () => b.next())).toEqual([1000, 2000, 5000, 10000, 10000, 10000, 10000])
    expect(b.attempts).toBe(7)
  })

  it('reset starts the sequence over', () => {
    const b = createBackoff()
    b.next()
    b.next()
    b.next()
    b.reset()
    expect(b.attempts).toBe(0)
    expect(b.next()).toBe(1000)
  })
})
