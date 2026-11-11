import { useChatsStore, type ChatEvent } from '@/entities/chat'
import { useSessionStore, type ConnectionState } from '@/entities/session'
import { describeApiError, isApiError, type ApiError, type GreenApi } from '@/shared/api'
import { createBackoff } from '../lib/backoff'
import { mapNotification } from '../lib/map-notification'

export const RECEIVE_TIMEOUT_S = 20
export const DELETE_ATTEMPTS = 3
export const DELETE_RETRY_DELAY_MS = 1000
/** Failures in a row after which the connection is shown as lost. */
export const RECONNECTING_AFTER_FAILURES = 3

export interface PollerDeps {
  dispatch(event: ChatEvent): void
  setConnection(connection: ConnectionState): void
  /** Credentials were rejected (401/403): retrying cannot help, the session must end. */
  onAuthError(error: ApiError): void
}

export interface Poller {
  start(api: GreenApi, loginAt: number): void
  stop(): void
}

/** Resolves after `ms`, or immediately when the signal aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
  })
}

export function createPoller(deps: PollerDeps): Poller {
  // Generation guard: a loop from an earlier start() never writes to the store.
  let runId = 0
  let controller: AbortController | null = null

  async function deleteWithRetry(api: GreenApi, receiptId: number, isStale: () => boolean, signal: AbortSignal) {
    for (let attempt = 1; attempt <= DELETE_ATTEMPTS; attempt++) {
      try {
        await api.deleteNotification(receiptId)
        return
      } catch {
        if (isStale() || attempt === DELETE_ATTEMPTS) return
        await sleep(DELETE_RETRY_DELAY_MS, signal)
        if (isStale()) return
      }
    }
    // Still not removed: the queue will return it again and idempotent events absorb the repeat.
  }

  async function loop(id: number, api: GreenApi, loginAt: number, signal: AbortSignal) {
    const isStale = () => id !== runId || signal.aborted
    const backoff = createBackoff()

    while (!isStale()) {
      try {
        const notification = await api.receiveNotification({ receiveTimeout: RECEIVE_TIMEOUT_S, signal })
        if (isStale()) return
        if (notification) {
          const event = mapNotification(notification.body, loginAt)
          if (event) deps.dispatch(event)
          if (typeof notification.receiptId === 'number') {
            await deleteWithRetry(api, notification.receiptId, isStale, signal)
          }
          if (isStale()) return
        }
        backoff.reset()
        deps.setConnection('online')
      } catch (error) {
        if (isStale()) return
        if (isApiError(error) && error.kind === 'auth') {
          deps.onAuthError(error)
          return
        }
        // `attempts` does not count this failure yet; next() records it below.
        if (backoff.attempts + 1 >= RECONNECTING_AFTER_FAILURES) deps.setConnection('reconnecting')
        await sleep(backoff.next(), signal)
      }
    }
  }

  function stop() {
    runId++
    controller?.abort()
    controller = null
  }

  function start(api: GreenApi, loginAt: number) {
    stop()
    const id = ++runId
    controller = new AbortController()
    void loop(id, api, loginAt, controller.signal)
  }

  return { start, stop }
}

/** App-wide poller wired to the stores. Started and stopped by app/session-lifecycle. */
export const poller = createPoller({
  dispatch: (event) => useChatsStore.getState().apply(event),
  setConnection: (connection) => useSessionStore.getState().setConnection(connection),
  // Leaving `ready` makes app/session-lifecycle stop this poller and clear chats.
  onAuthError: (error) => useSessionStore.getState().setError(describeApiError(error)),
})
