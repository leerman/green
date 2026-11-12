import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatsStore } from '@/entities/chat'
import { useSessionStore } from '@/entities/session'
import { ApiError, type CheckAccountResponse, type GreenApi } from '@/shared/api'
import {
  CANNOT_CHECK_MESSAGE,
  createChat,
  INVALID_PHONE_MESSAGE,
  LIMIT_MESSAGE,
  NOT_REGISTERED_MESSAGE,
} from './create-chat'

function login(checkAccount: (phone: number) => Promise<CheckAccountResponse>) {
  const api = { checkAccount: vi.fn(checkAccount) } as unknown as GreenApi
  useSessionStore.getState().setReady({ api, idInstance: '1', loginAt: 0, warnings: [] })
  return api
}

const chats = () => useChatsStore.getState()

describe('createChat', () => {
  beforeEach(() => {
    useSessionStore.getState().clear()
    chats().reset()
  })

  it('rejects an invalid number without a request', async () => {
    const api = login(async () => ({ exist: true, chatId: '1' }))
    expect(await createChat('+7 999')).toEqual({ ok: false, error: INVALID_PHONE_MESSAGE })
    expect(api.checkAccount).not.toHaveBeenCalled()
  })

  it('opens an existing chat by phone without calling checkAccount', async () => {
    const api = login(async () => ({ exist: true, chatId: '1' }))
    chats().apply({ type: 'chatCreated', chatId: '555', title: 'Alice', phone: '79991234567' })
    expect(await createChat('+7 (999) 123-45-67')).toEqual({ ok: true, chatId: '555' })
    expect(api.checkAccount).not.toHaveBeenCalled()
    expect(chats().activeChatId).toBe('555')
  })

  it('reports exist:false', async () => {
    login(async () => ({ exist: false }))
    expect(await createChat('79991234567')).toEqual({ ok: false, error: NOT_REGISTERED_MESSAGE })
    expect(chats().order).toEqual([])
  })

  it('reports an API validation error', async () => {
    login(async () => Promise.reject(new ApiError('validation', 400)))
    expect(await createChat('+44 20 7946 0958')).toEqual({ ok: false, error: CANNOT_CHECK_MESSAGE })
    expect(chats().order).toEqual([])
  })

  it('reports the 469 check limit', async () => {
    login(async () => Promise.reject(new ApiError('limit', 469)))
    expect(await createChat('79991234567')).toEqual({ ok: false, error: LIMIT_MESSAGE })
    expect(chats().order).toEqual([])
  })

  it('shows the reason for status:false', async () => {
    login(async () => ({ status: false, reason: 'Instance is starting' }))
    expect(await createChat('79991234567')).toEqual({ ok: false, error: 'Instance is starting' })
    expect(chats().order).toEqual([])
  })

  it('opens the existing chat for a known chatId and fills in its phone', async () => {
    login(async () => ({ exist: true, chatId: '777' }))
    chats().apply({ type: 'incomingReceived', chatId: '777', idMessage: 'm', text: 'hi', ts: 1, title: 'Bob' })
    expect(await createChat('375291234567')).toEqual({ ok: true, chatId: '777' })
    expect(chats().order).toEqual(['777'])
    expect(chats().chats['777']).toMatchObject({ title: 'Bob', phone: '375291234567' })
    expect(chats().activeChatId).toBe('777')
  })

  it('creates and opens a chat on success', async () => {
    const api = login(async () => ({ exist: true, chatId: '10001' }))
    expect(await createChat('+7 999 123 45 67')).toEqual({ ok: true, chatId: '10001' })
    expect(api.checkAccount).toHaveBeenCalledWith(79991234567)
    expect(chats().chats['10001']).toEqual({
      chatId: '10001',
      title: '+79991234567',
      phone: '79991234567',
      type: 'user',
      history: 'idle',
      messages: [],
    })
    expect(chats().activeChatId).toBe('10001')
  })
})
