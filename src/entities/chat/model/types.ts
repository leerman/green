import type { Message } from '@/entities/message/@x/chat'

export type ChatType = 'user' | 'group' | 'channel' | 'bot'

/** Whether the chat's history has been requested from GREEN-API in this session. */
export type HistoryState = 'idle' | 'loading' | 'loaded' | 'error'

export interface Chat {
  /** Numeric MAX chat ID, used as the key. */
  chatId: string
  title: string
  /** Inferred from `chatId` until GREEN-API reports the real type. */
  type: ChatType
  history: HistoryState
  /** Normalized phone number, digits only. */
  phone?: string
  /** Sorted by timestamp, oldest first. */
  messages: Message[]
}

export interface ChatsState {
  chats: Record<string, Chat>
  /** Chat IDs, most recent activity first. */
  order: string[]
  activeChatId: string | null
}

export const initialChatsState: ChatsState = {
  chats: {},
  order: [],
  activeChatId: null,
}
