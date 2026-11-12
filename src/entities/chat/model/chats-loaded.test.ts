import { describe, expect, it } from 'vitest'
import { applyEvent } from './apply-event'
import type { ChatEvent, LoadedChat } from './events'
import { initialChatsState, type ChatsState } from './types'

function run(events: ChatEvent[], state: ChatsState = initialChatsState): ChatsState {
  return events.reduce(applyEvent, state)
}

const loaded = (...chats: LoadedChat[]): ChatEvent => ({ type: 'chatsLoaded', chats })
const user = (chatId: string, extra: Partial<LoadedChat> = {}): LoadedChat => ({
  chatId,
  title: `Chat ${chatId}`,
  chatType: 'user',
  ...extra,
})

describe('chatsLoaded', () => {
  it('adds chats in server order with their type and phone', () => {
    const s = run([
      loaded(user('1', { phone: '79990000001' }), { chatId: '-2', title: 'Team', chatType: 'group' }, user('3')),
    ])
    expect(s.order).toEqual(['1', '-2', '3'])
    expect(s.chats['1']).toEqual({
      chatId: '1',
      title: 'Chat 1',
      phone: '79990000001',
      type: 'user',
      history: 'idle',
      messages: [],
    })
    expect(s.chats['-2']).toMatchObject({ title: 'Team', type: 'group', history: 'idle' })
    expect(s.chats['-2'].phone).toBeUndefined()
    expect(s.activeChatId).toBeNull()
  })

  it('falls back to the chatId for an empty title', () => {
    expect(run([loaded(user('9', { title: '' }))]).chats['9'].title).toBe('9')
  })

  it('keeps a chat created by a live message at the top, once, with its messages', () => {
    const s1 = run([
      { type: 'incomingReceived', chatId: '2', idMessage: 'm1', text: 'hi', ts: 5, title: 'Live name' },
    ])
    const s2 = applyEvent(s1, loaded(user('1'), user('2'), user('3')))
    expect(s2.order).toEqual(['2', '1', '3'])
    expect(s2.chats['2'].title).toBe('Live name')
    expect(s2.chats['2'].messages.map((m) => m.id)).toEqual(['m1'])
  })

  it('keeps the open chat open and listed once', () => {
    const s1 = run([
      { type: 'chatCreated', chatId: '7', title: '+79991234567', phone: '79991234567' },
      { type: 'chatOpened', chatId: '7' },
    ])
    const s2 = applyEvent(s1, loaded(user('5'), user('7', { title: 'Alice' })))
    expect(s2.activeChatId).toBe('7')
    expect(s2.order).toEqual(['7', '5'])
    expect(s2.chats['7'].title).toBe('+79991234567')
  })

  it('sets the real type and fills a missing phone on an existing chat', () => {
    const s1 = run([{ type: 'chatCreated', chatId: '-1', title: 'News' }])
    expect(s1.chats['-1'].type).toBe('group')
    const s2 = applyEvent(s1, loaded({ chatId: '-1', title: 'News', chatType: 'channel' }))
    expect(s2.chats['-1'].type).toBe('channel')

    const s3 = run([{ type: 'chatCreated', chatId: '4', title: 'Bob' }])
    expect(applyEvent(s3, loaded(user('4', { phone: '79990000004' }))).chats['4'].phone).toBe('79990000004')
  })

  it('does not overwrite an existing phone', () => {
    const s1 = run([{ type: 'chatCreated', chatId: '4', title: 'Bob', phone: '79990000004' }])
    expect(applyEvent(s1, loaded(user('4', { phone: '79995555555' }))).chats['4'].phone).toBe('79990000004')
  })

  it('returns the same state when nothing changes', () => {
    const s1 = run([loaded(user('1'), user('2'))])
    expect(applyEvent(s1, loaded(user('1'), user('2')))).toBe(s1)
    expect(applyEvent(s1, loaded())).toBe(s1)
  })

  it('ignores a duplicate chatId within one response', () => {
    const s = run([loaded(user('1'), user('1'))])
    expect(s.order).toEqual(['1'])
  })
})

describe('chatsLoaded with the latest message', () => {
  const last = (id: string, timestamp: number) => ({
    id,
    direction: 'in' as const,
    content: { type: 'text' as const, text: `text ${id}` },
    timestamp,
  })

  it('seeds a new chat with its latest message and keeps history not loaded', () => {
    const s = run([loaded(user('1', { lastMessage: last('m9', 90) }), user('2'))])
    expect(s.chats['1'].messages).toEqual([last('m9', 90)])
    expect(s.chats['1'].history).toBe('idle')
    expect(s.chats['2'].messages).toEqual([])
  })

  it('does not duplicate a message the chat already got live', () => {
    const s1 = run([{ type: 'incomingReceived', chatId: '1', idMessage: 'm9', text: 'live', ts: 90, title: 'One' }])
    const s2 = applyEvent(s1, loaded(user('1', { lastMessage: last('m9', 90) })))
    expect(s2).toBe(s1)
    expect(s2.chats['1'].messages.map((m) => m.content)).toEqual([{ type: 'text', text: 'live' }])
  })

  it('adds the latest message to an existing chat by timestamp, without moving the chat', () => {
    const s1 = run([
      { type: 'chatCreated', chatId: '7', title: 'Seven' },
      { type: 'incomingReceived', chatId: '8', idMessage: 'x', text: 'x', ts: 50, title: 'Eight' },
      { type: 'incomingReceived', chatId: '7', idMessage: 'new', text: 'new', ts: 200, title: 'Seven' },
    ])
    const s2 = applyEvent(s1, loaded(user('8'), user('7', { lastMessage: last('old', 100) })))
    expect(s2.chats['7'].messages.map((m) => m.id)).toEqual(['old', 'new'])
    expect(s2.order).toEqual(s1.order)
    expect(s2.chats['7'].history).toBe('idle')
  })

  it('leaves a later history load without a duplicate of the preview', () => {
    const s = run([
      loaded(user('1', { lastMessage: last('m9', 90) })),
      { type: 'historyLoaded', chatId: '1', messages: [last('m1', 10), last('m9', 90)] },
    ])
    expect(s.chats['1'].messages.map((m) => m.id)).toEqual(['m1', 'm9'])
  })
})
