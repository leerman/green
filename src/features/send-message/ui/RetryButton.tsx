import { useState } from 'react'
import { Button } from '@/shared/ui'
import { retry } from '../model/send-message'

export function RetryButton({ chatId, messageId }: { chatId: string; messageId: string }) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant="secondary"
      size="small"
      loading={pending}
      onClick={async () => {
        setPending(true)
        await retry(chatId, messageId)
        setPending(false)
      }}
    >
      Retry
    </Button>
  )
}
