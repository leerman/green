import { beforeEach, describe, expect, it } from 'vitest'
import type { GreenApi } from '@/shared/api'
import { initialSessionState, useSessionStore } from './store'

const fakeApi = {} as GreenApi

function data() {
  const { idInstance, api, loginAt, status, error, warnings, connection } = useSessionStore.getState()
  return { idInstance, api, loginAt, status, error, warnings, connection }
}

describe('useSessionStore', () => {
  beforeEach(() => useSessionStore.getState().clear())

  it('setChecking clears a previous error', () => {
    useSessionStore.getState().setError('boom')
    useSessionStore.getState().setChecking()
    expect(data()).toEqual({ ...initialSessionState, status: 'checking' })
  })

  it('setReady stores the session', () => {
    useSessionStore.getState().setChecking()
    useSessionStore.getState().setReady({ api: fakeApi, idInstance: '1101', loginAt: 123, warnings: ['w'] })
    expect(data()).toEqual({
      idInstance: '1101',
      api: fakeApi,
      loginAt: 123,
      status: 'ready',
      error: null,
      warnings: ['w'],
      connection: 'online',
    })
  })

  it('setError returns to idle with the error', () => {
    useSessionStore.getState().setChecking()
    useSessionStore.getState().setError('Invalid idInstance or apiTokenInstance')
    expect(data()).toEqual({ ...initialSessionState, error: 'Invalid idInstance or apiTokenInstance' })
  })

  it('setConnection updates the connection state', () => {
    useSessionStore.getState().setConnection('reconnecting')
    expect(data().connection).toBe('reconnecting')
  })

  it('clear drops the api client and returns to the initial state', () => {
    useSessionStore.getState().setReady({ api: fakeApi, idInstance: '1101', loginAt: 123, warnings: ['w'] })
    useSessionStore.getState().setConnection('reconnecting')
    useSessionStore.getState().clear()
    expect(data()).toEqual(initialSessionState)
  })
})
