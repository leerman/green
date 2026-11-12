// Used by render tests through `vi.mock('zustand')`. Server rendering reads a zustand
// store's initial state, not its current one; these stores render their current state
// instead, so markup from renderToStaticMarkup reflects setState calls.
import { useSyncExternalStore } from 'react'
import { createStore, type StateCreator } from 'zustand/vanilla'

function createLive(init: StateCreator<unknown>) {
  const api = createStore(init)
  const useLive = (selector: (s: unknown) => unknown = (s) => s) =>
    useSyncExternalStore(api.subscribe, () => selector(api.getState()), () => selector(api.getState()))
  return Object.assign(useLive, api)
}

export const create = (init?: StateCreator<unknown>) => (init ? createLive(init) : createLive)
