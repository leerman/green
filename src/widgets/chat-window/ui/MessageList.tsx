import { useLayoutEffect, useRef } from 'react'
import type { Chat } from '@/entities/chat'
import { MessageBubble } from '@/entities/message'
import { RetryButton } from '@/features/send-message'
import styles from './MessageList.module.css'

export function MessageList({ chat }: { chat: Chat }) {
  const endRef = useRef<HTMLDivElement>(null)
  const seen = useRef<{ chatId: string; count: number } | null>(null)
  const count = chat.messages.length

  // Scroll to the newest message when one is added or another chat is opened,
  // but not when the count drops (a local copy merged into its server copy).
  useLayoutEffect(() => {
    const prev = seen.current
    seen.current = { chatId: chat.chatId, count }
    if (prev && prev.chatId === chat.chatId && count <= prev.count) return
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [chat.chatId, count])

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
