import { useChatsStore } from '@/entities/chat'
import { useSessionStore, type SessionState } from '@/entities/session'
import {
  chatListLoader as defaultChatListLoader,
  stopHistory as defaultStopHistory,
  type ChatListLoader,
} from '@/features/load-chats'
import { poller as defaultPoller, type Poller } from '@/features/receive-notifications'

export interface SessionLifecycleDeps {
  poller?: Pick<Poller, 'start' | 'stop'>
  chatListLoader?: Pick<ChatListLoader, 'start' | 'stop'>
  stopHistory?: () => void
  resetChats?: () => void
}

/**
 * The only place that connects features: entering `ready` starts the poller and the
 * chat list load; leaving it stops them, cancels history loads, and clears chats.
 * Returns an unsubscribe function.
 */
export function initSessionLifecycle({
  poller = defaultPoller,
  chatListLoader = defaultChatListLoader,
  stopHistory = defaultStopHistory,
  resetChats = () => useChatsStore.getState().reset(),
}: SessionLifecycleDeps = {}): () => void {
  let activeApi: SessionState['api'] = null

  const stopAll = () => {
    poller.stop()
    chatListLoader.stop()
    stopHistory()
  }

  const sync = (state: SessionState) => {
    const ready = state.status === 'ready' && state.api !== null && state.loginAt !== null
    if (ready && state.api !== activeApi) {
      if (activeApi) {
        stopAll()
        resetChats()
      }
      activeApi = state.api
      poller.start(state.api!, state.loginAt!)
      chatListLoader.start(state.api!)
    } else if (!ready && activeApi) {
      activeApi = null
      stopAll()
      resetChats()
    }
  }

  sync(useSessionStore.getState())
  const unsubscribe = useSessionStore.subscribe(sync)
  return () => {
    unsubscribe()
    if (activeApi) {
      activeApi = null
      stopAll()
    }
  }
}
