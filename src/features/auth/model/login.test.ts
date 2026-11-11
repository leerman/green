import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/entities/session'
import { ApiError, type GetStateInstanceResponse, type GreenApi } from '@/shared/api'
import { INCOMING_WEBHOOK_WARNING, SETTINGS_UNAVAILABLE_WARNING, WEBHOOK_URL_WARNING } from '../lib/check-settings'
import { INVALID_CREDENTIALS_MESSAGE, login, NETWORK_ERROR_MESSAGE } from './login'

function mockApi(overrides: Partial<GreenApi> = {}): GreenApi {
  return {
    getStateInstance: vi.fn(async () => ({ stateInstance: 'authorized' })),
    getSettings: vi.fn(async () => ({ webhookUrl: '', incomingWebhook: 'yes' })),
    checkAccount: vi.fn(),
    sendMessage: vi.fn(),
    receiveNotification: vi.fn(),
    deleteNotification: vi.fn(),
    ...overrides,
  } as GreenApi
}

const creds = { idInstance: ' 1101000001 ', apiTokenInstance: ' tok ' }
const session = () => useSessionStore.getState()

describe('login', () => {
  beforeEach(() => session().clear())

  it('sets the session ready on success', async () => {
    const api = mockApi()
    const createApi = vi.fn(() => api)
    const result = await login(creds, { createApi, now: () => 4242 })
    expect(result).toEqual({ ok: true })
    expect(createApi).toHaveBeenCalledWith({ idInstance: '1101000001', apiTokenInstance: 'tok' })
    expect(session()).toMatchObject({ status: 'ready', api, idInstance: '1101000001', loginAt: 4242, warnings: [], error: null })
  })

  it.each([401, 403])('reports wrong credentials on HTTP %i', async (status) => {
    const api = mockApi({ getStateInstance: vi.fn(async () => Promise.reject(new ApiError('auth', status))) })
    const result = await login(creds, { createApi: () => api })
    expect(result).toEqual({ ok: false, error: INVALID_CREDENTIALS_MESSAGE })
    expect(session()).toMatchObject({ status: 'idle', error: INVALID_CREDENTIALS_MESSAGE, api: null })
    expect(api.getSettings).not.toHaveBeenCalled()
  })

  it('reports an unauthorized instance with its state', async () => {
    const api = mockApi({ getStateInstance: vi.fn(async () => ({ stateInstance: 'notAuthorized' })) })
    const result = await login(creds, { createApi: () => api })
    expect(result.ok).toBe(false)
    expect(session().status).toBe('idle')
    expect(session().error).toContain('not authorized in MAX')
    expect(session().error).toContain('notAuthorized')
  })

  it('reports a network error', async () => {
    const api = mockApi({ getStateInstance: vi.fn(async () => Promise.reject(new ApiError('network'))) })
    await login(creds, { createApi: () => api })
    expect(session()).toMatchObject({ status: 'idle', error: NETWORK_ERROR_MESSAGE })
  })

  it('adds settings warnings without blocking login', async () => {
    const api = mockApi({ getSettings: vi.fn(async () => ({ webhookUrl: 'https://x', incomingWebhook: 'no' })) })
    await login(creds, { createApi: () => api })
    expect(session()).toMatchObject({ status: 'ready', warnings: [WEBHOOK_URL_WARNING, INCOMING_WEBHOOK_WARNING] })
  })

  it('warns but still logs in when the settings request fails', async () => {
    const api = mockApi({ getSettings: vi.fn(async () => Promise.reject(new ApiError('server', 500))) })
    await login(creds, { createApi: () => api })
    expect(session()).toMatchObject({ status: 'ready', warnings: [SETTINGS_UNAVAILABLE_WARNING] })
  })

  it('does not become ready if the session was cleared during the check', async () => {
    let resolve!: (v: GetStateInstanceResponse) => void
    const api = mockApi({ getStateInstance: vi.fn(() => new Promise<GetStateInstanceResponse>((r) => (resolve = r))) })
    const pending = login(creds, { createApi: () => api })
    session().clear()
    resolve({ stateInstance: 'authorized' })
    expect((await pending).ok).toBe(false)
    expect(session().status).toBe('idle')
  })
})
