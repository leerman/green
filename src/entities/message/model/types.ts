/** Discriminated union of message payloads. Only `text` exists in this version. */
export type MessageContent = { type: 'text'; text: string }

export type MessageStatus = 'sending' | 'sent' | 'failed'

export type MessageDirection = 'in' | 'out'

export interface Message {
  /** `tmp-<uuid>` until the sendMessage response, then the GREEN-API `idMessage`. */
  id: string
  direction: MessageDirection
  content: MessageContent
  /** Milliseconds since epoch. */
  timestamp: number
  /** Outgoing messages only; server copies are `sent`. */
  status?: MessageStatus
}
