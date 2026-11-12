import type { HistoryState } from '@/entities/chat'
import { Button, Spinner } from '@/shared/ui'
import { loadHistory } from '../model/history'
import styles from './LoadStatus.module.css'

export interface HistoryStatusProps {
  chatId: string
  history: HistoryState
  className?: string
}

/** History load state for the chat window: loading line or error with Retry. */
export function HistoryStatus({ chatId, history, className }: HistoryStatusProps) {
  if (history === 'loading') {
    return (
      <div className={[styles.status, className].filter(Boolean).join(' ')} role="status">
        <Spinner size={14} label="Loading" />
        Loading history…
      </div>
    )
  }

  if (history === 'error') {
    return (
      <div className={[styles.status, styles.error, className].filter(Boolean).join(' ')} role="alert">
        <span className={styles.message}>Couldn’t load the chat history.</span>
        <Button variant="secondary" size="small" onClick={() => loadHistory(chatId)}>
          Retry
        </Button>
      </div>
    )
  }

  return null
}
