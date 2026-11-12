import type { MessageSender } from '@/entities/message/@x/chat'
import type { ChatType } from './types'

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

export type ChatEventType = ChatEvent['type']
