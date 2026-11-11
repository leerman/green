import { Button } from '@/shared/ui'
import { retry } from '../model/send-message'

/** Retry sets the message back to `sending`, which removes this button; no local loading state is needed. */
export function RetryButton({ chatId, messageId }: { chatId: string; messageId: string }) {
  return (
    <Button variant="secondary" size="small" onClick={() => void retry(chatId, messageId)}>
      Retry
    </Button>
  )
}
