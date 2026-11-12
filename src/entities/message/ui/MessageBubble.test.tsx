import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Message } from '../model/types'
import { MessageBubble } from './MessageBubble'

const incoming: Message = {
  id: 'm1',
  direction: 'in',
  content: { type: 'text', text: 'hello' },
  timestamp: 0,
  sender: { id: '555', name: 'Bob' },
}

describe('MessageBubble sender name', () => {
  it('shows the sender of an incoming message when asked', () => {
    expect(renderToStaticMarkup(<MessageBubble message={incoming} showSender />)).toContain('>Bob<')
  })

  it('hides the sender by default (personal chats)', () => {
    expect(renderToStaticMarkup(<MessageBubble message={incoming} />)).not.toContain('Bob')
  })

  it('shows no name when the sender has none', () => {
    const anonymous = { ...incoming, sender: { id: '555' } }
    expect(renderToStaticMarkup(<MessageBubble message={anonymous} showSender />)).not.toMatch(/class="[^"]*sender/)
  })

  it('never shows a sender on outgoing messages', () => {
    const out: Message = { ...incoming, direction: 'out', status: 'sent' }
    expect(renderToStaticMarkup(<MessageBubble message={out} showSender />)).not.toContain('Bob')
  })
})
