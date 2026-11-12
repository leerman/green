import type { Message } from '@/entities/message/@x/chat'
import type { ChatEvent } from './events'
import type { Chat, ChatsState } from './types'

function moveToTop(order: string[], chatId: string): string[] {
  return [chatId, ...order.filter((id) => id !== chatId)]
}

/** Inserts keeping timestamp order; equal timestamps keep arrival order. */
function insertByTimestamp(messages: Message[], message: Message): Message[] {
  let i = messages.length
  while (i > 0 && messages[i - 1].timestamp > message.timestamp) i--
  return [...messages.slice(0, i), message, ...messages.slice(i)]
}

function updateChat(state: ChatsState, chat: Chat, { toTop }: { toTop: boolean }): ChatsState {
  return {
    ...state,
    chats: { ...state.chats, [chat.chatId]: chat },
    order: toTop ? moveToTop(state.order, chat.chatId) : state.order,
  }
}

function updateMessage(
  state: ChatsState,
  chatId: string,
  messageId: string,
  patch: (m: Message) => Message,
): ChatsState {
  const chat = state.chats[chatId]
  if (!chat) return state
  const index = chat.messages.findIndex((m) => m.id === messageId)
  if (index === -1) return state
  const messages = chat.messages.slice()
  messages[index] = patch(messages[index])
  return updateChat(state, { ...chat, messages }, { toTop: false })
}

export function applyEvent(state: ChatsState, event: ChatEvent): ChatsState {
  switch (event.type) {
    case 'chatCreated': {
      const existing = state.chats[event.chatId]
      if (existing) {
        if (existing.phone || !event.phone) return state
        return updateChat(state, { ...existing, phone: event.phone }, { toTop: false })
      }
      const chat: Chat = {
        chatId: event.chatId,
        title: event.title || event.chatId,
        phone: event.phone,
        messages: [],
      }
      return updateChat(state, chat, { toTop: true })
    }

    case 'chatOpened': {
      if (!state.chats[event.chatId] || state.activeChatId === event.chatId) return state
      return { ...state, activeChatId: event.chatId }
    }

    case 'messageQueued': {
      const chat = state.chats[event.chatId]
      if (!chat) return state
      if (chat.messages.some((m) => m.id === event.tmpId)) {
        // Retry: reuse the existing message instead of adding a copy.
        return updateMessage(state, event.chatId, event.tmpId, (m) => ({ ...m, status: 'sending' }))
      }
      const message: Message = {
        id: event.tmpId,
        direction: 'out',
        content: { type: 'text', text: event.text },
        timestamp: event.ts,
        status: 'sending',
      }
      return updateChat(state, { ...chat, messages: insertByTimestamp(chat.messages, message) }, { toTop: true })
    }

    case 'messageFailed':
      return updateMessage(state, event.chatId, event.tmpId, (m) =>
        m.status === 'sending' ? { ...m, status: 'failed' } : m,
      )

    case 'incomingReceived': {
      const message: Message = {
        id: event.idMessage,
        direction: 'in',
        content: { type: 'text', text: event.text },
        timestamp: event.ts,
      }
      const existing = state.chats[event.chatId]
      if (!existing) {
        const chat: Chat = {
          chatId: event.chatId,
          title: event.title || event.chatId,
          phone: event.phone,
          messages: [message],
        }
        return updateChat(state, chat, { toTop: true })
      }
      if (existing.messages.some((m) => m.id === event.idMessage)) return state
      const chat: Chat = {
        ...existing,
        phone: existing.phone ?? event.phone,
        messages: insertByTimestamp(existing.messages, message),
      }
      return updateChat(state, chat, { toTop: true })
    }

    case 'messageSent': {
      const chat = state.chats[event.chatId]
      if (!chat) return state
      if (chat.messages.some((m) => m.id === event.idMessage)) {
        // The server echo arrived first: it already represents this message.
        if (!chat.messages.some((m) => m.id === event.tmpId)) return state
        const messages = chat.messages.filter((m) => m.id !== event.tmpId)
        return updateChat(state, { ...chat, messages }, { toTop: false })
      }
      return updateMessage(state, event.chatId, event.tmpId, (m) => ({
        ...m,
        id: event.idMessage,
        status: 'sent',
      }))
    }

    case 'outgoingReceived': {
      const chat = state.chats[event.chatId]
      if (!chat) {
        // Sent from another device to a chat that is not in the list yet
        // (e.g. to yourself in Favorites): create it.
        const created: Chat = {
          chatId: event.chatId,
          title: event.title || event.chatId,
          messages: [
            {
              id: event.idMessage,
              direction: 'out',
              content: { type: 'text', text: event.text },
              timestamp: event.ts,
              status: 'sent',
            },
          ],
        }
        return updateChat(state, created, { toTop: true })
      }
      const existing = chat.messages.find((m) => m.id === event.idMessage)
      // An incoming message with the same id is not ours to replace.
      if (existing?.direction === 'in') return state
      if (existing) {
        const unchanged =
          existing.status === 'sent' &&
          existing.timestamp === event.ts &&
          existing.content.type === 'text' &&
          existing.content.text === event.text
        if (unchanged) return state
        // Replace the local copy with the server copy. The server timestamp
        // fixes the order when the client clock differs from the server's.
        const serverCopy: Message = {
          ...existing,
          content: { type: 'text', text: event.text },
          timestamp: event.ts,
          status: 'sent',
        }
        const others = chat.messages.filter((m) => m.id !== event.idMessage)
        return updateChat(state, { ...chat, messages: insertByTimestamp(others, serverCopy) }, { toTop: false })
      }
      const message: Message = {
        id: event.idMessage,
        direction: 'out',
        content: { type: 'text', text: event.text },
        timestamp: event.ts,
        status: 'sent',
      }
      return updateChat(state, { ...chat, messages: insertByTimestamp(chat.messages, message) }, { toTop: true })
    }
  }
}
