import { useEffect } from 'react'
import { useSessionStore } from '@/entities/session'
import { LoginPage } from '@/pages/login'
import { MessengerPage } from '@/pages/messenger'
import { initSessionLifecycle } from './model/session-lifecycle'

export function App() {
  const ready = useSessionStore((s) => s.status === 'ready')

  // Starts/stops the poller and clears chats in reaction to session changes.
  useEffect(() => initSessionLifecycle(), [])

  return ready ? <MessengerPage /> : <LoginPage />
}
