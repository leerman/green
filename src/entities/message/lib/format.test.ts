import { describe, expect, it } from 'vitest'
import { contentPreview, formatDayLabel, formatListTime, formatTime, isSameDay } from './format'

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

// Local times; `now` is 14 November 2026, 10:30.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime()
const NOW = at(2026, 11, 14, 10, 30)

describe('formatDayLabel', () => {
  it.each([
    ['today', at(2026, 11, 14, 0, 1), 'Today'],
    ['yesterday', at(2026, 11, 13, 23, 59), 'Yesterday'],
    ['earlier this year', at(2026, 11, 12), '12 November'],
    ['the start of the year', at(2026, 1, 1, 0, 0), '1 January'],
    ['an earlier year', at(2025, 12, 28), '28 December 2025'],
  ])('labels %s', (_, ts, label) => {
    expect(formatDayLabel(ts, NOW)).toBe(label)
  })

  it('splits days at local midnight', () => {
    const now = at(2026, 11, 14, 0, 0)
    expect(formatDayLabel(at(2026, 11, 13, 23, 59), now)).toBe('Yesterday')
    expect(formatDayLabel(at(2026, 11, 14, 0, 1), now)).toBe('Today')
  })

  it('handles yesterday across a month and a year boundary', () => {
    expect(formatDayLabel(at(2026, 10, 31), at(2026, 11, 1))).toBe('Yesterday')
    expect(formatDayLabel(at(2025, 12, 31), at(2026, 1, 1))).toBe('Yesterday')
  })
})

describe('formatListTime', () => {
  it.each([
    ['today', at(2026, 11, 14, 9, 15), '09:15'],
    ['yesterday', at(2026, 11, 13), 'Yesterday'],
    ['earlier this year', at(2026, 11, 12), '12 Nov'],
    ['an earlier year', at(2025, 12, 28), '28 Dec 2025'],
  ])('shows %s', (_, ts, label) => {
    expect(formatListTime(ts, NOW)).toBe(label)
  })

  it('splits days at local midnight', () => {
    const now = at(2026, 11, 14, 0, 0)
    expect(formatListTime(at(2026, 11, 13, 23, 59), now)).toBe('Yesterday')
    expect(formatListTime(at(2026, 11, 14, 0, 1), now)).toBe('00:01')
  })
})

describe('isSameDay', () => {
  it('compares local calendar days', () => {
    expect(isSameDay(at(2026, 11, 14, 0, 0), at(2026, 11, 14, 23, 59))).toBe(true)
    expect(isSameDay(at(2026, 11, 13, 23, 59), at(2026, 11, 14, 0, 0))).toBe(false)
  })
})
