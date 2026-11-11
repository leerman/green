import { useChatsStore } from '@/entities/chat'
import { useSessionStore } from '@/entities/session'
import { isApiError, type CheckAccountResponse } from '@/shared/api'
import { normalizePhone, PHONE_MAX_DIGITS, PHONE_MIN_DIGITS } from '@/shared/lib/phone'

export const INVALID_PHONE_MESSAGE = `Invalid number. Enter ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits in international format, with the country code.`
export const NOT_REGISTERED_MESSAGE = 'This number is not registered in MAX'
export const CANNOT_CHECK_MESSAGE = 'This number cannot be checked in MAX'
export const LIMIT_MESSAGE = 'The MAX number check limit has been reached. Try again later.'

export type CreateChatResult = { ok: true; chatId: string } | { ok: false; error: string }

function checkErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Unexpected error. Try again.'
  switch (error.kind) {
    case 'validation':
      return CANNOT_CHECK_MESSAGE
    case 'limit':
      return LIMIT_MESSAGE
    case 'network':
    case 'canceled':
      return 'Cannot connect to GREEN-API. Check your connection and try again.'
    case 'auth':
      return 'GREEN-API rejected the instance credentials. Log in again.'
    case 'server':
      return 'GREEN-API server error. Try again later.'
  }
}

export async function createChat(input: string): Promise<CreateChatResult> {
  const normalized = normalizePhone(input)
  if (!normalized.ok) return { ok: false, error: INVALID_PHONE_MESSAGE }
  const { phone } = normalized

  const chats = useChatsStore.getState()
  const byPhone = Object.values(chats.chats).find((c) => c.phone === phone)
  if (byPhone) {
    chats.openChat(byPhone.chatId)
    return { ok: true, chatId: byPhone.chatId }
  }

  const api = useSessionStore.getState().api
  if (!api) return { ok: false, error: 'You are not logged in' }

  let response: CheckAccountResponse
  try {
    response = await api.checkAccount(Number(phone))
  } catch (error) {
    return { ok: false, error: checkErrorMessage(error) }
  }
  // The session ended while the check was in flight.
  if (useSessionStore.getState().api !== api) return { ok: false, error: 'You are not logged in' }

  if (response.status === false) {
    return { ok: false, error: response.reason || 'The instance could not check the number. Try again later.' }
  }
  if (!response.exist) return { ok: false, error: NOT_REGISTERED_MESSAGE }
  if (response.chatId === undefined || response.chatId === null || String(response.chatId) === '') {
    return { ok: false, error: CANNOT_CHECK_MESSAGE }
  }

  const chatId = String(response.chatId)
  const store = useChatsStore.getState()
  // For an existing chatId, chatCreated only fills in the missing phone.
  store.apply({ type: 'chatCreated', chatId, title: `+${phone}`, phone })
  store.openChat(chatId)
  return { ok: true, chatId }
}
