import { describe, expect, it } from 'vitest'
import { applyEvent } from './apply-event'
import type { ChatEvent } from './events'
import { initialChatsState, type ChatsState } from './types'

function run(events: ChatEvent[], state: ChatsState = initialChatsState): ChatsState {
  return events.reduce(applyEvent, state)
}

const base: ChatEvent[] = [
  { type: 'chatCreated', chatId: '1', title: 'Alice' },
  { type: 'chatCreated', chatId: '2', title: 'Bob' },
]
const queued: ChatEvent = { type: 'messageQueued', chatId: '1', tmpId: 'tmp-a', text: 'hello', ts: 1000 }
const sent: ChatEvent = { type: 'messageSent', chatId: '1', tmpId: 'tmp-a', idMessage: 'ID1' }
const failed: ChatEvent = { type: 'messageFailed', chatId: '1', tmpId: 'tmp-a' }
const echo: ChatEvent = { type: 'outgoingReceived', chatId: '1', idMessage: 'ID1', text: 'hello', ts: 1001, title: 'T' }

const messages = (s: ChatsState, chatId = '1') => s.chats[chatId].messages

describe('merging outgoing copies', () => {
  it('successful send: the message keeps its position with status sent', () => {
    const s = run([...base, { type: 'messageQueued', chatId: '1', tmpId: 'tmp-0', text: 'first', ts: 500 }, queued, sent])
    expect(messages(s).map((m) => [m.id, m.status])).toEqual([
      ['tmp-0', 'sending'],
      ['ID1', 'sent'],
    ])
  })

  it('notification after the send response: exactly one copy', () => {
    const s = run([...base, queued, sent, echo])
    expect(messages(s)).toEqual([
      { id: 'ID1', direction: 'out', content: { type: 'text', text: 'hello' }, timestamp: 1001, status: 'sent' },
    ])
  })

  it('notification before the send response: exactly one copy', () => {
    const s = run([...base, queued, echo, sent])
    expect(messages(s)).toHaveLength(1)
    expect(messages(s)[0]).toMatchObject({ id: 'ID1', direction: 'out', status: 'sent' })
  })

  it('repeated delivery of the same notification does not change the chat', () => {
    for (const order of [[queued, sent, echo], [queued, echo, sent]]) {
      const s1 = run([...base, ...order])
      const s2 = applyEvent(s1, echo)
      expect(s2).toBe(s1)
    }
  })

  it('repeated messageSent is harmless', () => {
    const s1 = run([...base, queued, sent])
    expect(applyEvent(s1, sent)).toBe(s1)
  })

  it('adopts the server timestamp to fix the order when the client clock runs ahead', () => {
    const s = run([
      ...base,
      // Client clock 30 s ahead: the local copy gets ts 31_000.
      { type: 'messageQueued', chatId: '1', tmpId: 'tmp-a', text: 'question', ts: 31_000 },
      { type: 'messageSent', chatId: '1', tmpId: 'tmp-a', idMessage: 'ID1' },
      // Reply at server time 6_000, before the local ts: shown above for now.
      { type: 'incomingReceived', chatId: '1', idMessage: 'R1', text: 'answer', ts: 6_000, title: 'Alice' },
      // The echo carries the real server time of the question.
      { type: 'outgoingReceived', chatId: '1', idMessage: 'ID1', text: 'question', ts: 1_000, title: 'T' },
    ])
    expect(messages(s).map((m) => m.id)).toEqual(['ID1', 'R1'])
  })

  it('replaces the local copy with the server copy', () => {
    const s = run([...base, queued, sent, { ...echo, text: 'hello (server)' } as ChatEvent])
    expect(messages(s)).toHaveLength(1)
    expect(messages(s)[0].content).toEqual({ type: 'text', text: 'hello (server)' })
  })

  it('retry after failure produces one copy', () => {
    const s = run([...base, queued, failed, queued, sent, echo])
    expect(messages(s)).toHaveLength(1)
    expect(messages(s)[0]).toMatchObject({ id: 'ID1', status: 'sent' })
  })

  it('retry: notification racing ahead of the retry response still yields one copy', () => {
    const s = run([...base, queued, failed, queued, echo, sent])
    expect(messages(s)).toHaveLength(1)
    expect(messages(s)[0]).toMatchObject({ id: 'ID1', status: 'sent' })
  })

  it('a message from another device appears as outgoing and moves the chat up', () => {
    const s = run([...base, { type: 'outgoingReceived', chatId: '1', idMessage: 'PHONE1', text: 'from phone', ts: 5, title: 'T' }])
    expect(s.order[0]).toBe('1')
    expect(messages(s)).toEqual([
      { id: 'PHONE1', direction: 'out', content: { type: 'text', text: 'from phone' }, timestamp: 5, status: 'sent' },
    ])
  })

  it('never rewrites an incoming message that shares the idMessage', () => {
    const s1 = run([...base, { type: 'incomingReceived', chatId: '1', idMessage: 'SAME', text: 'from Alice', ts: 5, title: 'Alice' }])
    const s2 = applyEvent(s1, { type: 'outgoingReceived', chatId: '1', idMessage: 'SAME', text: 'mine', ts: 6, title: 'T' })
    expect(s2).toBe(s1)
    expect(messages(s2)).toEqual([
      { id: 'SAME', direction: 'in', content: { type: 'text', text: 'from Alice' }, timestamp: 5 },
    ])
  })

  it('creates the chat for an outgoing message to an unknown chat (e.g. Favorites)', () => {
    const s1 = run([...base, { type: 'chatOpened', chatId: '2' }])
    const s2 = applyEvent(s1, { type: 'outgoingReceived', chatId: '999', idMessage: 'X', text: 'note to self', ts: 7, title: 'Favorites' })
    expect(s2.order[0]).toBe('999')
    expect(s2.activeChatId).toBe('2')
    expect(s2.chats['999']).toEqual({
      chatId: '999',
      title: 'Favorites',
      type: 'user',
      history: 'idle',
      messages: [{ id: 'X', direction: 'out', content: { type: 'text', text: 'note to self' }, timestamp: 7, status: 'sent' }],
    })
    // Repeated delivery does not add a copy.
    expect(applyEvent(s2, { type: 'outgoingReceived', chatId: '999', idMessage: 'X', text: 'note to self', ts: 7, title: 'Favorites' })).toBe(s2)
  })

  it('titles an auto-created outgoing chat with chatId when the title is empty', () => {
    const s = applyEvent(initialChatsState, { type: 'outgoingReceived', chatId: '999', idMessage: 'X', text: 'x', ts: 1, title: '' })
    expect(s.chats['999'].title).toBe('999')
  })

  it('ignores messageSent for an unknown chat or unknown tmpId', () => {
    const s1 = run([...base, queued])
    expect(applyEvent(s1, { ...sent, chatId: '999' } as ChatEvent)).toBe(s1)
    expect(applyEvent(s1, { ...sent, tmpId: 'tmp-zzz' } as ChatEvent)).toBe(s1)
  })
})
