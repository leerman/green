import { useState, type FormEvent } from 'react'
import { Button, TextField } from '@/shared/ui'
import { createChat } from '../model/create-chat'
import styles from './CreateChatForm.module.css'

export interface CreateChatFormProps {
  onDone?(): void
  onCancel?(): void
}

export function CreateChatForm({ onDone, onCancel }: CreateChatFormProps) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    const result = await createChat(phone)
    setPending(false)
    if (result.ok) {
      setPhone('')
      onDone?.()
    } else {
      setError(result.error)
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="New chat">
      <TextField
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+7 999 123-45-67"
        aria-label="Phone number"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel?.()
        }}
        error={error}
        disabled={pending}
        autoFocus
      />
      <div className={styles.actions}>
        {onCancel && (
          <Button variant="secondary" size="small" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="small" loading={pending} disabled={!phone.trim()}>
          Create
        </Button>
      </div>
    </form>
  )
}
