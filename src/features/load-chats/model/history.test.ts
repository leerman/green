import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyEvent, initialChatsState, type ChatEvent, type ChatsState } from '@/entities/chat'
import { ApiError, type GetChatHistoryResponse, type GreenApi } from '@/shared/api'
import {
  createHistoryLoader,
  HISTORY_COUNT,
  HISTORY_MIN_INTERVAL_MS,
  HISTORY_RETRY_DELAY_MS,
} from './history'

type Reply = GetChatHistoryResponse | ApiError

const text = (id: string, timestamp: number) => ({
  type: 'incoming',
  idMessage: id,
  timestamp,
  typeMessage: 'textMessage',
  textMessage: `text ${id}`,
})

/** Fake API: each call takes the next scripted reply, resolved after `latencyMs`. */
function fakeApi(replies: Reply[], latencyMs = 100) {
  const calls: { chatId: string; at: number; signal?: AbortSignal }[] = []
  const api = {
    getChatHistory: vi.fn((chatId: string, count: number, { signal }: { signal?: AbortSignal } = {}) => {
      expect(count).toBe(HISTORY_COUNT)
      calls.push({ chatId, at: Date.now(), signal })
      const reply = replies.shift() ?? []
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => (reply instanceof ApiError ? reject(reply) : resolve(reply)), latencyMs)
        signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new ApiError('canceled'))
        })
      })
    }),
  } as unknown as GreenApi
  return { api, calls }
}

function setup(api: GreenApi, chatIds = ['1', '2', '3']) {
  let state: ChatsState = applyEvent(initialChatsState, {
    type: 'chatsLoaded',
    chats: chatIds.map((chatId) => ({ chatId, title: chatId, chatType: 'user' as const })),
  })
  const events: ChatEvent[] = []
  const session = { api: api as GreenApi | null }
  const loader = createHistoryLoader({
    dispatch: (e) => {
      events.push(e)
      state = applyEvent(state, e)
    },
    getApi: () => session.api,
    getChat: (chatId) => state.chats[chatId],
  })
  return { loader, events, session, chat: (id: string) => state.chats[id] }
}

describe('history loader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })
  afterEach(() => vi.useRealTimers())

  it('marks the chat loading, then loads and maps its history', async () => {
    const { api } = fakeApi([[text('b', 20), text('a', 10)]])
    const { loader, chat } = setup(api)

    loader.load('1')
    expect(chat('1').history).toBe('loading')
    await vi.runAllTimersAsync()
    expect(chat('1').history).toBe('loaded')
    expect(chat('1').messages.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('does not retry a non-429 failure automatically', async () => {
    const { api } = fakeApi([new ApiError('network')])
    const { loader, chat } = setup(api)

    loader.load('1')
    await vi.runAllTimersAsync()
    expect(api.getChatHistory).toHaveBeenCalledTimes(1)
    expect(chat('1').history).toBe('error')
  })

  it('retries a 429 after the retry delay and succeeds', async () => {
    const { api, calls } = fakeApi([new ApiError('limit', 429), [text('a', 10)]])
    const { loader, chat, events } = setup(api)

    loader.load('1')
    await vi.runAllTimersAsync()
    expect(calls).toHaveLength(2)
    expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(HISTORY_RETRY_DELAY_MS)
    expect(chat('1').history).toBe('loaded')
    expect(events.some((e) => e.type === 'historyFailed')).toBe(false)
  })

  it('fails after a 429 on the request and both retries', async () => {
    const limit = () => new ApiError('limit', 429)
    const { api } = fakeApi([limit(), limit(), limit(), [text('never', 1)]])
    const { loader, chat } = setup(api)

    loader.load('1')
    await vi.runAllTimersAsync()
    expect(api.getChatHistory).toHaveBeenCalledTimes(3)
    expect(chat('1').history).toBe('error')
  })

  it('serves quick opens in order, one at a time, at least the minimum interval apart', async () => {
    const { api, calls } = fakeApi([[text('a', 1)], [text('b', 2)], [text('c', 3)]])
    const { loader, chat } = setup(api)

    loader.load('2')
    loader.load('1')
    loader.load('3')
    expect(['1', '2', '3'].map((id) => chat(id).history)).toEqual(['loading', 'loading', 'loading'])
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(1)

    await vi.runAllTimersAsync()
    expect(calls.map((c) => c.chatId)).toEqual(['2', '1', '3'])
    expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(HISTORY_MIN_INTERVAL_MS)
    expect(calls[2].at - calls[1].at).toBeGreaterThanOrEqual(HISTORY_MIN_INTERVAL_MS)
    expect(['1', '2', '3'].map((id) => chat(id).history)).toEqual(['loaded', 'loaded', 'loaded'])
  })

  it('sends no second request for a chat that is loading or loaded', async () => {
    const { api } = fakeApi([[text('a', 1)]])
    const { loader } = setup(api)

    loader.load('1')
    loader.load('1')
    await vi.runAllTimersAsync()
    loader.load('1')
    await vi.runAllTimersAsync()
    expect(api.getChatHistory).toHaveBeenCalledTimes(1)
  })

  it('loads again after a failure', async () => {
    const { api } = fakeApi([new ApiError('server', 500), [text('a', 1)]])
    const { loader, chat } = setup(api)

    loader.load('1')
    await vi.runAllTimersAsync()
    expect(chat('1').history).toBe('error')
    loader.load('1')
    await vi.runAllTimersAsync()
    expect(chat('1').history).toBe('loaded')
  })

  it('does not apply a response after logout and re-login, and drops the queue', async () => {
    const old = fakeApi([[text('old', 1)], [text('queued', 2)]])
    const { loader, session, events } = setup(old.api)

    loader.load('1')
    loader.load('2')
    await vi.advanceTimersByTimeAsync(0)
    expect(old.calls).toHaveLength(1)

    loader.stop()
    session.api = fakeApi([]).api
    expect(old.calls[0].signal?.aborted).toBe(true)
    await vi.runAllTimersAsync()

    expect(old.calls).toHaveLength(1)
    expect(events.filter((e) => e.type === 'historyLoaded' || e.type === 'historyFailed')).toEqual([])
  })

  it('does not apply a response when the session changed without stop()', async () => {
    const old = fakeApi([[text('old', 1)]])
    const { loader, session, events } = setup(old.api)

    loader.load('1')
    session.api = fakeApi([]).api
    await vi.runAllTimersAsync()
    expect(events.map((e) => e.type)).toEqual(['historyRequested'])
  })

  it('works again after stop()', async () => {
    const first = fakeApi([[text('a', 1)]])
    const { loader, session, chat } = setup(first.api)
    loader.load('1')
    loader.stop()

    const second = fakeApi([[text('b', 2)]])
    session.api = second.api
    loader.load('2')
    await vi.runAllTimersAsync()
    expect(second.calls.map((c) => c.chatId)).toEqual(['2'])
    expect(chat('2').history).toBe('loaded')
  })

  it('ignores an unknown chat or a logged-out session', () => {
    const { api } = fakeApi([])
    const { loader, session, events } = setup(api)
    loader.load('nope')
    session.api = null
    loader.load('1')
    expect(events).toEqual([])
    expect(api.getChatHistory).not.toHaveBeenCalled()
  })
})
