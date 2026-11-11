export type ChatEvent =
  | { type: 'chatCreated'; chatId: string; title: string; phone?: string }
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
    }
  | { type: 'outgoingReceived'; chatId: string; idMessage: string; text: string; ts: number }

export type ChatEventType = ChatEvent['type']
