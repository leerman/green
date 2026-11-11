import { useSessionStore } from '../model/store'
import styles from './SessionWarnings.module.css'

export function SessionWarnings({ className }: { className?: string }) {
  const warnings = useSessionStore((s) => s.warnings)
  if (warnings.length === 0) return null

  return (
    <ul className={[styles.list, className].filter(Boolean).join(' ')} role="status">
      {warnings.map((w) => (
        <li key={w} className={styles.warning}>
          {w}
        </li>
      ))}
    </ul>
  )
}
