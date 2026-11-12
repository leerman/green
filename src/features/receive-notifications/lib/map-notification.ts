import { inferChatType, type ChatEvent } from '@/entities/chat'
import type { NotificationBody } from '@/shared/api'
import { normalizePhone } from '@/shared/lib/phone'

/** Notifications up to this many seconds older than login are still shown. */
export const LOGIN_CLOCK_SKEW_S = 30

/** Plain text and text with a link preview are both shown as text. */
const TEXT_MESSAGE_TYPES = new Set(['textMessage', 'extendedTextMessage'])

const MESSAGE_WEBHOOKS = new Set(['incomingMessageReceived', 'outgoingAPIMessageReceived', 'outgoingMessageReceived'])

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * Text field of a text message. Which field outgoing MAX notifications use is not
 * confirmed yet (task 4.5), so both known fields are read.
 */
function readText(messageData: NotificationBody['messageData']): string | undefined {
  return (
    nonEmptyString(messageData?.textMessageData?.textMessage) ??
    nonEmptyString(messageData?.extendedTextMessageData?.text)
  )
}

/** Same normalization as chats created by number, so both match on `phone`. */
function readPhone(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const result = normalizePhone(String(value))
  return result.ok ? result.phone : undefined
}

/**
 * Converts a GREEN-API notification into a chat event, or `null` to ignore it.
 * Ignored: notifications from before login, non-message webhooks, non-text messages,
 * and anything with missing fields. Group chats are passed on with the message sender.
 */
export function mapNotification(body: unknown, loginAt: number): ChatEvent | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as NotificationBody

  if (typeof b.timestamp !== 'number' || !Number.isFinite(b.timestamp)) return null
  // Server timestamps are whole seconds on the server clock, loginAt is ms on the
  // client clock: compare in seconds and allow for clock skew so a fresh message
  // is never treated as old (it would be deleted from the queue and lost).
  if (b.timestamp < Math.floor(loginAt / 1000) - LOGIN_CLOCK_SKEW_S) return null
  const ts = b.timestamp * 1000

  if (typeof b.typeWebhook !== 'string' || !MESSAGE_WEBHOOKS.has(b.typeWebhook)) return null
  const typeMessage = b.messageData?.typeMessage
  if (typeMessage === undefined || !TEXT_MESSAGE_TYPES.has(typeMessage)) return null

  const text = readText(b.messageData)
  if (text === undefined) return null

  const chatId = nonEmptyString(b.senderData?.chatId)
  if (chatId === undefined) return null

  const idMessage = nonEmptyString(b.idMessage)
  if (idMessage === undefined) return null

  if (b.typeWebhook === 'incomingMessageReceived') {
    const s = b.senderData!
    if (inferChatType(chatId) === 'group') {
      // In a group the chat is named after the group; the author goes on the message.
      // The sender's phone is not the chat's, so the chat gets none.
      const title = nonEmptyString(s.chatName) ?? chatId
      const senderId = nonEmptyString(s.sender)
      const name = nonEmptyString(s.senderContactName) ?? nonEmptyString(s.senderName)
      const sender = senderId ? { id: senderId, ...(name ? { name } : {}) } : undefined
      return { type: 'incomingReceived', chatId, idMessage, text, ts, title, ...(sender ? { sender } : {}) }
    }
    const title =
      nonEmptyString(s.senderContactName) ?? nonEmptyString(s.senderName) ?? nonEmptyString(s.chatName) ?? chatId
    const phone = readPhone(s.senderPhoneNumber)
    return { type: 'incomingReceived', chatId, idMessage, text, ts, title, ...(phone ? { phone } : {}) }
  }

  // The sender of an outgoing message is the instance itself: only the chat name describes the recipient.
  const title = nonEmptyString(b.senderData?.chatName) ?? chatId
  return { type: 'outgoingReceived', chatId, idMessage, text, ts, title }
}
