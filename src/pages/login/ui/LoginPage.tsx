import { LoginForm } from '@/features/auth'
import styles from './LoginPage.module.css'

export function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo} aria-hidden="true">
          M
        </div>
        <h1 className={styles.title}>MAX Chat</h1>
        <p className={styles.subtitle}>Log in with your GREEN-API instance credentials</p>
        <LoginForm />
      </div>
    </main>
  )
}
