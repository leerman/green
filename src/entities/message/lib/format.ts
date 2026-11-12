import type { MessageContent } from '../model/types'

/** Local time as `HH:MM`. */
export function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** One-line preview of the content, e.g. for the chat list. */
export function contentPreview(content: MessageContent): string {
  switch (content.type) {
    case 'text':
      return content.text
  }
}
