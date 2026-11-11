import { useSessionStore } from '@/entities/session'
import { createApi as defaultCreateApi, isApiError, type Credentials, type GreenApi } from '@/shared/api'
import { checkSettings, SETTINGS_UNAVAILABLE_WARNING } from '../lib/check-settings'

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid idInstance or apiTokenInstance'
export const NETWORK_ERROR_MESSAGE = 'Cannot connect to GREEN-API. Check your internet connection and try again.'

export function notAuthorizedMessage(state: string): string {
  return `The instance is not authorized in MAX (state: ${state}). Authorize it in the GREEN-API console and try again.`
}

function loginErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Unexpected error. Try again.'
  switch (error.kind) {
    case 'auth':
      return INVALID_CREDENTIALS_MESSAGE
    case 'network':
    case 'canceled':
      return NETWORK_ERROR_MESSAGE
    case 'limit':
      return 'Too many requests to GREEN-API. Try again later.'
    case 'server':
      return 'GREEN-API server error. Try again later.'
    case 'validation':
      return `GREEN-API rejected the request${error.status ? ` (HTTP ${error.status})` : ''}. Check idInstance and apiTokenInstance.`
  }
}

export interface LoginDeps {
  createApi?: (credentials: Credentials) => GreenApi
  now?: () => number
}

export type LoginResult = { ok: true } | { ok: false; error: string }

let attempt = 0

/**
 * Checks the instance and moves the session to `ready`.
 * The poller is started by app/session-lifecycle in reaction to `ready`.
 */
export async function login(
  credentials: Credentials,
  { createApi = defaultCreateApi, now = Date.now }: LoginDeps = {},
): Promise<LoginResult> {
  const idInstance = credentials.idInstance.trim()
  const apiTokenInstance = credentials.apiTokenInstance.trim()
  const session = useSessionStore.getState()
  const current = ++attempt
  // A newer login or a logout happened while we were waiting.
  const stale = () => current !== attempt || useSessionStore.getState().status !== 'checking'

  session.setChecking()
  const api = createApi({ idInstance, apiTokenInstance })

  const fail = (error: string): LoginResult => {
    if (!stale()) useSessionStore.getState().setError(error)
    return { ok: false, error }
  }

  let state: string
  try {
    state = (await api.getStateInstance()).stateInstance
  } catch (error) {
    return fail(loginErrorMessage(error))
  }
  if (stale()) return { ok: false, error: 'Login canceled' }
  if (state !== 'authorized') return fail(notAuthorizedMessage(String(state)))

  let warnings: string[]
  try {
    warnings = checkSettings(await api.getSettings())
  } catch {
    warnings = [SETTINGS_UNAVAILABLE_WARNING]
  }
  if (stale()) return { ok: false, error: 'Login canceled' }

  useSessionStore.getState().setReady({ api, idInstance, loginAt: now(), warnings })
  return { ok: true }
}
