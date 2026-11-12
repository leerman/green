import { describe, expect, it, vi } from 'vitest'
import type { ChatEvent } from '@/entities/chat'
import { ApiError, type GetChatsResponse, type GreenApi } from '@/shared/api'
import { createChatListLoader, type ChatListState } from './chat-list'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup() {
  const events: ChatEvent[] = []
  const states: ChatListState[] = []
  const loader = createChatListLoader({
    dispatch: (e) => events.push(e),
    setState: (s) => states.push(s),
  })
  const last = () => states.at(-1)
  return { loader, events, states, last }
}

function fakeApi(...responses: Array<ReturnType<typeof deferred<GetChatsResponse>>>) {
  const signals: (AbortSignal | undefined)[] = []
  let i = 0
  const api = {
    getChats: vi.fn(({ signal }: { signal?: AbortSignal } = {}) => {
      signals.push(signal)
      return responses[i++].promise
    }),
  } as unknown as GreenApi
  return { api, signals }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('chatListLoader', () => {
  it('shows loading, then dispatches chatsLoaded with mapped chats', async () => {
    const { loader, events, last } = setup()
    const response = deferred<GetChatsResponse>()
    const { api } = fakeApi(response)

    loader.start(api)
    expect(last()).toEqual({ status: 'loading', error: null })

    response.resolve([{ chatId: '1', name: 'Alice', type: 'user', phoneNumber: 0 }])
    await flush()
    expect(events).toEqual([{ type: 'chatsLoaded', chats: [{ chatId: '1', title: 'Alice', chatType: 'user' }] }])
    expect(last()).toEqual({ status: 'idle', error: null })
  })

  it('sets an error on failure and reloads on retry', async () => {
    const { loader, events, last } = setup()
    const first = deferred<GetChatsResponse>()
    const second = deferred<GetChatsResponse>()
    const { api } = fakeApi(first, second)

    loader.start(api)
    first.reject(new ApiError('network'))
    await flush()
    expect(last()?.status).toBe('error')
    expect(last()?.error).toMatch(/connect/i)
    expect(events).toEqual([])

    loader.retry()
    expect(last()).toEqual({ status: 'loading', error: null })
    second.resolve([{ chatId: '2', type: 'group' }])
    await flush()
    expect(api.getChats).toHaveBeenCalledTimes(2)
    expect(events).toHaveLength(1)
    expect(last()?.status).toBe('idle')
  })

  it('does not dispatch a response that arrives after stop()', async () => {
    const { loader, events, last } = setup()
    const response = deferred<GetChatsResponse>()
    const { api, signals } = fakeApi(response)

    loader.start(api)
    loader.stop()
    expect(signals[0]?.aborted).toBe(true)
    expect(last()).toEqual({ status: 'idle', error: null })

    response.resolve([{ chatId: '1', type: 'user' }])
    await flush()
    expect(events).toEqual([])
    expect(last()).toEqual({ status: 'idle', error: null })
  })

  it('does not dispatch an earlier response after a new start()', async () => {
    const { loader, events } = setup()
    const old = deferred<GetChatsResponse>()
    const fresh = deferred<GetChatsResponse>()
    const { api: oldApi } = fakeApi(old)
    const { api: newApi } = fakeApi(fresh)

    loader.start(oldApi)
    loader.start(newApi)
    fresh.resolve([{ chatId: 'new', type: 'user' }])
    old.resolve([{ chatId: 'old', type: 'user' }])
    await flush()
    expect(events).toEqual([{ type: 'chatsLoaded', chats: [{ chatId: 'new', title: 'new', chatType: 'user' }] }])
  })

  it('ignores retry() after stop()', () => {
    const { loader } = setup()
    const { api } = fakeApi(deferred<GetChatsResponse>())
    loader.start(api)
    loader.stop()
    loader.retry()
    expect(api.getChats).toHaveBeenCalledTimes(1)
  })

  it('does not report an error for a cancelled request', async () => {
    const { loader, last } = setup()
    const response = deferred<GetChatsResponse>()
    const { api } = fakeApi(response)
    loader.start(api)
    loader.stop()
    response.reject(new ApiError('canceled'))
    await flush()
    expect(last()).toEqual({ status: 'idle', error: null })
  })
})
