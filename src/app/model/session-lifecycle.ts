import { useChatsStore } from '@/entities/chat'
import { useSessionStore, type SessionState } from '@/entities/session'
import { poller as defaultPoller, type Poller } from '@/features/receive-notifications'

export interface SessionLifecycleDeps {
  poller?: Pick<Poller, 'start' | 'stop'>
  resetChats?: () => void
}

/**
 * The only place that connects features: entering `ready` starts the poller,
 * leaving it stops the poller and clears chats. Returns an unsubscribe function.
 */
export function initSessionLifecycle({
  poller = defaultPoller,
  resetChats = () => useChatsStore.getState().reset(),
}: SessionLifecycleDeps = {}): () => void {
  let activeApi: SessionState['api'] = null

  const sync = (state: SessionState) => {
    const ready = state.status === 'ready' && state.api !== null && state.loginAt !== null
    if (ready && state.api !== activeApi) {
      if (activeApi) {
        poller.stop()
        resetChats()
      }
      activeApi = state.api
      poller.start(state.api!, state.loginAt!)
    } else if (!ready && activeApi) {
      activeApi = null
      poller.stop()
      resetChats()
    }
  }

  sync(useSessionStore.getState())
  const unsubscribe = useSessionStore.subscribe(sync)
  return () => {
    unsubscribe()
    if (activeApi) {
      activeApi = null
      poller.stop()
    }
  }
}
