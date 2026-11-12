import { useRef, useState, type FormEvent } from 'react'
import { useSessionStore } from '@/entities/session'
import { Button, TextField } from '@/shared/ui'
import { login } from '../model/login'
import styles from './LoginForm.module.css'

type Field = 'idInstance' | 'apiTokenInstance'

export function LoginForm() {
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({})
  const status = useSessionStore((s) => s.status)
  const error = useSessionStore((s) => s.error)
  const idRef = useRef<HTMLInputElement>(null)
  const tokenRef = useRef<HTMLInputElement>(null)
  const checking = status === 'checking'

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (checking) return
    const errors: Partial<Record<Field, string>> = {}
    if (!idInstance.trim()) errors.idInstance = 'Enter idInstance'
    if (!apiTokenInstance.trim()) errors.apiTokenInstance = 'Enter apiTokenInstance'
    setFieldErrors(errors)
    if (errors.idInstance) return idRef.current?.focus()
    if (errors.apiTokenInstance) return tokenRef.current?.focus()
    void login({ idInstance, apiTokenInstance })
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <TextField
        ref={idRef}
        label="idInstance"
        name="idInstance"
        inputMode="numeric"
        autoComplete="username"
        value={idInstance}
        onChange={(e) => {
          setIdInstance(e.target.value)
          setFieldErrors((f) => ({ ...f, idInstance: undefined }))
        }}
        error={fieldErrors.idInstance}
        disabled={checking}
        autoFocus
      />
      <TextField
        ref={tokenRef}
        label="apiTokenInstance"
        name="apiTokenInstance"
        type="password"
        autoComplete="current-password"
        value={apiTokenInstance}
        onChange={(e) => {
          setApiTokenInstance(e.target.value)
          setFieldErrors((f) => ({ ...f, apiTokenInstance: undefined }))
        }}
        error={fieldErrors.apiTokenInstance}
        disabled={checking}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" block loading={checking}>
        {checking ? 'Checking…' : 'Log in'}
      </Button>
    </form>
  )
}
