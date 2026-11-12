import { contentPreview, formatListTime } from '@/entities/message/@x/chat'
import { useNow } from '@/shared/lib/time'
import type { Chat } from '../model/types'
import { Avatar } from './Avatar'
import styles from './ChatListItem.module.css'

export interface ChatListItemProps {
  chat: Chat
  active: boolean
  onSelect(chatId: string): void
}

export function ChatListItem({ chat, active, onSelect }: ChatListItemProps) {
  const now = useNow()
  const last = chat.messages.at(-1)
  const preview = last ? contentPreview(last.content).replace(/\s+/g, ' ') : ''

  return (
    <button
      type="button"
      className={[styles.item, active && styles.active].filter(Boolean).join(' ')}
      aria-current={active || undefined}
      onClick={() => onSelect(chat.chatId)}
    >
      <Avatar chatId={chat.chatId} title={chat.title} />
      <span className={styles.body}>
        <span className={styles.top}>
          <span className={styles.title}>{chat.title}</span>
          {last && <span className={styles.time}>{formatListTime(last.timestamp, now)}</span>}
        </span>
        <span className={styles.preview}>
          {last?.status === 'failed' && <span className={styles.failed}>Not sent: </span>}
          {last?.direction === 'out' && last.status !== 'failed' && 'You: '}
          {preview || ' '}
        </span>
      </span>
    </button>
  )
}
