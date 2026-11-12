import type { ReactNode } from 'react'
import { formatTime } from '../lib/format'
import type { Message, MessageContent, MessageStatus } from '../model/types'
import styles from './MessageBubble.module.css'

export interface MessageBubbleProps {
  message: Message
  /** Slot for actions supplied by features (e.g. retry). */
  actions?: ReactNode
}

function Content({ content }: { content: MessageContent }) {
  switch (content.type) {
    case 'text':
      return <div className={styles.text}>{content.text}</div>
  }
}

const STATUS_LABEL: Record<MessageStatus, string> = {
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Not sent',
}

function StatusIcon({ status }: { status: MessageStatus }) {
  if (status === 'failed') {
    return (
      <span className={styles.failedIcon} aria-hidden="true">
        !
      </span>
    )
  }
  if (status === 'sending') {
    return (
      <svg className={styles.status} viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg className={styles.status} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MessageBubble({ message, actions }: MessageBubbleProps) {
  const { direction, status } = message
  const rowClass = [styles.row, styles[direction], status === 'failed' && styles.failed]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rowClass} data-message-id={message.id}>
      <div className={styles.bubble}>
        <Content content={message.content} />
        <div className={styles.meta}>
          {status === 'failed' && <span className={styles.failedLabel}>Not sent</span>}
          <time dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time>
          {direction === 'out' && status && (
            <span role="img" aria-label={STATUS_LABEL[status]} title={STATUS_LABEL[status]}>
              <StatusIcon status={status} />
            </span>
          )}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  )
}
