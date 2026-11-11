import axios, { type AxiosInstance } from 'axios'

export type ApiErrorKind = 'auth' | 'limit' | 'network' | 'server' | 'validation' | 'canceled'

const MESSAGES: Record<ApiErrorKind, string> = {
  auth: 'Authorization error',
  limit: 'Request limit reached',
  network: 'Network error',
  server: 'GREEN-API server error',
  validation: 'Request rejected by GREEN-API',
  canceled: 'Request canceled',
}

/**
 * Safe error for the rest of the app. It deliberately carries no request
 * config, URL or original error: GREEN-API URLs contain the instance token.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number

  constructor(kind: ApiErrorKind, status?: number) {
    super(status === undefined ? MESSAGES[kind] : `${MESSAGES[kind]} (HTTP ${status})`)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 469) return 'limit'
  if (status >= 500) return 'server'
  return 'validation'
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) return new ApiError('canceled')
  if (axios.isAxiosError(error)) {
    if (error.code === 'ERR_CANCELED') return new ApiError('canceled')
    const status = error.response?.status
    if (status === undefined) return new ApiError('network')
    return new ApiError(kindFromStatus(status), status)
  }
  return new ApiError('network')
}

export function installErrorInterceptor(http: AxiosInstance): void {
  http.interceptors.response.use(undefined, (error: unknown) => Promise.reject(toApiError(error)))
}

export type ApiErrorMessages = Partial<Record<ApiErrorKind, string | ((error: ApiError) => string)>>

const USER_MESSAGES: Record<ApiErrorKind, (error: ApiError) => string> = {
  auth: () => 'GREEN-API rejected the instance credentials. Log in again.',
  limit: () => 'Too many requests to GREEN-API. Try again later.',
  network: () => 'Cannot connect to GREEN-API. Check your internet connection and try again.',
  canceled: () => 'Cannot connect to GREEN-API. Check your internet connection and try again.',
  server: () => 'GREEN-API server error. Try again later.',
  validation: (e) => `GREEN-API rejected the request${e.status ? ` (HTTP ${e.status})` : ''}.`,
}

/** User-facing text for an API error; callers override the kinds they can explain better. */
export function describeApiError(error: unknown, overrides: ApiErrorMessages = {}): string {
  if (!isApiError(error)) return 'Unexpected error. Try again.'
  const message = overrides[error.kind] ?? USER_MESSAGES[error.kind]
  return typeof message === 'function' ? message(error) : message
}
