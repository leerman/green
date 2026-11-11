import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatsStore } from '@/entities/chat'
import { useSessionStore } from '@/entities/session'
import { ApiError, type GreenApi, type SendMessageResponse } from '@/shared/api'
import { canSend, MAX_MESSAGE_LENGTH, retry, sendMessage } from './send-message'

function login(send: (chatId: string, text: string) => Promise<SendMessageResponse>) {
  const api = { sendMessage: vi.fn(send) } as unknown as GreenApi
  useSessionStore.getState().setReady({ api, idInstance: '1', loginAt: 0, warnings: [] })
  return api
}

const messages = () => useChatsStore.getState().chats['42'].messages
const deps = { now: () => 1000, generateId: () => 'abc' }

describe('send-message', () => {
  beforeEach(() => {
    useSessionStore.getState().clear()
    useChatsStore.getState().reset()
    useChatsStore.getState().apply({ type: 'chatCreated', chatId: '42', title: 'Alice' })
  })

  it('validates input', () => {
    expect(canSend('')).toBe(false)
    expect(canSend('  \n\t ')).toBe(false)
    expect(canSend('hi')).toBe(true)
    expect(canSend('x'.repeat(MAX_MESSAGE_LENGTH))).toBe(true)
    expect(canSend('x'.repeat(MAX_MESSAGE_LENGTH + 1))).toBe(false)
  })

  it('does not send a blank message', async () => {
    const api = login(async () => ({ idMessage: 'X' }))
    expect((await sendMessage('42', '   ', deps)).ok).toBe(false)
    expect(api.sendMessage).not.toHaveBeenCalled()
    expect(messages()).toEqual([])
  })

  it('shows the message as sending, then sent', async () => {
    let resolve!: (r: SendMessageResponse) => void
    const api = login(() => new Promise((r) => (resolve = r)))
    const pending = sendMessage('42', 'hello', deps)
    expect(messages()).toEqual([
      { id: 'tmp-abc', direction: 'out', content: { type: 'text', text: 'hello' }, timestamp: 1000, status: 'sending' },
    ])
    expect(api.sendMessage).toHaveBeenCalledWith('42', 'hello')
    resolve({ idMessage: 'SRV1' })
    expect(await pending).toEqual({ ok: true, idMessage: 'SRV1' })
    expect(messages()).toEqual([
      { id: 'SRV1', direction: 'out', content: { type: 'text', text: 'hello' }, timestamp: 1000, status: 'sent' },
    ])
  })

  it('marks the message failed on error', async () => {
    login(async () => Promise.reject(new ApiError('network')))
    const result = await sendMessage('42', 'hello', deps)
    expect(result.ok).toBe(false)
    expect(messages()).toHaveLength(1)
    expect(messages()[0]).toMatchObject({ id: 'tmp-abc', status: 'failed' })
  })

  it('retry sends the same text and keeps one copy', async () => {
    const send = vi
      .fn<(chatId: string, text: string) => Promise<SendMessageResponse>>()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockResolvedValueOnce({ idMessage: 'SRV2' })
    const api = login(send)
    await sendMessage('42', 'hello', deps)
    const result = await retry('42', 'tmp-abc')
    expect(result).toEqual({ ok: true, idMessage: 'SRV2' })
    expect(api.sendMessage).toHaveBeenNthCalledWith(2, '42', 'hello')
    expect(messages()).toHaveLength(1)
    expect(messages()[0]).toMatchObject({ id: 'SRV2', status: 'sent', timestamp: 1000 })
  })

  it('retry does nothing for a message that is not failed', async () => {
    const api = login(async () => ({ idMessage: 'S' }))
    await sendMessage('42', 'hello', deps)
    expect((await retry('42', 'S')).ok).toBe(false)
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('ignores a response that arrives after logout', async () => {
    let resolve!: (r: SendMessageResponse) => void
    login(() => new Promise((r) => (resolve = r)))
    const pending = sendMessage('42', 'hello', deps)
    useSessionStore.getState().clear()
    useChatsStore.getState().reset()
    resolve({ idMessage: 'LATE' })
    expect((await pending).ok).toBe(false)
    expect(useChatsStore.getState().order).toEqual([])
  })
})
