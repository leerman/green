import { create } from 'zustand'
import type { GreenApi } from '@/shared/api'

export type SessionStatus = 'idle' | 'checking' | 'ready'
export type ConnectionState = 'online' | 'reconnecting'

export interface SessionState {
  /** Only the instance ID is kept; the token lives inside the `api` client closure. */
  idInstance: string | null
  api: GreenApi | null
  /** ms since epoch; notifications older than this are discarded. */
  loginAt: number | null
  status: SessionStatus
  /** User-facing login error. */
  error: string | null
  /** User-facing, non-blocking warnings about instance settings. */
  warnings: string[]
  connection: ConnectionState
}

export interface ReadyPayload {
  api: GreenApi
  idInstance: string
  loginAt: number
  warnings: string[]
}

export interface SessionStore extends SessionState {
  setChecking(): void
  setReady(payload: ReadyPayload): void
  setError(error: string): void
  setConnection(connection: ConnectionState): void
  clear(): void
}

export const initialSessionState: SessionState = {
  idInstance: null,
  api: null,
  loginAt: null,
  status: 'idle',
  error: null,
  warnings: [],
  connection: 'online',
}

export const useSessionStore = create<SessionStore>()((set) => ({
  ...initialSessionState,
  setChecking: () => set({ ...initialSessionState, status: 'checking' }),
  setReady: ({ api, idInstance, loginAt, warnings }) =>
    set({ api, idInstance, loginAt, warnings, status: 'ready', error: null, connection: 'online' }),
  setError: (error) => set({ ...initialSessionState, error }),
  setConnection: (connection) => set((s) => (s.connection === connection ? s : { connection })),
  clear: () => set(initialSessionState),
}))
