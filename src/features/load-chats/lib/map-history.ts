import type { Message } from '@/entities/message'
import type { ChatHistoryItem } from '@/shared/api'

/** Plain text and text with a link preview are both shown as text. */
const TEXT_MESSAGE_TYPES = new Set(['textMessage', 'extendedTextMessage'])

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * Converts one `getChatHistory` item (also the shape of `getChats` `lastMessage`) into a
 * message, or `null` to skip it: non-text types (media, reactions, `editedMessage`
 * markers), deleted messages, and anything with missing fields.
 */
export function mapHistoryItem(item: unknown): Message | null {
  if (typeof item !== 'object' || item === null) return null
  const m = item as ChatHistoryItem

  if (typeof m.typeMessage !== 'string' || !TEXT_MESSAGE_TYPES.has(m.typeMessage)) return null
  if (m.isDeleted === true) return null
  if (m.type !== 'incoming' && m.type !== 'outgoing') return null

  const id = nonEmptyString(m.idMessage)
  if (id === undefined) return null
  if (typeof m.timestamp !== 'number' || !Number.isFinite(m.timestamp)) return null

  // Both text types carry `textMessage` on MAX; the link-preview object is the fallback.
  const text = nonEmptyString(m.textMessage) ?? nonEmptyString(m.extendedTextMessage?.text)
  if (text === undefined) return null

  const base = { id, content: { type: 'text', text }, timestamp: m.timestamp * 1000 } as const
  if (m.type === 'outgoing') {
    // Delivered/read are not modeled: every server copy is `sent`.
    return { ...base, direction: 'out', status: 'sent' }
  }

  const senderId = nonEmptyString(m.senderId)
  if (senderId === undefined) return { ...base, direction: 'in' }
  // `senderContactName` is usually "" on MAX, so empty strings fall through.
  const name = nonEmptyString(m.senderContactName) ?? nonEmptyString(m.senderName)
  return { ...base, direction: 'in', sender: name ? { id: senderId, name } : { id: senderId } }
}

/** Maps a `getChatHistory` response (newest first) to text messages, oldest first. */
export function mapHistory(items: unknown): Message[] {
  if (!Array.isArray(items)) return []
  const messages = items
    .map(mapHistoryItem)
    .filter((m): m is Message => m !== null)
    .reverse()
  // Stable sort: equal timestamps keep the server's order.
  return messages.sort((a, b) => a.timestamp - b.timestamp)
}
