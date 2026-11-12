import { useChatsStore, type Chat, type ChatEvent } from '@/entities/chat'
import { useSessionStore } from '@/entities/session'
import { isApiError, type GreenApi } from '@/shared/api'
import { mapHistory } from '../lib/map-history'

export const HISTORY_COUNT = 100
/** Minimum gap between the starts of two history requests; GREEN-API answers 429 to back-to-back calls. */
export const HISTORY_MIN_INTERVAL_MS = 1500
export const HISTORY_RETRY_DELAY_MS = 3000
/** Automatic retries after HTTP 429; other errors are not retried automatically. */
export const HISTORY_MAX_RETRIES = 2

export interface HistoryLoaderDeps {
  dispatch(event: ChatEvent): void
  /** The current session's client, or `null` when logged out. */
  getApi(): GreenApi | null
  getChat(chatId: string): Chat | undefined
}

export interface HistoryLoader {
  /** Queues a history load for the chat unless it is loading or loaded. */
  load(chatId: string): void
  /** Drops the queue and cancels the request or wait in flight. */
  stop(): void
}

/** Resolves after `ms`, or immediately when the signal aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted || ms <= 0) return resolve()
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
  })
}

interface QueueItem {
  chatId: string
  api: GreenApi
}

export function createHistoryLoader(deps: HistoryLoaderDeps): HistoryLoader {
  let generation = 0
  let queue: QueueItem[] = []
  let running = false
  let controller = new AbortController()
  /** Start time of the last request, for pacing. */
  let lastStart = -Infinity

  /** False once stop() ran or the session's client changed: the result must not be applied. */
  const isCurrent = (gen: number, api: GreenApi) => gen === generation && deps.getApi() === api

  async function fetchWithRetry(gen: number, item: QueueItem, signal: AbortSignal): Promise<ChatEvent | null> {
    for (let retries = 0; ; retries++) {
      await sleep(lastStart + HISTORY_MIN_INTERVAL_MS - Date.now(), signal)
      if (!isCurrent(gen, item.api)) return null
      lastStart = Date.now()
      try {
        const response = await item.api.getChatHistory(item.chatId, HISTORY_COUNT, { signal })
        return { type: 'historyLoaded', chatId: item.chatId, messages: mapHistory(response) }
      } catch (error) {
        if (!isCurrent(gen, item.api)) return null
        const rateLimited = isApiError(error) && error.kind === 'limit'
        if (!rateLimited || retries >= HISTORY_MAX_RETRIES) return { type: 'historyFailed', chatId: item.chatId }
        await sleep(HISTORY_RETRY_DELAY_MS, signal)
      }
    }
  }

  async function work(gen: number, signal: AbortSignal) {
    running = true
    try {
      while (gen === generation && queue.length > 0) {
        const item = queue.shift()!
        // A request queued in an earlier session is dropped without a request.
        if (!isCurrent(gen, item.api)) continue
        const event = await fetchWithRetry(gen, item, signal)
        if (event && isCurrent(gen, item.api)) deps.dispatch(event)
      }
    } finally {
      if (gen === generation) running = false
    }
  }

  return {
    load(chatId) {
      const api = deps.getApi()
      const chat = deps.getChat(chatId)
      if (!api || !chat || chat.history === 'loading' || chat.history === 'loaded') return
      deps.dispatch({ type: 'historyRequested', chatId })
      queue.push({ chatId, api })
      if (!running) void work(generation, controller.signal)
    },
    stop() {
      generation++
      queue = []
      running = false
      controller.abort()
      controller = new AbortController()
    },
  }
}

/** App-wide history loader wired to the stores. Stopped by app/session-lifecycle on logout. */
export const historyLoader = createHistoryLoader({
  dispatch: (event) => useChatsStore.getState().apply(event),
  getApi: () => useSessionStore.getState().api,
  getChat: (chatId) => useChatsStore.getState().chats[chatId],
})

export const loadHistory = (chatId: string) => historyLoader.load(chatId)
export const stopHistory = () => historyLoader.stop()
