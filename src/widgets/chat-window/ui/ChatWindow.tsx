import { useEffect } from 'react'
import { ChatHeader, useChatsStore } from '@/entities/chat'
import { HistoryStatus, loadHistory } from '@/features/load-chats'
import { MessageInput } from '@/features/send-message'
import styles from './ChatWindow.module.css'
import { MessageList } from './MessageList'

export function ChatWindow() {
  const chat = useChatsStore((s) => (s.activeChatId ? s.chats[s.activeChatId] : undefined))
  const chatId = chat?.chatId

  // Opening a chat loads its history once; reopening after a failure retries. The loader
  // skips chats that are loading or loaded. Keyed on the chat only, so a load finishing
  // or failing does not trigger another.
  useEffect(() => {
    if (chatId) loadHistory(chatId)
  }, [chatId])

  if (!chat) {
    return (
      <section className={styles.window}>
        <div className={styles.placeholder}>
          <p>Select a chat or create a new one</p>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.window} aria-label={`Chat with ${chat.title}`}>
      <ChatHeader chat={chat} />
      <HistoryStatus chatId={chat.chatId} history={chat.history} className={styles.history} />
      <MessageList chat={chat} />
      {chat.type === 'channel' ? (
        <footer className={styles.readOnly}>Read-only channel</footer>
      ) : (
        <MessageInput key={chat.chatId} chatId={chat.chatId} />
      )}
    </section>
  )
}
