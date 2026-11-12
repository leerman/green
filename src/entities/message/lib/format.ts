import type { MessageContent } from '../model/types'

/** Local time as `HH:MM`. */
export function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Local calendar day as a comparable number; 24-hour spans would break across DST and midnight. */
function dayKey(d: Date): number {
  return d.getFullYear() * 10_000 + d.getMonth() * 100 + d.getDate()
}

function isYesterday(d: Date, now: Date): boolean {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  return dayKey(d) === dayKey(yesterday)
}

/** Whether two timestamps fall on the same local calendar day. */
export function isSameDay(a: number, b: number): boolean {
  return dayKey(new Date(a)) === dayKey(new Date(b))
}

/** Date separator label: "Today", "Yesterday", "12 November", or "28 December 2025". */
export function formatDayLabel(timestamp: number, now: number): string {
  const d = new Date(timestamp)
  const n = new Date(now)
  if (dayKey(d) === dayKey(n)) return 'Today'
  if (isYesterday(d, n)) return 'Yesterday'
  const label = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === n.getFullYear() ? label : `${label} ${d.getFullYear()}`
}

/** Chat list time: "09:15" today, "Yesterday", "12 Nov", or "28 Dec 2025". */
export function formatListTime(timestamp: number, now: number): string {
  const d = new Date(timestamp)
  const n = new Date(now)
  if (dayKey(d) === dayKey(n)) return formatTime(timestamp)
  if (isYesterday(d, n)) return 'Yesterday'
  const label = `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
  return d.getFullYear() === n.getFullYear() ? label : `${label} ${d.getFullYear()}`
}

/** One-line preview of the content, e.g. for the chat list. */
export function contentPreview(content: MessageContent): string {
  switch (content.type) {
    case 'text':
      return content.text
  }
}
