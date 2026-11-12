import { Button, Spinner } from '@/shared/ui'
import { chatListLoader, useChatListStore } from '../model/chat-list'
import styles from './LoadStatus.module.css'

export interface ChatListStatusProps {
  /** The loading line is shown only while the list is still empty. */
  hasChats: boolean
  className?: string
}

/** Chat list load state for the sidebar: loading line or error with Retry. */
export function ChatListStatus({ hasChats, className }: ChatListStatusProps) {
  const { status, error } = useChatListStore()

  if (status === 'loading' && !hasChats) {
    return (
      <div className={[styles.status, className].filter(Boolean).join(' ')} role="status">
        <Spinner size={14} label="Loading" />
        Loading chats…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={[styles.status, styles.error, className].filter(Boolean).join(' ')} role="alert">
        <span className={styles.message}>Couldn’t load chats. {error}</span>
        <Button variant="secondary" size="small" onClick={() => chatListLoader.retry()}>
          Retry
        </Button>
      </div>
    )
  }

  return null
}
