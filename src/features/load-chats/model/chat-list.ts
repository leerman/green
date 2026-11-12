import { create } from 'zustand'
import { useChatsStore, type ChatEvent } from '@/entities/chat'
import { describeApiError, type GreenApi } from '@/shared/api'
import { mapChats } from '../lib/map-chats'

export type ChatListStatus = 'idle' | 'loading' | 'error'

export interface ChatListState {
  status: ChatListStatus
  /** User-facing error of the last failed load. */
  error: string | null
}

const initialChatListState: ChatListState = { status: 'idle', error: null }

/** Status of the chat list load, read by the sidebar. */
export const useChatListStore = create<ChatListState>()(() => initialChatListState)

export interface ChatListLoaderDeps {
  dispatch(event: ChatEvent): void
  setState(state: ChatListState): void
}

export interface ChatListLoader {
  /** Loads the chat list once for this session; a previous load is cancelled. */
  start(api: GreenApi): void
  /** Loads again with the current session's client after a failure. */
  retry(): void
  /** Cancels a pending load and resets the status. */
  stop(): void
}

export function createChatListLoader(deps: ChatListLoaderDeps): ChatListLoader {
  // Generation guard: a response from an earlier start() never writes to the store.
  let runId = 0
  let controller: AbortController | null = null
  let currentApi: GreenApi | null = null

  async function load(id: number, api: GreenApi, signal: AbortSignal) {
    const isStale = () => id !== runId || signal.aborted
    deps.setState({ status: 'loading', error: null })
    try {
      const chats = mapChats(await api.getChats({ signal }))
      if (isStale()) return
      deps.dispatch({ type: 'chatsLoaded', chats })
      deps.setState({ status: 'idle', error: null })
    } catch (error) {
      if (isStale()) return
      deps.setState({ status: 'error', error: describeApiError(error) })
    }
  }

  function cancel() {
    runId++
    controller?.abort()
    controller = null
  }

  function run(api: GreenApi) {
    cancel()
    const id = ++runId
    controller = new AbortController()
    void load(id, api, controller.signal)
  }

  return {
    start(api) {
      currentApi = api
      run(api)
    },
    retry() {
      if (currentApi) run(currentApi)
    },
    stop() {
      cancel()
      currentApi = null
      deps.setState(initialChatListState)
    },
  }
}

/** App-wide loader wired to the stores. Started and stopped by app/session-lifecycle. */
export const chatListLoader = createChatListLoader({
  dispatch: (event) => useChatsStore.getState().apply(event),
  setState: (state) => useChatListStore.setState(state),
})
