import { describe, expect, it } from 'vitest'
import { mapChats, mapChatsItem } from './map-chats'

describe('mapChatsItem', () => {
  it('maps a personal chat with phone and a text latest message', () => {
    expect(
      mapChatsItem({
        chatId: '32538905',
        name: 'Andrew',
        type: 'user',
        phoneNumber: 79991234567,
        unreadCount: 0,
        lastMessage: {
          type: 'incoming',
          idMessage: 'm1',
          timestamp: 100,
          typeMessage: 'textMessage',
          textMessage: 'hi',
          senderId: '32538905',
          senderName: 'Andrew',
          senderContactName: '',
        },
      }),
    ).toEqual({
      chatId: '32538905',
      title: 'Andrew',
      chatType: 'user',
      phone: '79991234567',
      lastMessage: {
        id: 'm1',
        direction: 'in',
        content: { type: 'text', text: 'hi' },
        timestamp: 100000,
        sender: { id: '32538905', name: 'Andrew' },
      },
    })
  })

  it('treats phone 0 as no phone', () => {
    expect(mapChatsItem({ chatId: '127474059', name: 'Hidden', type: 'user', phoneNumber: 0 })).not.toHaveProperty('phone')
    expect(mapChatsItem({ chatId: '-1', name: 'Team', type: 'group', phoneNumber: '0' })).not.toHaveProperty('phone')
  })

  it('normalizes a phone given as a string', () => {
    expect(mapChatsItem({ chatId: '1', type: 'user', phoneNumber: '+7 999 123-45-67' })?.phone).toBe('79991234567')
  })

  it('drops a latest message that is not text', () => {
    const item = {
      chatId: '-692',
      name: 'News',
      type: 'channel',
      lastMessage: { type: 'incoming', idMessage: 'i', timestamp: 1, typeMessage: 'imageMessage' },
    }
    expect(mapChatsItem(item)).toEqual({ chatId: '-692', title: 'News', chatType: 'channel' })
  })

  it('falls back to the chatId for an empty name', () => {
    expect(mapChatsItem({ chatId: '543835', name: '', type: 'bot' })?.title).toBe('543835')
  })

  it('maps an unknown type to user', () => {
    expect(mapChatsItem({ chatId: '5', type: 'something' })?.chatType).toBe('user')
    expect(mapChatsItem({ chatId: '5' })?.chatType).toBe('user')
  })

  it('skips an item without chatId', () => {
    expect(mapChatsItem({ name: 'x' })).toBeNull()
    expect(mapChatsItem(null)).toBeNull()
  })
})

describe('mapChats', () => {
  it('keeps the server order and skips broken items', () => {
    const result = mapChats([{ chatId: '2', type: 'user' }, { name: 'broken' }, { chatId: '-1', type: 'group' }])
    expect(result.map((c) => c.chatId)).toEqual(['2', '-1'])
  })

  it('returns an empty list for a non-array', () => {
    expect(mapChats(null)).toEqual([])
  })
})
