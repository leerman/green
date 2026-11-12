import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'
import { createApi } from './client'
import { ApiError } from './errors'

const TOKEN = 'secret-token-abc123'
const ID = '1100000001'

function api(adapter: AxiosAdapter) {
  return createApi({ idInstance: ID, apiTokenInstance: TOKEN }, { baseURL: 'https://api.test', adapter })
}

/** Records every request and answers with `data`. */
function respondWith(data: unknown) {
  const calls: InternalAxiosRequestConfig[] = []
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config)
    return { status: 200, statusText: 'OK', data, headers: {}, config }
  }
  return { adapter, calls }
}

const failing: AxiosAdapter = async (config) => {
  throw new AxiosError(`Request to ${config.url} failed`, 'ERR_NETWORK', config, {})
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError)
    return error as ApiError
  }
  throw new Error('expected rejection')
}

describe('getChats', () => {
  it('sends GET getChats and returns the list', async () => {
    const chats = [{ chatId: '42', name: 'Alice', type: 'user', phoneNumber: 79991234567 }]
    const { adapter, calls } = respondWith(chats)
    const controller = new AbortController()

    expect(await api(adapter).getChats({ signal: controller.signal })).toEqual(chats)
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('get')
    expect(calls[0].url).toBe(`/waInstance${ID}/getChats/${TOKEN}`)
    expect(calls[0].signal).toBe(controller.signal)
  })

  it('returns an empty list for a non-array body', async () => {
    expect(await api(respondWith(null).adapter).getChats()).toEqual([])
    expect(await api(respondWith('').adapter).getChats()).toEqual([])
  })

  it('rejects with an ApiError without the token', async () => {
    const error = await rejection(api(failing).getChats())
    expect(error.kind).toBe('network')
    expect(JSON.stringify(error)).not.toContain(TOKEN)
    expect(error.message).not.toContain(TOKEN)
  })
})

describe('getChatHistory', () => {
  it('sends POST getChatHistory with chatId and count', async () => {
    const history = [{ type: 'incoming', idMessage: 'M1', timestamp: 1, typeMessage: 'textMessage' }]
    const { adapter, calls } = respondWith(history)
    const controller = new AbortController()

    expect(await api(adapter).getChatHistory('42', 100, { signal: controller.signal })).toEqual(history)
    expect(calls[0].method).toBe('post')
    expect(calls[0].url).toBe(`/waInstance${ID}/getChatHistory/${TOKEN}`)
    expect(JSON.parse(calls[0].data as string)).toEqual({ chatId: '42', count: 100 })
    expect(calls[0].signal).toBe(controller.signal)
  })

  it('returns an empty list for a non-array body', async () => {
    expect(await api(respondWith(null).adapter).getChatHistory('42', 100)).toEqual([])
  })

  it('rejects with an ApiError without the token', async () => {
    const error = await rejection(api(failing).getChatHistory('42', 100))
    expect(error.kind).toBe('network')
    expect(JSON.stringify(error)).not.toContain(TOKEN)
    expect(error.message).not.toContain(TOKEN)
  })
})
