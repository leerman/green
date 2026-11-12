import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatEvent } from '@/entities/chat'
import type { ConnectionState } from '@/entities/session'
import { ApiError, type GreenApi, type Notification, type ReceiveNotificationOptions } from '@/shared/api'
import { createPoller, RECEIVE_TIMEOUT_S } from './poller'

const LOGIN_AT = 1_700_000_000_000
const TS = LOGIN_AT / 1000 + 1

type Step = Notification | null | Error | 'hang'

function message(receiptId: number, idMessage: string, chatId = '100'): Notification {
  return {
    receiptId,
    body: {
      typeWebhook: 'incomingMessageReceived',
      timestamp: TS,
      idMessage,
      senderData: { chatId, senderName: 'Bob' },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: idMessage } },
    },
  }
}

/** Fake API: receiveNotification follows `steps`, then hangs until aborted. */
function fakeApi(steps: Step[], deleteResults: Array<'ok' | 'fail'> = []) {
  const log: string[] = []
  const receiveTimes: number[] = []
  const api = {
    receiveNotification: vi.fn(({ signal, receiveTimeout }: ReceiveNotificationOptions) => {
      expect(receiveTimeout).toBe(RECEIVE_TIMEOUT_S)
      receiveTimes.push(Date.now())
      log.push('receive')
      const step = steps.length ? steps.shift()! : 'hang'
      if (step === 'hang') {
        return new Promise<Notification | null>((_, reject) => {
          signal?.addEventListener('abort', () => reject(new ApiError('canceled')))
        })
      }
      if (step instanceof Error) return Promise.reject(step)
      return Promise.resolve(step)
    }),
    deleteNotification: vi.fn(async (receiptId: number) => {
      log.push(`delete:${receiptId}`)
      if (deleteResults.shift() === 'fail') throw new ApiError('network')
      return { result: true }
    }),
  }
  return { api: api as unknown as GreenApi & typeof api, log, receiveTimes }
}

function setup() {
  const events: ChatEvent[] = []
  const connection: ConnectionState[] = []
  const onAuthError = vi.fn()
  const poller = createPoller({
    dispatch: (e) => events.push(e),
    setConnection: (c) => connection.push(c),
    onAuthError,
  })
  return { poller, events, connection, onAuthError }
}

const flush = () => vi.advanceTimersByTimeAsync(0)

