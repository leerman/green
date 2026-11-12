import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatsStore, type ChatType } from '@/entities/chat'
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
