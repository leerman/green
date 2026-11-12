import { describe, expect, it } from 'vitest'
import { LOGIN_CLOCK_SKEW_S, mapNotification } from './map-notification'

const LOGIN_AT = 1_700_000_000_000
const TS = LOGIN_AT / 1000 + 5

function incoming(overrides: Record<string, unknown> = {}) {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 1101, wid: '79990000000@c.us', typeInstance: 'max' },
    timestamp: TS,
    idMessage: 'IN1',
    senderData: {
      chatId: '10000001',
      chatName: 'Chat name',
      sender: '10000001',
      senderName: 'Sender name',
      senderContactName: 'Contact name',
      senderPhoneNumber: 79991234567,
    },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'hello' } },
    ...overrides,
  }
}

function outgoing(typeWebhook: string, messageData: Record<string, unknown> = { typeMessage: 'textMessage', textMessageData: { textMessage: 'hi' } }) {
  return {
    typeWebhook,
    timestamp: TS,
    idMessage: 'OUT1',
    senderData: { chatId: '10000001', sender: '79990000000@c.us', chatName: 'Alice' },
    messageData,
  }
}

describe('mapNotification', () => {
  it('maps incomingMessageReceived', () => {
    expect(mapNotification(incoming(), LOGIN_AT)).toEqual({
      type: 'incomingReceived',
      chatId: '10000001',
      idMessage: 'IN1',
      text: 'hello',
      ts: TS * 1000,
      title: 'Contact name',
      phone: '79991234567',
    })
  })

  it('falls back through contact name, sender name, chat name, chatId', () => {
    const sd = (o: Record<string, unknown>) => incoming({ senderData: { chatId: '10000001', ...o } })
    expect(mapNotification(sd({ senderName: 'S', chatName: 'C' }), LOGIN_AT)).toMatchObject({ title: 'S' })
    expect(mapNotification(sd({ senderContactName: '', senderName: '', chatName: 'C' }), LOGIN_AT)).toMatchObject({ title: 'C' })
    expect(mapNotification(sd({}), LOGIN_AT)).toMatchObject({ title: '10000001' })
  })

  it('omits the phone when the notification has none', () => {
    const ev = mapNotification(incoming({ senderData: { chatId: '10000001' } }), LOGIN_AT)
    expect(ev).not.toHaveProperty('phone')
  })

  it('drops a phone that is not a valid number', () => {
    const ev = mapNotification(incoming({ senderData: { chatId: '1', senderPhoneNumber: 123 } }), LOGIN_AT)
    expect(ev).not.toHaveProperty('phone')
  })

  it('accepts a phone sent as a string', () => {
    const ev = mapNotification(incoming({ senderData: { chatId: '1', senderPhoneNumber: '+375291234567' } }), LOGIN_AT)
    expect(ev).toMatchObject({ phone: '375291234567' })
  })

  it.each(['outgoingAPIMessageReceived', 'outgoingMessageReceived'])('maps %s to outgoingReceived', (type) => {
    expect(mapNotification(outgoing(type), LOGIN_AT)).toEqual({
      type: 'outgoingReceived',
      chatId: '10000001',
      idMessage: 'OUT1',
      text: 'hi',
      ts: TS * 1000,
      title: 'Alice',
    })
  })

  it('titles an outgoing chat with chatId when there is no chat name', () => {
    const body = { ...outgoing('outgoingMessageReceived'), senderData: { chatId: '10000001', sender: '79990000000@c.us' } }
    expect(mapNotification(body, LOGIN_AT)).toMatchObject({ type: 'outgoingReceived', title: '10000001' })
  })

  it.each(['outgoingMessageReceived', 'incomingMessageReceived'])('accepts extendedTextMessage in %s', (type) => {
    const body =
      type === 'incomingMessageReceived'
        ? incoming({ messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'see https://x.y' } } })
        : outgoing(type, { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'see https://x.y' } })
    expect(mapNotification(body, LOGIN_AT)).toMatchObject({ text: 'see https://x.y' })
  })

  it('reads the text from extendedTextMessageData as a fallback', () => {
    const ev = mapNotification(
      outgoing('outgoingMessageReceived', { typeMessage: 'textMessage', extendedTextMessageData: { text: 'ext' } }),
      LOGIN_AT,
    )
    expect(ev).toMatchObject({ type: 'outgoingReceived', text: 'ext' })
  })

  it.each(['stateInstanceChanged', 'outgoingMessageStatus', 'deviceInfo', 'incomingCall', undefined])(
    'ignores webhook type %s',
    (typeWebhook) => {
      expect(mapNotification(incoming({ typeWebhook }), LOGIN_AT)).toBeNull()
    },
  )

  it('ignores a group chat', () => {
    expect(mapNotification(incoming({ senderData: { chatId: '-100200300', senderName: 'G' } }), LOGIN_AT)).toBeNull()
  })

  it('ignores notifications from before login, beyond the clock-skew margin', () => {
    const loginSec = LOGIN_AT / 1000
    expect(mapNotification(incoming({ timestamp: loginSec - LOGIN_CLOCK_SKEW_S - 1 }), LOGIN_AT)).toBeNull()
    expect(mapNotification(outgoing('outgoingMessageReceived'), (TS + LOGIN_CLOCK_SKEW_S + 1) * 1000)).toBeNull()
    expect(mapNotification(incoming({ timestamp: loginSec - 3600 }), LOGIN_AT)).toBeNull()
  })

  it('accepts a message from the login second even though the timestamp is truncated', () => {
    // loginAt = 12:00:00.700, message at server 12:00:00.900 -> timestamp 12:00:00
    expect(mapNotification(incoming({ timestamp: LOGIN_AT / 1000 }), LOGIN_AT + 700)).not.toBeNull()
  })

  it('accepts a post-login message when the client clock runs ahead of the server', () => {
    const clientAheadBy = 10
    expect(mapNotification(incoming({ timestamp: LOGIN_AT / 1000 - clientAheadBy + 2 }), LOGIN_AT)).not.toBeNull()
  })

  it.each([
    ['imageMessage', { typeMessage: 'imageMessage', downloadUrl: 'x' }],
    ['no typeMessage', { textMessageData: { textMessage: 'x' } }],
    ['textMessage without text', { typeMessage: 'textMessage' }],
    ['empty text', { typeMessage: 'textMessage', textMessageData: { textMessage: '' } }],
  ])('ignores non-text or empty content: %s', (_, messageData) => {
    expect(mapNotification(incoming({ messageData }), LOGIN_AT)).toBeNull()
  })

  it.each<[string, unknown]>([
    ['null', null],
    ['string', 'oops'],
    ['number', 42],
    ['empty object', {}],
    ['no timestamp', incoming({ timestamp: undefined })],
    ['string timestamp', incoming({ timestamp: '123' })],
    ['no senderData', incoming({ senderData: undefined })],
    ['no chatId', incoming({ senderData: { senderName: 'x' } })],
    ['numeric chatId', incoming({ senderData: { chatId: 123 } })],
    ['no idMessage', incoming({ idMessage: undefined })],
    ['no messageData', incoming({ messageData: undefined })],
    ['messageData is a string', incoming({ messageData: 'x' })],
  ])('ignores a broken format: %s', (_, body) => {
    expect(mapNotification(body, LOGIN_AT)).toBeNull()
  })
})
