import type { ChatType, LoadedChat } from '@/entities/chat'
import type { GetChatsItem } from '@/shared/api'
import { normalizePhone } from '@/shared/lib/phone'
import { mapHistoryItem } from './map-history'

const CHAT_TYPES = new Set<ChatType>(['user', 'group', 'channel', 'bot'])

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** `0` means hidden or not applicable (groups, channels, bots, hidden numbers). */
function readPhone(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  if (Number(value) === 0) return undefined
  // Same normalization as chats created by number, so both match on `phone`.
  const result = normalizePhone(String(value))
  return result.ok ? result.phone : undefined
}

/** Converts one `getChats` item into a chat list entry, or `null` when it has no `chatId`. */
export function mapChatsItem(item: unknown): LoadedChat | null {
  if (typeof item !== 'object' || item === null) return null
  const c = item as GetChatsItem

  const chatId = nonEmptyString(c.chatId)
  if (chatId === undefined) return null

  const chatType = CHAT_TYPES.has(c.type as ChatType) ? (c.type as ChatType) : 'user'
  const phone = readPhone(c.phoneNumber)
  const lastMessage = mapHistoryItem(c.lastMessage) ?? undefined

  return {
    chatId,
    title: nonEmptyString(c.name) ?? chatId,
    chatType,
    ...(phone ? { phone } : {}),
    ...(lastMessage ? { lastMessage } : {}),
  }
}

/** Maps a `getChats` response, keeping the server order. */
export function mapChats(items: unknown): LoadedChat[] {
  if (!Array.isArray(items)) return []
  return items.map(mapChatsItem).filter((c): c is LoadedChat => c !== null)
}
