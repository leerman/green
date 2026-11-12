import { useState } from 'react'
import { ChatListItem, useChatsStore } from '@/entities/chat'
import { SessionWarnings, useSessionStore } from '@/entities/session'
import { CreateChatForm } from '@/features/create-chat'
import { ChatListStatus, useChatListStore } from '@/features/load-chats'
import { LogoutButton } from '@/features/logout'
import { ConnectionStatus } from '@/features/receive-notifications'
import { Button } from '@/shared/ui'
import styles from './Sidebar.module.css'

export function Sidebar() {
  const order = useChatsStore((s) => s.order)
  const chats = useChatsStore((s) => s.chats)
  const activeChatId = useChatsStore((s) => s.activeChatId)
  const openChat = useChatsStore((s) => s.openChat)
  const idInstance = useSessionStore((s) => s.idInstance)
  const listLoading = useChatListStore((s) => s.status === 'loading')
  const [creating, setCreating] = useState(false)

  return (
    <aside className={styles.sidebar} aria-label="Chats">
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.heading}>Chats</h1>
          {idInstance && <div className={styles.account}>Instance {idInstance}</div>}
        </div>
        <Button size="small" onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
          New chat
        </Button>
        <LogoutButton />
      </header>

      <div className={styles.notices}>
        <ConnectionStatus />
        <ChatListStatus hasChats={order.length > 0} />
        <SessionWarnings />
      </div>

      {creating && (
        <div className={styles.create}>
          <CreateChatForm onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
        </div>
      )}

      {order.length > 0 && (
        <ul className={styles.list}>
          {order.map((chatId) => (
            <li key={chatId}>
              <ChatListItem chat={chats[chatId]} active={chatId === activeChatId} onSelect={openChat} />
            </li>
          ))}
        </ul>
      )}

      {/* While the first load runs, the loading line in the notices stands in for this prompt. */}
      {order.length === 0 && !listLoading && (
        <div className={styles.empty}>
          <p>No chats yet.</p>
          <p>Start a conversation by entering the recipient's phone number.</p>
          {!creating && <Button onClick={() => setCreating(true)}>New chat</Button>}
        </div>
      )}
    </aside>
  )
}
