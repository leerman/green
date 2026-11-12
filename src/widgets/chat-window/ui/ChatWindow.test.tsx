import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatsStore, type ChatEvent, type ChatType } from '@/entities/chat'
import { ChatWindow } from './ChatWindow'

// Render the stores' current state (see __mocks__/zustand.ts).
vi.mock('zustand')

const store = () => useChatsStore.getState()
const render = () => renderToStaticMarkup(<ChatWindow />)

function openChat(chatType: ChatType, chatId = chatType === 'user' || chatType === 'bot' ? '1' : '-1') {
  store().apply({ type: 'chatsLoaded', chats: [{ chatId, title: `A ${chatType}`, chatType }] })
  store().openChat(chatId)
  return chatId
}

describe('ChatWindow', () => {
  beforeEach(() => store().reset())

  it('replaces the input with a read-only footer in a channel', () => {
    openChat('channel')
    const html = render()
    expect(html).toContain('Read-only channel')
    expect(html).not.toContain('<textarea')
  })

  it.each<ChatType>(['user', 'group', 'bot'])('shows the input in a %s chat', (chatType) => {
    openChat(chatType)
    const html = render()
    expect(html).toContain('<textarea')
    expect(html).not.toContain('Read-only channel')
  })

  it('shows sender names in a group chat only', () => {
    const sender = { id: '7', name: 'Kate' }
    const groupId = openChat('group')
    store().apply({ type: 'incomingReceived', chatId: groupId, idMessage: 'g', text: 'hi', ts: 1, title: 'G', sender })
    expect(render()).toContain('>Kate<')

    const userId = openChat('user')
    store().apply({ type: 'incomingReceived', chatId: userId, idMessage: 'u', text: 'hi', ts: 1, title: 'U', sender })
    expect(render()).not.toContain('Kate')
  })

  it('shows loading instead of the empty-chat text while history loads', () => {
    const chatId = openChat('user')
    store().apply({ type: 'historyRequested', chatId })
    const html = render()
    expect(html).toContain('Loading history')
    expect(html).not.toContain('No messages yet')
  })

  it('shows the history error with Retry and keeps the messages', () => {
    const chatId = openChat('user')
    store().apply({ type: 'incomingReceived', chatId, idMessage: 'm', text: 'still here', ts: 1, title: 'U' })
    store().apply({ type: 'historyRequested', chatId })
    store().apply({ type: 'historyFailed', chatId })
    const html = render()
    expect(html).toContain('Couldn’t load the chat history.')
    expect(html).toContain('Retry')
    expect(html).toContain('still here')
  })

  it('shows an empty loaded history as an empty chat', () => {
    const chatId = openChat('user')
    store().apply({ type: 'historyLoaded', chatId, messages: [] })
    const html = render()
    expect(html).toContain('No messages yet')
    expect(html).not.toContain('Loading history')
  })
})

describe('ChatWindow date separators', () => {
  // Local times; "now" is 14 November 2026, 10:30.
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()
  const separators = (html: string) => [...html.matchAll(/role="separator"><span>([^<]+)</g)].map((m) => m[1])
  const incoming = (chatId: string, idMessage: string, ts: number): ChatEvent => ({
    type: 'incomingReceived',
    chatId,
    idMessage,
    text: idMessage,
    ts,
    title: 'U',
  })

  beforeEach(() => {
    store().reset()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(at(2026, 11, 14, 10))
  })
  afterEach(() => vi.useRealTimers())

  it('shows one separator per day, before its first message', () => {
    const chatId = openChat('user')
    for (const [id, ts] of [
      ['a', at(2026, 11, 12, 9)],
      ['b', at(2026, 11, 12, 18)],
      ['c', at(2026, 11, 13, 8)],
      ['d', at(2026, 11, 14, 9)],
      ['e', at(2026, 11, 14, 10)],
    ] as const) {
      store().apply(incoming(chatId, id, ts))
    }
    const html = render()
    expect(separators(html)).toEqual(['12 November', 'Yesterday', 'Today'])
    // Each separator sits directly before its day's first message.
    expect(html.indexOf('12 November')).toBeLessThan(html.indexOf('>a<'))
    expect(html.indexOf('>b<')).toBeLessThan(html.indexOf('Yesterday'))
    expect(html.indexOf('Yesterday')).toBeLessThan(html.indexOf('>c<'))
    expect(html.indexOf('>c<')).toBeLessThan(html.indexOf('Today'))
  })

  it('labels an earlier year with the year', () => {
    const chatId = openChat('user')
    store().apply(incoming(chatId, 'old', at(2025, 12, 28)))
    expect(separators(render())).toEqual(['28 December 2025'])
  })

  it('shows a single separator for a single-day chat', () => {
    const chatId = openChat('user')
    store().apply(incoming(chatId, 'a', at(2026, 11, 14, 8)))
    store().apply(incoming(chatId, 'b', at(2026, 11, 14, 9)))
    expect(separators(render())).toEqual(['Today'])
  })

  it('starts a new day when a message arrives after midnight', () => {
    const chatId = openChat('user')
    store().apply(incoming(chatId, 'late', at(2026, 11, 13, 23)))
    expect(separators(render())).toEqual(['Yesterday'])
    store().apply(incoming(chatId, 'early', at(2026, 11, 14, 0)))
    expect(separators(render())).toEqual(['Yesterday', 'Today'])
  })

  it('keeps one separator per day when history loads around a seeded preview', () => {
    const msg = (id: string, ts: number) => ({
      id,
      direction: 'in' as const,
      content: { type: 'text' as const, text: id },
      timestamp: ts,
    })
    store().apply({
      type: 'chatsLoaded',
      chats: [{ chatId: '1', title: 'U', chatType: 'user', lastMessage: msg('last', at(2026, 11, 14, 9)) }],
    })
    store().openChat('1')
    expect(separators(render())).toEqual(['Today'])

    store().apply({
      type: 'historyLoaded',
      chatId: '1',
      messages: [
        msg('h1', at(2026, 11, 10)),
        msg('h2', at(2026, 11, 13)),
        msg('h3', at(2026, 11, 14, 8)),
        msg('last', at(2026, 11, 14, 9)),
      ],
    })
    expect(separators(render())).toEqual(['10 November', 'Yesterday', 'Today'])
  })
})
