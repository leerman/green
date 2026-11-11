import { initials } from '../lib/format-phone'
import styles from './Avatar.module.css'

const PALETTE = ['#2c6bff', '#7b5cff', '#00a884', '#ff7a45', '#e5383b', '#1aa3c2', '#c2410c', '#9b51e0']

function colorFor(key: string): string {
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export function Avatar({ chatId, title, size = 44 }: { chatId: string; title: string; size?: number }) {
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size * 0.38, background: colorFor(chatId) }}
      aria-hidden="true"
    >
      {initials(title)}
    </span>
  )
}