describe('poller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(LOGIN_AT)
  })
  afterEach(() => vi.useRealTimers())

  it('dispatches messages and removes every notification before the next request', async () => {
    const { poller, events } = setup()
    const service: Notification = { receiptId: 2, body: { typeWebhook: 'stateInstanceChanged', timestamp: TS } }
    const group = message(3, 'G', '-500')
    const old: Notification = { ...message(4, 'OLD'), body: { ...message(4, 'OLD').body, timestamp: TS - 100 } }
    const broken = { receiptId: 5, body: 'garbage' } as unknown as Notification
    const { api, log } = fakeApi([message(1, 'A'), service, group, old, broken, null, message(6, 'B')])

    poller.start(api, LOGIN_AT)
    await flush()

    expect(log).toEqual([
      'receive', 'delete:1',
      'receive', 'delete:2',
      'receive', 'delete:3',
      'receive', 'delete:4',
      'receive', 'delete:5',
      'receive',
      'receive', 'delete:6',
      'receive',
    ])
    // Group messages are passed on; service, old, and broken notifications are not.
    expect(events.map((e) => e.type === 'incomingReceived' && e.idMessage)).toEqual(['A', 'G', 'B'])
    poller.stop()
  })

  it('retries a failed deleteNotification before requesting the next notification', async () => {
    const { poller } = setup()
    const { api, log } = fakeApi([message(1, 'A')], ['fail', 'fail', 'ok'])
    poller.start(api, LOGIN_AT)
    await flush()
    expect(log).toEqual(['receive', 'delete:1'])
    await vi.advanceTimersByTimeAsync(1000)
    expect(log).toEqual(['receive', 'delete:1', 'delete:1'])
    await vi.advanceTimersByTimeAsync(1000)
    expect(log).toEqual(['receive', 'delete:1', 'delete:1', 'delete:1', 'receive'])
    poller.stop()
  })

  it('moves on after the delete attempts are exhausted', async () => {
    const { poller } = setup()
    const { api, log } = fakeApi([message(1, 'A')], ['fail', 'fail', 'fail'])
    poller.start(api, LOGIN_AT)
    await vi.advanceTimersByTimeAsync(5000)
    expect(log).toEqual(['receive', 'delete:1', 'delete:1', 'delete:1', 'receive'])
    poller.stop()
  })

  it('stop() cancels the pending request and sends no new ones', async () => {
    const { poller } = setup()
    const { api } = fakeApi([])
    poller.start(api, LOGIN_AT)
    await flush()
    expect(api.receiveNotification).toHaveBeenCalledTimes(1)
    const signal = api.receiveNotification.mock.calls[0][0].signal!
    poller.stop()
    expect(signal.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.receiveNotification).toHaveBeenCalledTimes(1)
  })

  it('stop() during a backoff delay sends no new requests', async () => {
    const { poller } = setup()
    const { api } = fakeApi([new ApiError('network')])
    poller.start(api, LOGIN_AT)
    await flush()
    poller.stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.receiveNotification).toHaveBeenCalledTimes(1)
  })

  it('does not show reconnecting after two failures', async () => {
    const { poller, connection } = setup()
    const { api } = fakeApi([new ApiError('network'), new ApiError('network'), null])
    poller.start(api, LOGIN_AT)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(connection).toEqual(['online'])
    poller.stop()
  })

  it('grows the delay on failures, shows reconnecting, and resets after success', async () => {
    const { poller, connection } = setup()
    const err = () => new ApiError('network')
    const { api, receiveTimes } = fakeApi([err(), err(), err(), err(), err(), null, null, err(), null])
    poller.start(api, LOGIN_AT)
    await vi.advanceTimersByTimeAsync(60_000)

    const gaps = receiveTimes.slice(1).map((t, i) => t - receiveTimes[i])
    // 5 failures: 1, 2, 5, 10, 10 s; success: immediately; failure after reset: 1 s.
    expect(gaps).toEqual([1000, 2000, 5000, 10000, 10000, 0, 0, 1000, 0])
    // 'reconnecting' from the 3rd failure in a row on.
    expect(connection).toEqual(['reconnecting', 'reconnecting', 'reconnecting', 'online', 'online', 'online'])
    poller.stop()
  })

  it('a stale loop does not dispatch after a restart', async () => {
    const { poller, events } = setup()
    let resolveOld!: (n: Notification) => void
    const oldApi = {
      // Ignores abort to simulate a response racing with stop().
      receiveNotification: vi.fn(() => new Promise<Notification>((r) => (resolveOld = r))),
      deleteNotification: vi.fn(async () => ({ result: true })),
    } as unknown as GreenApi
    poller.start(oldApi, LOGIN_AT)
    await flush()

    const { api: newApi } = fakeApi([])
    poller.start(newApi, LOGIN_AT)
    await flush()

    resolveOld(message(1, 'STALE'))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(events).toEqual([])
    expect(oldApi.deleteNotification).not.toHaveBeenCalled()
    expect(oldApi.receiveNotification).toHaveBeenCalledTimes(1)
    expect(newApi.receiveNotification).toHaveBeenCalledTimes(1)
    poller.stop()
  })

  it('a stale loop does not dispatch after stop()', async () => {
    const { poller, events } = setup()
    let resolveOld!: (n: Notification) => void
    const api = {
      receiveNotification: vi.fn(() => new Promise<Notification>((r) => (resolveOld = r))),
      deleteNotification: vi.fn(async () => ({ result: true })),
    } as unknown as GreenApi
    poller.start(api, LOGIN_AT)
    await flush()
    poller.stop()
    resolveOld(message(1, 'LATE'))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(events).toEqual([])
  })

  it.each([401, 403])('ends the session on HTTP %i instead of retrying', async (status) => {
    const { poller, onAuthError, connection } = setup()
    const { api } = fakeApi([new ApiError('auth', status)])
    poller.start(api, LOGIN_AT)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(onAuthError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: 'auth', status }))
    expect(api.receiveNotification).toHaveBeenCalledTimes(1)
    expect(connection).toEqual([])
    poller.stop()
  })

  it('does not report an auth error from a stale loop', async () => {
    const { poller, onAuthError } = setup()
    let rejectOld!: (e: unknown) => void
    const api = {
      receiveNotification: vi.fn(() => new Promise<Notification>((_, r) => (rejectOld = r))),
      deleteNotification: vi.fn(),
    } as unknown as GreenApi
    poller.start(api, LOGIN_AT)
    await flush()
    poller.stop()
    rejectOld(new ApiError('auth', 401))
    await flush()
    expect(onAuthError).not.toHaveBeenCalled()
  })

  it('works when start and stop are called detached from the poller', async () => {
    const { poller } = setup()
    const { start, stop } = poller
    const { api } = fakeApi([])
    start(api, LOGIN_AT)
    start(api, LOGIN_AT)
    await flush()
    const signals = api.receiveNotification.mock.calls.map((c) => c[0].signal!)
    expect(signals.filter((s) => !s.aborted)).toHaveLength(1)
    stop()
    expect(signals.every((s) => s.aborted)).toBe(true)
  })

  it('keeps only one pending request', async () => {
    const { poller } = setup()
    const { api } = fakeApi([])
    poller.start(api, LOGIN_AT)
    poller.start(api, LOGIN_AT)
    await flush()
    const signals = api.receiveNotification.mock.calls.map((c) => c[0].signal!)
    expect(signals.filter((s) => !s.aborted)).toHaveLength(1)
    poller.stop()
  })
})
