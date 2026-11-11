import { ChatHeader, useChatsStore } from '@/entities/chat'
import { MessageInput } from '@/features/send-message'
import styles from './ChatWindow.module.css'
import { MessageList } from './MessageList'

export function ChatWindow() {
  const chat = useChatsStore((s) => (s.activeChatId ? s.chats[s.activeChatId] : undefined))

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
      <MessageList chat={chat} />
      <MessageInput key={chat.chatId} chatId={chat.chatId} />
    </section>
  )
}
