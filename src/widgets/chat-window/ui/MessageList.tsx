import { useLayoutEffect, useRef } from 'react'
import type { Chat } from '@/entities/chat'
import { MessageBubble } from '@/entities/message'
import { RetryButton } from '@/features/send-message'
import styles from './MessageList.module.css'

export function MessageList({ chat }: { chat: Chat }) {
  const endRef = useRef<HTMLDivElement>(null)
  const count = chat.messages.length
  const lastId = chat.messages.at(-1)?.id

  // Scroll when the newest message changes or another chat is opened. Removing
  // a merged local copy elsewhere in the list leaves the newest one unchanged.
  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [chat.chatId, lastId])

  return (
    <div className={styles.list} role="log" aria-live="polite" aria-label={`Messages with ${chat.title}`}>
      {count === 0 ? (
        <p className={styles.empty}>No messages yet</p>
      ) : (
        <>
          <div className={styles.spacer} />
          {chat.messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              actions={
                m.direction === 'out' && m.status === 'failed' ? (
                  <RetryButton chatId={chat.chatId} messageId={m.id} />
                ) : undefined
              }
            />
          ))}
        </>
      )}
      <div ref={endRef} className={styles.end} />
    </div>
  )
}
