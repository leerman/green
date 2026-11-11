import { useSessionStore } from '@/entities/session'
import { Spinner } from '@/shared/ui'
import styles from './ConnectionStatus.module.css'

/** Shown only while the notification queue cannot be reached. */
export function ConnectionStatus({ className }: { className?: string }) {
  const connection = useSessionStore((s) => s.connection)
  if (connection === 'online') return null
  return (
    <div className={[styles.status, className].filter(Boolean).join(' ')} role="status">
      <Spinner size={14} label="Reconnecting" />
      Connection lost. Reconnecting…
    </div>
  )
}
