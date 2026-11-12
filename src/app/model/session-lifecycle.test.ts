import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatsStore } from '@/entities/chat'
import { useSessionStore } from '@/entities/session'
import type { GreenApi } from '@/shared/api'
import { initSessionLifecycle } from './session-lifecycle'

const apiA = { name: 'A' } as unknown as GreenApi
const apiB = { name: 'B' } as unknown as GreenApi
const session = () => useSessionStore.getState()

describe('session lifecycle', () => {
  const poller = { start: vi.fn(), stop: vi.fn() }
  const chatListLoader = { start: vi.fn(), stop: vi.fn() }
  const stopHistory = vi.fn()
  let dispose: () => void

  beforeEach(() => {
    session().clear()
    useChatsStore.getState().reset()
    for (const fn of [poller.start, poller.stop, chatListLoader.start, chatListLoader.stop, stopHistory]) fn.mockReset()
    dispose = initSessionLifecycle({ poller, chatListLoader, stopHistory })
  })
  afterEach(() => dispose())

  it('login starts the poller', () => {
    session().setChecking()
    expect(poller.start).not.toHaveBeenCalled()
    session().setReady({ api: apiA, idInstance: '1', loginAt: 111, warnings: [] })
    expect(poller.start).toHaveBeenCalledExactlyOnceWith(apiA, 111)
  })

  it('does not restart on unrelated session updates', () => {
    session().setReady({ api: apiA, idInstance: '1', loginAt: 111, warnings: [] })
    session().setConnection('reconnecting')
    session().setConnection('online')
    expect(poller.start).toHaveBeenCalledTimes(1)
    expect(poller.stop).not.toHaveBeenCalled()
  })

  it('logout stops the poller and clears chats', () => {
    session().setReady({ api: apiA, idInstance: '1', loginAt: 111, warnings: [] })
    useChatsStore.getState().apply({ type: 'chatCreated', chatId: '1', title: 'A' })
    useChatsStore.getState().openChat('1')
    session().clear()
    expect(poller.stop).toHaveBeenCalledTimes(1)
    const { chats, order, activeChatId } = useChatsStore.getState()
    expect({ chats, order, activeChatId }).toEqual({ chats: {}, order: [], activeChatId: null })
  })

  it('a second login starts a new loop with the new client', () => {
    session().setReady({ api: apiA, idInstance: '1', loginAt: 111, warnings: [] })
    session().clear()
    session().setChecking()
    session().setReady({ api: apiB, idInstance: '2', loginAt: 222, warnings: [] })
    expect(poller.start.mock.calls).toEqual([
      [apiA, 111],
      [apiB, 222],
    ])
    expect(poller.stop).toHaveBeenCalledTimes(1)
  })

  it('a failed login does not start the poller', () => {
    session().setChecking()
    session().setError('Invalid idInstance or apiTokenInstance')
    expect(poller.start).not.toHaveBeenCalled()
    expect(poller.stop).not.toHaveBeenCalled()
  })

  it('login starts the chat list load', () => {
    session().setReady({ api: apiA, idInstance: '1', loginAt: 111, warnings: [] })
    expect(chatListLoader.start).toHaveBeenCalledExactlyOnceWith(apiA)
  })

  it('logout stops the chat list and history loads before clearing chats', () => {
    session().setReady({ api: apiA, idInstance: '1', loginAt: 111, warnings: [] })
    const order: string[] = []
    chatListLoader.stop.mockImplementation(() => order.push('list'))
    stopHistory.mockImplementation(() => order.push('history'))
    const unsubscribe = useChatsStore.subscribe(() => order.push('reset'))
    useChatsStore.getState().apply({ type: 'chatCreated', chatId: '1', title: 'A' })
    order.length = 0

    session().clear()
    unsubscribe()
    expect(order).toEqual(['list', 'history', 'reset'])
  })

  it('a second login starts a fresh chat list load with the new client', () => {
    session().setReady({ api: apiA, idInstance: '1', loginAt: 111, warnings: [] })
    session().clear()
    session().setReady({ api: apiB, idInstance: '2', loginAt: 222, warnings: [] })
    expect(chatListLoader.start.mock.calls).toEqual([[apiA], [apiB]])
    expect(chatListLoader.stop).toHaveBeenCalledTimes(1)
    expect(stopHistory).toHaveBeenCalledTimes(1)
  })

  it('a failed login does not start the chat list load', () => {
    session().setChecking()
    session().setError('Invalid idInstance or apiTokenInstance')
    expect(chatListLoader.start).not.toHaveBeenCalled()
  })
})
