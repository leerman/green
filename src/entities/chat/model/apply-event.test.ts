import { describe, expect, it } from 'vitest'
import { applyEvent } from './apply-event'
import type { ChatEvent } from './events'
import { initialChatsState, type ChatsState } from './types'

function run(events: ChatEvent[], state: ChatsState = initialChatsState): ChatsState {
  return events.reduce(applyEvent, state)
}

const created = (chatId: string, extra: Partial<Extract<ChatEvent, { type: 'chatCreated' }>> = {}): ChatEvent => ({
  type: 'chatCreated',
  chatId,
  title: `Chat ${chatId}`,
  ...extra,
})

const incoming = (
  chatId: string,
  idMessage: string,
  ts: number,
  extra: Partial<Extract<ChatEvent, { type: 'incomingReceived' }>> = {},
): ChatEvent => ({
  type: 'incomingReceived',
  chatId,
  idMessage,
  text: `text ${idMessage}`,
  ts,
  title: 'Sender',
  ...extra,
})

describe('chatCreated', () => {
  it('adds a chat to the top of the list', () => {
    const s = run([created('1'), created('2', { phone: '79991234567' })])
    expect(s.order).toEqual(['2', '1'])
    expect(s.chats['2']).toEqual({ chatId: '2', title: 'Chat 2', phone: '79991234567', messages: [] })
  })

  it('does not duplicate an existing chat', () => {
    const s1 = run([created('1'), created('2')])
    const s2 = applyEvent(s1, created('1', { title: 'Other' }))
    expect(s2).toBe(s1)
  })

  it('fills in a missing phone on an existing chat without moving it', () => {
    const s = run([created('1'), created('2'), created('1', { phone: '123456789' })])
    expect(s.chats['1'].phone).toBe('123456789')
    expect(s.chats['1'].title).toBe('Chat 1')
    expect(s.order).toEqual(['2', '1'])
  })

  it('falls back to chatId for an empty title', () => {
    expect(run([created('77', { title: '' })]).chats['77'].title).toBe('77')
  })
})

describe('chatOpened', () => {
  it('sets the active chat', () => {
    expect(run([created('1'), { type: 'chatOpened', chatId: '1' }]).activeChatId).toBe('1')
  })

  it('ignores an unknown chat', () => {
    expect(run([{ type: 'chatOpened', chatId: 'nope' }]).activeChatId).toBeNull()
  })
})

describe('messageQueued / messageFailed', () => {
  it('adds an outgoing sending message and moves the chat to the top', () => {
    const s = run([
      created('1'),
      created('2'),
      { type: 'messageQueued', chatId: '1', tmpId: 'tmp-a', text: 'hi', ts: 100 },
    ])
    expect(s.order).toEqual(['1', '2'])
    expect(s.chats['1'].messages).toEqual([
      { id: 'tmp-a', direction: 'out', content: { type: 'text', text: 'hi' }, timestamp: 100, status: 'sending' },
    ])
  })

  it('ignores an unknown chat', () => {
    const s = run([{ type: 'messageQueued', chatId: 'x', tmpId: 'tmp-a', text: 'hi', ts: 1 }])
    expect(s).toEqual(initialChatsState)
  })

  it('marks a message as failed', () => {
    const s = run([
      created('1'),
      { type: 'messageQueued', chatId: '1', tmpId: 'tmp-a', text: 'hi', ts: 100 },
      { type: 'messageFailed', chatId: '1', tmpId: 'tmp-a' },
    ])
    expect(s.chats['1'].messages[0].status).toBe('failed')
  })

  it('reuses the message on retry instead of adding a copy', () => {
    const s = run([
      created('1'),
      { type: 'messageQueued', chatId: '1', tmpId: 'tmp-a', text: 'hi', ts: 100 },
      { type: 'messageFailed', chatId: '1', tmpId: 'tmp-a' },
      { type: 'messageQueued', chatId: '1', tmpId: 'tmp-a', text: 'hi', ts: 200 },
    ])
    expect(s.chats['1'].messages).toHaveLength(1)
    expect(s.chats['1'].messages[0]).toMatchObject({ id: 'tmp-a', status: 'sending', timestamp: 100 })
  })
})

describe('incomingReceived', () => {
  it('auto-creates a chat without changing the active chat', () => {
    const s = run([created('1'), { type: 'chatOpened', chatId: '1' }, incoming('2', 'm1', 100, { phone: '79990000000' })])
    expect(s.activeChatId).toBe('1')
    expect(s.order).toEqual(['2', '1'])
    expect(s.chats['2']).toMatchObject({ chatId: '2', title: 'Sender', phone: '79990000000' })
    expect(s.chats['2'].messages).toEqual([
      { id: 'm1', direction: 'in', content: { type: 'text', text: 'text m1' }, timestamp: 100 },
    ])
  })

  it('titles an auto-created chat with chatId when there is no name', () => {
    expect(run([incoming('555', 'm1', 1, { title: '' })]).chats['555'].title).toBe('555')
  })

  it('appends to an existing chat and moves it to the top', () => {
    const s = run([created('1'), created('2'), incoming('1', 'm1', 100)])
    expect(s.order).toEqual(['1', '2'])
    expect(s.chats['1'].title).toBe('Chat 1')
    expect(s.chats['1'].messages.map((m) => m.id)).toEqual(['m1'])
  })

  it('is idempotent by idMessage', () => {
    const s1 = run([incoming('1', 'm1', 100), incoming('2', 'm2', 200)])
    const s2 = applyEvent(s1, incoming('1', 'm1', 100))
    expect(s2).toBe(s1)
  })

  it('keeps messages in timestamp order', () => {
    const s = run([incoming('1', 'a', 300), incoming('1', 'b', 100), incoming('1', 'c', 200), incoming('1', 'd', 300)])
    expect(s.chats['1'].messages.map((m) => m.id)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('does not mutate the previous state', () => {
    const s1 = run([incoming('1', 'a', 100)])
    const snapshot = structuredClone(s1)
    run([incoming('1', 'b', 200), incoming('2', 'c', 300)], s1)
    expect(s1).toEqual(snapshot)
  })
})
