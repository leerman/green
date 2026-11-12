import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Chat } from '../model/types'
import { ChatListItem } from './ChatListItem'

// Local times; "now" is 14 November 2026, 10:30.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime()

function chatWithLast(chatId: string, timestamp: number): Chat {
  return {
    chatId,
    title: `Chat ${chatId}`,
    type: 'user',
    history: 'idle',
    messages: [{ id: 'm', direction: 'in', content: { type: 'text', text: 'hi' }, timestamp }],
  }
}

const timeOf = (chat: Chat) =>
  renderToStaticMarkup(<ChatListItem chat={chat} active={false} onSelect={() => {}} />).match(
    /<time[^>]*>([^<]+)<|class="[^"]*time[^"]*">([^<]+)</,
  )

describe('ChatListItem date of the latest message', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(at(2026, 11, 14, 10, 30))
  })
  afterEach(() => vi.useRealTimers())

  it.each([
    ['today', at(2026, 11, 14, 9, 15), '09:15'],
    ['yesterday', at(2026, 11, 13), 'Yesterday'],
    ['earlier this year', at(2026, 11, 12), '12 Nov'],
    ['an earlier year', at(2025, 12, 28), '28 Dec 2025'],
  ])('shows %s', (_, ts, label) => {
    const match = timeOf(chatWithLast('1', ts))
    expect(match?.[1] ?? match?.[2]).toBe(label)
  })

  it('shows no time without messages', () => {
    const empty: Chat = { ...chatWithLast('1', 0), messages: [] }
    expect(renderToStaticMarkup(<ChatListItem chat={empty} active={false} onSelect={() => {}} />)).not.toMatch(/time/)
  })
})
