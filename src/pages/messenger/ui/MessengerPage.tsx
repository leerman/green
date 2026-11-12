import { ChatWindow } from '@/widgets/chat-window'
import { Sidebar } from '@/widgets/sidebar'
import styles from './MessengerPage.module.css'

export function MessengerPage() {
  return (
    <main className={styles.page}>
      <Sidebar />
      <ChatWindow />
    </main>
  )
}
