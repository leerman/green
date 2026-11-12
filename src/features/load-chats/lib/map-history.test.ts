import { describe, expect, it } from 'vitest'
import { mapHistory, mapHistoryItem } from './map-history'

// Shapes recorded on a real MAX instance (task 1.2); texts and names replaced.
const outgoingText = {
  type: 'outgoing',
  idMessage: '117605488356767395',
  timestamp: 1794517339,
  typeMessage: 'textMessage',
  chatId: '127474059',
  chatType: 'user',
  textMessage: 'Hi',
  statusMessage: 'delivered',
  sendByApi: false,
  isEdited: false,
  isDeleted: false,
}
const outgoingLink = {
  type: 'outgoing',
  idMessage: '1794517115022',
  timestamp: 1794517115,
  typeMessage: 'extendedTextMessage',
  chatId: '127474059',
  textMessage: 'see https://example.com',
  extendedTextMessage: { text: 'see https://example.com', description: '', title: '' },
  statusMessage: 'read',
  isDeleted: false,
}
const groupIncoming = {
  type: 'incoming',
  idMessage: '117604424088170454',
  timestamp: 1794501099,
  typeMessage: 'textMessage',
  chatId: '-78456436227580',
  chatType: 'group',
  textMessage: 'hello all',
  senderId: '156353012',
  senderName: 'Kate',
  senderType: 'user',
  senderContactName: '',
  isDeleted: false,
}
const image = { ...groupIncoming, idMessage: 'img', typeMessage: 'imageMessage', textMessage: undefined, caption: 'pic' }
const edited = {
  type: 'incoming',
  idMessage: '1152818795563',
  timestamp: 1794477528,
  typeMessage: 'editedMessage',
  chatId: '-78456436227580',
  senderId: '47451228',
  editedMessageData: { stanzaId: '117602878705329652', textMessage: 'new text' },
}

describe('mapHistoryItem', () => {
  it('maps an outgoing text message as sent, whatever its delivery status', () => {
    expect(mapHistoryItem(outgoingText)).toEqual({
      id: '117605488356767395',
      direction: 'out',
      content: { type: 'text', text: 'Hi' },
      timestamp: 1794517339000,
      status: 'sent',
    })
  })

  it('maps a link preview as text', () => {
    expect(mapHistoryItem(outgoingLink)?.content).toEqual({ type: 'text', text: 'see https://example.com' })
    const onlyPreviewText = { ...outgoingLink, textMessage: undefined }
    expect(mapHistoryItem(onlyPreviewText)?.content).toEqual({ type: 'text', text: 'see https://example.com' })
  })

  it('maps an incoming group message with its sender, skipping an empty contact name', () => {
    expect(mapHistoryItem(groupIncoming)).toEqual({
      id: '117604424088170454',
      direction: 'in',
      content: { type: 'text', text: 'hello all' },
      timestamp: 1794501099000,
      sender: { id: '156353012', name: 'Kate' },
    })
  })

  it('prefers the contact name over the sender name', () => {
    expect(mapHistoryItem({ ...groupIncoming, senderContactName: 'Katya (work)' })?.sender).toEqual({
      id: '156353012',
      name: 'Katya (work)',
    })
  })

  it('keeps a sender without a name', () => {
    expect(mapHistoryItem({ ...groupIncoming, senderName: '' })?.sender).toEqual({ id: '156353012' })
  })

  it('maps an incoming message without senderId without a sender', () => {
    expect(mapHistoryItem({ ...groupIncoming, senderId: undefined })).not.toHaveProperty('sender')
  })

  it.each([
    ['an image', image],
    ['an edit marker', edited],
    ['a reaction', { ...groupIncoming, typeMessage: 'reactionMessage', extendedTextMessageData: { text: '👍' } }],
    ['a deleted message', { ...groupIncoming, isDeleted: true }],
    ['a message without text', { ...groupIncoming, textMessage: '' }],
    ['a message without idMessage', { ...groupIncoming, idMessage: '' }],
    ['a message without timestamp', { ...groupIncoming, timestamp: undefined }],
    ['an unknown direction', { ...groupIncoming, type: 'system' }],
    ['null', null],
    ['a string', 'x'],
  ])('skips %s', (_, item) => {
    expect(mapHistoryItem(item)).toBeNull()
  })
})

describe('mapHistory', () => {
  it('returns text messages oldest first from a newest-first response', () => {
    const response = [
      { ...outgoingText, idMessage: 'c', timestamp: 30 },
      image,
      { ...groupIncoming, idMessage: 'b', timestamp: 20 },
      { ...groupIncoming, idMessage: 'a', timestamp: 10 },
    ]
    expect(mapHistory(response).map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps the server order for equal timestamps', () => {
    const response = [
      { ...groupIncoming, idMessage: 'second', timestamp: 10 },
      { ...groupIncoming, idMessage: 'first', timestamp: 10 },
    ]
    expect(mapHistory(response).map((m) => m.id)).toEqual(['first', 'second'])
  })

  it('returns an empty list for a non-array', () => {
    expect(mapHistory(null)).toEqual([])
    expect(mapHistory({})).toEqual([])
  })
})
