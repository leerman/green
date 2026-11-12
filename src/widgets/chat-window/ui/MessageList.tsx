import { Fragment, useLayoutEffect, useRef } from 'react'
import type { Chat } from '@/entities/chat'
import { formatDayLabel, isSameDay, MessageBubble } from '@/entities/message'
import { RetryButton } from '@/features/send-message'
import { useNow } from '@/shared/lib/time'
import styles from './MessageList.module.css'

export function MessageList({ chat }: { chat: Chat }) {
  const endRef = useRef<HTMLDivElement>(null)
  const count = chat.messages.length
  const lastId = chat.messages.at(-1)?.id
  const historyLoaded = chat.history === 'loaded'
  const showSender = chat.type === 'group'
  const now = useNow()

  // Scroll when the newest message changes, another chat is opened, or the history
  // arrives (it may only add older messages). Removing a merged local copy elsewhere
  // in the list leaves the newest one unchanged.
  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [chat.chatId, lastId, historyLoaded])

  return (
    <div className={styles.list} role="log" aria-live="polite" aria-label={`Messages with ${chat.title}`}>
      {count === 0 ? (
        chat.history !== 'loading' && <p className={styles.empty}>No messages yet</p>
      ) : (
        <>
          <div className={styles.spacer} />
          {chat.messages.map((m, i) => {
            // Separators are derived from the sorted messages on every render, never stored.
            const prev = chat.messages[i - 1]
            const newDay = !prev || !isSameDay(prev.timestamp, m.timestamp)
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className={styles.day} role="separator">
                    <span>{formatDayLabel(m.timestamp, now)}</span>
                  </div>
                )}
                <MessageBubble
                  message={m}
                  showSender={showSender}
                  actions={
                    m.direction === 'out' && m.status === 'failed' ? (
                      <RetryButton chatId={chat.chatId} messageId={m.id} />
                    ) : undefined
                  }
                />
              </Fragment>
            )
          })}
        </>
      )}
      <div ref={endRef} className={styles.end} />
    </div>
  )
}
