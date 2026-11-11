import { useChatsStore } from '@/entities/chat'
import { useSessionStore } from '@/entities/session'

export const MAX_MESSAGE_LENGTH = 4000

export type SendResult = { ok: true; idMessage: string } | { ok: false; error: string }

export interface SendDeps {
  now?: () => number
  generateId?: () => string
}

/** Whether the text can be sent: not blank and within the length limit. */
export function canSend(text: string): boolean {
  return text.trim().length > 0 && text.length <= MAX_MESSAGE_LENGTH
}

async function deliver(chatId: string, tmpId: string, text: string): Promise<SendResult> {
  const api = useSessionStore.getState().api
  if (!api) {
    useChatsStore.getState().apply({ type: 'messageFailed', chatId, tmpId })
    return { ok: false, error: 'You are not logged in' }
  }
  try {
    const { idMessage } = await api.sendMessage(chatId, text)
    // Ignore responses that arrive after logout.
    if (useSessionStore.getState().api !== api) return { ok: false, error: 'Session ended' }
    useChatsStore.getState().apply({ type: 'messageSent', chatId, tmpId, idMessage: String(idMessage) })
    return { ok: true, idMessage: String(idMessage) }
  } catch (error) {
    if (useSessionStore.getState().api !== api) return { ok: false, error: 'Session ended' }
    useChatsStore.getState().apply({ type: 'messageFailed', chatId, tmpId })
    return { ok: false, error: error instanceof Error ? error.message : 'Send failed' }
  }
}

/** Shows the message immediately as `sending`, then sends it. */
export async function sendMessage(
  chatId: string,
  rawText: string,
  { now = Date.now, generateId = () => crypto.randomUUID() }: SendDeps = {},
): Promise<SendResult> {
  if (!canSend(rawText)) return { ok: false, error: 'Message is empty or too long' }
  const text = rawText.trim()
  const chats = useChatsStore.getState()
  if (!chats.chats[chatId]) return { ok: false, error: 'Chat not found' }

  const tmpId = `tmp-${generateId()}`
  chats.apply({ type: 'messageQueued', chatId, tmpId, text, ts: now() })
  return deliver(chatId, tmpId, text)
}

/** Re-sends a failed message, reusing the same local copy. */
export async function retry(chatId: string, messageId: string): Promise<SendResult> {
  const chats = useChatsStore.getState()
  const message = chats.chats[chatId]?.messages.find((m) => m.id === messageId)
  if (!message || message.direction !== 'out' || message.status !== 'failed') {
    return { ok: false, error: 'Nothing to retry' }
  }
  const text = message.content.type === 'text' ? message.content.text : ''
  chats.apply({ type: 'messageQueued', chatId, tmpId: messageId, text, ts: message.timestamp })
  return deliver(chatId, messageId, text)
}
