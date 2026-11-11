import type { Message } from '@/entities/message/@x/chat'

export interface Chat {
  /** Numeric MAX chat ID, used as the key. */
  chatId: string
  title: string
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
