export interface Credentials {
  idInstance: string
  apiTokenInstance: string
}

export type InstanceState =
  | 'authorized'
  | 'notAuthorized'
  | 'blocked'
  | 'sleepMode'
  | 'starting'
  | 'yellowCard'
  | (string & {})

export interface GetStateInstanceResponse {
  stateInstance: InstanceState
}

export interface GetSettingsResponse {
  wid?: string
  webhookUrl?: string
  webhookUrlToken?: string
  incomingWebhook?: 'yes' | 'no' | (string & {})
  outgoingWebhook?: 'yes' | 'no' | (string & {})
  outgoingAPIMessageWebhook?: 'yes' | 'no' | (string & {})
  outgoingMessageWebhook?: 'yes' | 'no' | (string & {})
  stateWebhook?: 'yes' | 'no' | (string & {})
  [key: string]: unknown
}

export interface CheckAccountRequest {
  phoneNumber: number
}

export interface CheckAccountResponse {
  exist?: boolean
  chatId?: string
  /** `false` when the instance could not perform the check; see `reason`. */
  status?: boolean
  reason?: string
}

export interface SendMessageRequest {
  chatId: string
  message: string
}

export interface SendMessageResponse {
  idMessage: string
}

export interface DeleteNotificationResponse {
  result: boolean
}

export type WebhookType =
  | 'incomingMessageReceived'
  | 'outgoingAPIMessageReceived'
  | 'outgoingMessageReceived'
  | 'outgoingMessageStatus'
  | 'stateInstanceChanged'
  | (string & {})

export interface NotificationSenderData {
  chatId?: string
  chatName?: string
  sender?: string
  senderName?: string
  senderContactName?: string
  senderPhoneNumber?: number | string
}

export interface NotificationMessageData {
  typeMessage?: string
  textMessageData?: { textMessage?: string }
  extendedTextMessageData?: { text?: string }
  [key: string]: unknown
}

/**
 * Body of a queued notification. Every field is optional because the shape
 * depends on `typeWebhook` and consumers must parse it defensively.
 */
export interface NotificationBody {
  typeWebhook?: WebhookType
  instanceData?: { idInstance?: number; wid?: string; typeInstance?: string }
  timestamp?: number
  idMessage?: string
  senderData?: NotificationSenderData
  messageData?: NotificationMessageData
  [key: string]: unknown
}

export interface Notification {
  receiptId: number
  body: NotificationBody
}

export interface ReceiveNotificationOptions {
  /** Long-polling timeout in seconds (5–60). */
  receiveTimeout: number
  signal?: AbortSignal
}

export type ChatType = 'user' | 'group' | 'channel' | 'bot' | (string & {})

/** One item of `getChats`. Fields are optional: the MAX payload is only partly documented. */
export interface GetChatsItem {
  chatId?: string
  name?: string
  type?: ChatType
  /** `0` when the number is hidden or the chat is a group. */
  phoneNumber?: number | string
  unreadCount?: number
  [key: string]: unknown
}

export type GetChatsResponse = GetChatsItem[]

export interface GetChatHistoryRequest {
  chatId: string
  count: number
}

/** One message of `getChatHistory`. Newest first. Parse defensively. */
export interface ChatHistoryItem {
  type?: 'incoming' | 'outgoing' | (string & {})
  idMessage?: string
  /** UNIX time in seconds. */
  timestamp?: number
  typeMessage?: string
  chatId?: string
  textMessage?: string
  extendedTextMessage?: { text?: string; [key: string]: unknown }
  statusMessage?: string
  senderId?: string
  senderName?: string
  senderContactName?: string
  isDeleted?: boolean
  [key: string]: unknown
}

export type GetChatHistoryResponse = ChatHistoryItem[]

export interface RequestOptions {
  signal?: AbortSignal
}
