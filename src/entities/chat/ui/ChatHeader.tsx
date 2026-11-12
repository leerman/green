import { formatPhone } from '../lib/format-phone'
import type { Chat } from '../model/types'
import { Avatar } from './Avatar'
import styles from './ChatHeader.module.css'

export function ChatHeader({ chat }: { chat: Chat }) {
  return (
    <header className={styles.header}>
      <Avatar chatId={chat.chatId} title={chat.title} size={40} />
      <div className={styles.info}>
        <span className={styles.title}>{chat.title}</span>
        <span className={styles.subtitle}>{chat.phone ? formatPhone(chat.phone) : `ID ${chat.chatId}`}</span>
      </div>
    </header>
  )
}
