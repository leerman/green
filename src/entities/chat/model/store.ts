import { create } from 'zustand'
import { applyEvent } from './apply-event'
import type { ChatEvent } from './events'
import { initialChatsState, type ChatsState } from './types'

export interface ChatsStore extends ChatsState {
  apply(event: ChatEvent): void
  openChat(chatId: string): void
  reset(): void
}

function pickState({ chats, order, activeChatId }: ChatsState): ChatsState {
  return { chats, order, activeChatId }
}

export const useChatsStore = create<ChatsStore>()((set) => ({
  ...initialChatsState,
  apply: (event) => set((s) => applyEvent(pickState(s), event)),
  openChat: (chatId) => set((s) => applyEvent(pickState(s), { type: 'chatOpened', chatId })),
  reset: () => set(initialChatsState),
}))
