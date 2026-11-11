import { useRef, useState, type KeyboardEvent } from 'react'
import { Button, TextArea } from '@/shared/ui'
import { canSend, MAX_MESSAGE_LENGTH, sendMessage } from '../model/send-message'
import styles from './MessageInput.module.css'

const COUNTER_THRESHOLD = MAX_MESSAGE_LENGTH - 500

export function MessageInput({ chatId }: { chatId: string }) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const sendable = canSend(text)

  const submit = () => {
    if (!sendable) return
    void sendMessage(chatId, text)
    setText('')
    ref.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className={styles.composer}>
      <div className={styles.field}>
        <TextArea
          ref={ref}
          autoGrow
          maxHeight={180}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Message"
          aria-label="Message"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={onKeyDown}
          autoFocus
        />
        {text.length >= COUNTER_THRESHOLD && (
          <span className={[styles.counter, text.length >= MAX_MESSAGE_LENGTH && styles.limit].filter(Boolean).join(' ')}>
            {text.length}/{MAX_MESSAGE_LENGTH}
          </span>
        )}
      </div>
      <Button className={styles.send} onClick={submit} disabled={!sendable} aria-label="Send">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" fill="currentColor" />
        </svg>
      </Button>
    </div>
  )
}
