import { describe, expect, it } from 'vitest'
import type { Message } from '@/entities/message/@x/chat'
import { applyEvent } from './apply-event'
import type { ChatEvent } from './events'
import { initialChatsState, type ChatsState } from './types'

function run(events: ChatEvent[], state: ChatsState = initialChatsState): ChatsState {
  return events.reduce(applyEvent, state)
}

const inMsg = (id: string, timestamp: number): Message => ({
  id,
  direction: 'in',
  content: { type: 'text', text: `in ${id}` },
  timestamp,
})
const outMsg = (id: string, timestamp: number): Message => ({
  id,
  direction: 'out',
  content: { type: 'text', text: `out ${id}` },
  timestamp,
  status: 'sent',
})

const twoChats = run([
  {
    type: 'chatsLoaded',
    chats: [
      { chatId: '1', title: 'One', chatType: 'user' },
      { chatId: '2', title: 'Two', chatType: 'user' },
    ],
  },
  { type: 'chatOpened', chatId: '2' },
])

const ids = (s: ChatsState, chatId: string) => s.chats[chatId].messages.map((m) => m.id)

describe('history events', () => {
  it('marks the chat loading, then loaded with the messages in chronological order', () => {
    const s1 = applyEvent(twoChats, { type: 'historyRequested', chatId: '2' })
    expect(s1.chats['2'].history).toBe('loading')

    const messages = [inMsg('a', 10), outMsg('b', 20), inMsg('c', 30)]
    const s2 = applyEvent(s1, { type: 'historyLoaded', chatId: '2', messages })
    expect(s2.chats['2'].history).toBe('loaded')
    expect(ids(s2, '2')).toEqual(['a', 'b', 'c'])
    expect(s2.chats['2'].messages[1]).toMatchObject({ direction: 'out', status: 'sent' })
  })

  it('keeps the chat position and the active chat', () => {
    const s = run(
      [
        { type: 'historyRequested', chatId: '2' },
        { type: 'historyLoaded', chatId: '2', messages: [inMsg('a', 10)] },
      ],
      twoChats,
    )
    expect(s.order).toEqual(['1', '2'])
    expect(s.activeChatId).toBe('2')
  })

  it('accepts an empty history', () => {
    const s = applyEvent(twoChats, { type: 'historyLoaded', chatId: '2', messages: [] })
    expect(s.chats['2'].history).toBe('loaded')
    expect(s.chats['2'].messages).toEqual([])
  })

  it('does not duplicate a live message that is also in the history', () => {
    const s1 = applyEvent(twoChats, {
      type: 'incomingReceived',
      chatId: '2',
      idMessage: 'b',
      text: 'live b',
      ts: 20,
      title: 'Two',
    })
    const s2 = applyEvent(s1, { type: 'historyLoaded', chatId: '2', messages: [inMsg('a', 10), inMsg('b', 20)] })
    expect(ids(s2, '2')).toEqual(['a', 'b'])
    expect(s2.chats['2'].messages[1].content).toEqual({ type: 'text', text: 'live b' })
  })

  it('merges a live message that arrived during loading in chronological order', () => {
    const s = run([
      { type: 'historyRequested', chatId: '2' },
      { type: 'incomingReceived', chatId: '2', idMessage: 'live', text: 'now', ts: 100, title: 'Two' },
      { type: 'historyLoaded', chatId: '2', messages: [inMsg('a', 10), outMsg('b', 50), inMsg('c', 150)] },
    ], twoChats)
    expect(ids(s, '2')).toEqual(['a', 'b', 'live', 'c'])
  })

  it('keeps sending and failed messages with their status', () => {
    const s = run([
      { type: 'messageQueued', chatId: '2', tmpId: 'tmp-1', text: 'pending', ts: 60 },
      { type: 'messageQueued', chatId: '2', tmpId: 'tmp-2', text: 'broken', ts: 70 },
      { type: 'messageFailed', chatId: '2', tmpId: 'tmp-2' },
      { type: 'historyLoaded', chatId: '2', messages: [inMsg('a', 10), inMsg('c', 80)] },
    ], twoChats)
    expect(ids(s, '2')).toEqual(['a', 'tmp-1', 'tmp-2', 'c'])
    expect(s.chats['2'].messages[1].status).toBe('sending')
    expect(s.chats['2'].messages[2].status).toBe('failed')
  })

  it('marks a failed load and keeps the messages', () => {
    const s = run([
      { type: 'incomingReceived', chatId: '2', idMessage: 'live', text: 'now', ts: 100, title: 'Two' },
      { type: 'historyRequested', chatId: '2' },
      { type: 'historyFailed', chatId: '2' },
    ], twoChats)
    expect(s.chats['2'].history).toBe('error')
    expect(ids(s, '2')).toEqual(['live'])
  })

  it('ignores history events for a chat that is not in the list', () => {
    expect(applyEvent(twoChats, { type: 'historyRequested', chatId: '9' })).toBe(twoChats)
    expect(applyEvent(twoChats, { type: 'historyLoaded', chatId: '9', messages: [inMsg('a', 1)] })).toBe(twoChats)
    expect(applyEvent(twoChats, { type: 'historyFailed', chatId: '9' })).toBe(twoChats)
  })
})
