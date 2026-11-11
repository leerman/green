import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'
import { createApi } from './client'
import { ApiError, describeApiError, type ApiErrorKind } from './errors'

const TOKEN = 'secret-token-abc123'
const ID = '1100000001'

function failWith(status?: number, code?: string): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig) => {
    const response =
      status === undefined
        ? undefined
        : { status, statusText: '', data: { url: config.url }, headers: {}, config }
    throw new AxiosError(`Request to ${config.url} failed`, code, config, {}, response)
  }
}

function api(adapter: AxiosAdapter) {
  return createApi({ idInstance: ID, apiTokenInstance: TOKEN }, { baseURL: 'https://api.test', adapter })
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected rejection')
}

function expectNoToken(error: unknown) {
  expect(error).toBeInstanceOf(ApiError)
  const e = error as ApiError
  expect(e.message).not.toContain(TOKEN)
  expect(String(e)).not.toContain(TOKEN)
  expect(e.stack ?? '').not.toContain(TOKEN)
  expect(JSON.stringify(e)).not.toContain(TOKEN)
  expect(JSON.stringify(Object.getOwnPropertyNames(e).map((k) => (e as never)[k]))).not.toContain(TOKEN)
  expect(e).not.toHaveProperty('config')
  expect(e).not.toHaveProperty('request')
  expect(e).not.toHaveProperty('response')
  expect(e.cause).toBeUndefined()
}

describe('ApiError mapping', () => {
  it.each<[number, ApiErrorKind]>([
    [401, 'auth'],
    [403, 'auth'],
    [469, 'limit'],
    [429, 'limit'],
    [400, 'validation'],
    [404, 'validation'],
    [466, 'validation'],
    [500, 'server'],
    [502, 'server'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    const error = await captureError(api(failWith(status)).getStateInstance())
    expectNoToken(error)
    expect(error).toMatchObject({ kind, status })
  })

  it('maps a missing response to network', async () => {
    const error = await captureError(api(failWith(undefined, 'ERR_NETWORK')).sendMessage('1', 'hi'))
    expectNoToken(error)
    expect(error).toMatchObject({ kind: 'network', status: undefined })
  })

  it('maps a timeout to network', async () => {
    const error = await captureError(api(failWith(undefined, 'ECONNABORTED')).getSettings())
    expectNoToken(error)
    expect(error).toMatchObject({ kind: 'network' })
  })

  it('maps an aborted request to canceled', async () => {
    const controller = new AbortController()
    controller.abort()
    const adapter: AxiosAdapter = async () => {
      throw new Error('adapter must not be called')
    }
    const error = await captureError(
      api(adapter).receiveNotification({ receiveTimeout: 5, signal: controller.signal }),
    )
    expectNoToken(error)
    expect(error).toMatchObject({ kind: 'canceled' })
  })
})

describe('createApi', () => {
  it('builds URLs with the token and returns null for an empty notification', async () => {
    const seen: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (config) => {
      seen.push(config)
      return { status: 200, statusText: 'OK', data: '', headers: {}, config }
    }
    await expect(api(adapter).receiveNotification({ receiveTimeout: 20 })).resolves.toBeNull()
    expect(seen[0].url).toBe(`/waInstance${ID}/receiveNotification/${TOKEN}`)
    expect(seen[0].params).toEqual({ receiveTimeout: 20 })
    expect(seen[0].timeout).toBe(30_000)
  })

  it('sends deleteNotification with the receiptId in the path', async () => {
    const seen: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (config) => {
      seen.push(config)
      return { status: 200, statusText: 'OK', data: { result: true }, headers: {}, config }
    }
    await expect(api(adapter).deleteNotification(42)).resolves.toEqual({ result: true })
    expect(seen[0].method).toBe('delete')
    expect(seen[0].url).toBe(`/waInstance${ID}/deleteNotification/${TOKEN}/42`)
  })
})

describe('describeApiError', () => {
  it('gives a default message per kind', () => {
    expect(describeApiError(new ApiError('network'))).toMatch(/Cannot connect/)
    expect(describeApiError(new ApiError('validation', 400))).toBe('GREEN-API rejected the request (HTTP 400).')
    expect(describeApiError(new Error('x'))).toBe('Unexpected error. Try again.')
  })

  it('applies overrides by kind', () => {
    expect(describeApiError(new ApiError('limit', 469), { limit: 'later' })).toBe('later')
    expect(describeApiError(new ApiError('validation', 404), { validation: (e) => `bad ${e.status}` })).toBe('bad 404')
    expect(describeApiError(new ApiError('server', 500), { limit: 'later' })).toMatch(/server error/)
  })
})
