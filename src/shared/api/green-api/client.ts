import axios from 'axios'
import { env } from '@/shared/config'
import type {
  CheckAccountResponse,
  Credentials,
  DeleteNotificationResponse,
  GetSettingsResponse,
  GetStateInstanceResponse,
  Notification,
  ReceiveNotificationOptions,
  SendMessageResponse,
} from './types'

export const DEFAULT_TIMEOUT_MS = 15_000
/** Extra time on top of `receiveTimeout` so axios does not abort a normal long poll. */
export const RECEIVE_TIMEOUT_MARGIN_S = 10

export interface GreenApi {
  getStateInstance(): Promise<GetStateInstanceResponse>
  getSettings(): Promise<GetSettingsResponse>
  checkAccount(phone: number): Promise<CheckAccountResponse>
  sendMessage(chatId: string, text: string): Promise<SendMessageResponse>
  receiveNotification(options: ReceiveNotificationOptions): Promise<Notification | null>
  deleteNotification(receiptId: number): Promise<DeleteNotificationResponse>
}

export interface CreateApiOptions {
  baseURL?: string
}

export function createApi(
  { idInstance, apiTokenInstance }: Credentials,
  { baseURL = env.greenApiUrl }: CreateApiOptions = {},
): GreenApi {
  const http = axios.create({ baseURL, timeout: DEFAULT_TIMEOUT_MS })

  // The token lives only inside this closure.
  const url = (method: string, suffix = '') =>
    `/waInstance${encodeURIComponent(idInstance)}/${method}/${encodeURIComponent(apiTokenInstance)}${suffix}`

  return {
    async getStateInstance() {
      const { data } = await http.get<GetStateInstanceResponse>(url('getStateInstance'))
      return data
    },

    async getSettings() {
      const { data } = await http.get<GetSettingsResponse>(url('getSettings'))
      return data
    },

    async checkAccount(phone) {
      const { data } = await http.post<CheckAccountResponse>(url('checkAccount'), {
        phoneNumber: phone,
      })
      return data
    },

    async sendMessage(chatId, text) {
      const { data } = await http.post<SendMessageResponse>(url('sendMessage'), {
        chatId,
        message: text,
      })
      return data
    },

    async receiveNotification({ receiveTimeout, signal }) {
      const { data } = await http.get<Notification | '' | null>(url('receiveNotification'), {
        params: { receiveTimeout },
        timeout: (receiveTimeout + RECEIVE_TIMEOUT_MARGIN_S) * 1000,
        signal,
      })
      return data === null || data === '' || data === undefined ? null : data
    },

    async deleteNotification(receiptId) {
      const { data } = await http.delete<DeleteNotificationResponse>(
        url('deleteNotification', `/${receiptId}`),
      )
      return data
    },
  }
}
