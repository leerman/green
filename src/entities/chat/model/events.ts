import type { MessageSender } from '@/entities/message/@x/chat'
import type { ChatType } from './types'

/** One chat from the server's chat list. */
export interface LoadedChat {
  chatId: string
  title: string
  chatType: ChatType
  phone?: string
}

export type ChatEvent =
  | { type: 'chatCreated'; chatId: string; title: string; phone?: string; chatType?: ChatType }
  | { type: 'chatOpened'; chatId: string }
  /** Adds an outgoing `sending` message; with an existing `tmpId` (retry) it only resets the status. */
  | { type: 'messageQueued'; chatId: string; tmpId: string; text: string; ts: number }
  | { type: 'messageSent'; chatId: string; tmpId: string; idMessage: string }
  | { type: 'messageFailed'; chatId: string; tmpId: string }
  | {
      type: 'incomingReceived'
      chatId: string
      idMessage: string
      text: string
      ts: number
      title: string
      phone?: string
      chatType?: ChatType
      /** Author of a group message. */
      sender?: MessageSender
    }
  /** Sent from this app or another device; creates the chat if it is not in the list. */
  | { type: 'outgoingReceived'; chatId: string; idMessage: string; text: string; ts: number; title: string; chatType?: ChatType }

  /**
   * Chat list from the server, in its activity order. New chats are appended after the
   * existing ones; existing chats only get their type and a missing phone.
   */
  | { type: 'chatsLoaded'; chats: LoadedChat[] }

export type ChatEventType = ChatEvent['type']
