import { describe, expect, it } from 'vitest'
import { contentPreview, formatTime } from './format'

describe('formatTime', () => {
  it('pads hours and minutes', () => {
    expect(formatTime(new Date(2026, 0, 1, 7, 5).getTime())).toBe('07:05')
    expect(formatTime(new Date(2026, 0, 1, 23, 59).getTime())).toBe('23:59')
  })
})

describe('contentPreview', () => {
  it('returns the text of a text message', () => {
    expect(contentPreview({ type: 'text', text: 'hello' })).toBe('hello')
  })
})
