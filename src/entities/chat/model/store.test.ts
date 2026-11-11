import { beforeEach, describe, expect, it } from 'vitest'
import { useChatsStore } from './store'
import { initialChatsState } from './types'

const state = () => {
  const { chats, order, activeChatId } = useChatsStore.getState()
  return { chats, order, activeChatId }
}

describe('useChatsStore', () => {
  beforeEach(() => useChatsStore.getState().reset())

  it('apply changes the state through applyEvent', () => {
    useChatsStore.getState().apply({ type: 'chatCreated', chatId: '1', title: 'Alice' })
    useChatsStore.getState().apply({ type: 'incomingReceived', chatId: '2', idMessage: 'm', text: 'hi', ts: 1, title: 'Bob' })
    expect(state().order).toEqual(['2', '1'])
    expect(state().chats['2'].messages).toHaveLength(1)
  })

  it('openChat sets the active chat', () => {
    useChatsStore.getState().apply({ type: 'chatCreated', chatId: '1', title: 'Alice' })
    useChatsStore.getState().openChat('1')
    expect(state().activeChatId).toBe('1')
  })

  it('reset returns the initial state', () => {
    useChatsStore.getState().apply({ type: 'chatCreated', chatId: '1', title: 'Alice' })
    useChatsStore.getState().openChat('1')
    useChatsStore.getState().reset()
    expect(state()).toEqual(initialChatsState)
    expect(typeof useChatsStore.getState().apply).toBe('function')
  })
})
