import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StateCreator } from 'zustand/vanilla'
import { useChatsStore } from '@/entities/chat'
import { useSessionStore } from '@/entities/session'
import { useChatListStore } from '@/features/load-chats'
import { Sidebar } from './Sidebar'

// Server rendering reads a zustand store's initial state, not its current one. These
// stores render their current state instead, so the markup reflects setState calls.
vi.mock('zustand', async () => {
  const { useSyncExternalStore } = await import('react')
  const { createStore } = await import('zustand/vanilla')
  const createLive = (init: StateCreator<unknown>) => {
    const api = createStore(init)
    const useLive = (selector: (s: unknown) => unknown = (s) => s) =>
      useSyncExternalStore(api.subscribe, () => selector(api.getState()), () => selector(api.getState()))
    return Object.assign(useLive, api)
  }
  return { create: (init?: StateCreator<unknown>) => (init ? createLive(init) : createLive) }
})

const render = () => renderToStaticMarkup(<Sidebar />)

describe('Sidebar chat list states', () => {
  beforeEach(() => {
    useSessionStore.getState().clear()
    useChatsStore.getState().reset()
    useChatListStore.setState({ status: 'idle', error: null })
  })

  it('shows the loading line instead of the empty prompt during the first load', () => {
    useChatListStore.setState({ status: 'loading', error: null })
    const html = render()
    expect(html).toContain('Loading chats')
    expect(html).not.toContain('No chats yet')
  })

  it('shows the empty prompt when the load finished with no chats', () => {
    expect(render()).toContain('No chats yet')
  })

  it('shows the list, not the loading line, when chats exist during a load', () => {
    useChatsStore.getState().apply({ type: 'chatCreated', chatId: '1', title: 'Alice' })
    useChatListStore.setState({ status: 'loading', error: null })
    const html = render()
    expect(html).toContain('Alice')
    expect(html).not.toContain('Loading chats')
  })

  it('shows the error with Retry and keeps the list and the New chat button', () => {
    useChatsStore.getState().apply({ type: 'chatCreated', chatId: '1', title: 'Alice' })
    useChatListStore.setState({ status: 'error', error: 'Cannot connect to GREEN-API.' })
    const html = render()
    expect(html).toContain('Couldn’t load chats. Cannot connect to GREEN-API.')
    expect(html).toContain('Retry')
    expect(html).toContain('Alice')
    expect(html).toContain('New chat')
  })

  it('shows the error and the empty prompt when nothing could be loaded', () => {
    useChatListStore.setState({ status: 'error', error: 'Cannot connect to GREEN-API.' })
    const html = render()
    expect(html).toContain('Retry')
    expect(html).toContain('No chats yet')
  })
})
