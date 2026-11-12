import { describe, expect, it } from 'vitest'
import { normalizePhone } from './normalize-phone'

describe('normalizePhone', () => {
  it.each([
    ['+7 (999) 123-45-67', '79991234567'],
    ['+44 20 7946 0958', '442079460958'],
    ['+375 29 123-45-67', '375291234567'],
    ['1 (212) 555-0100', '12125550100'],
    ['79991234567', '79991234567'],
    ['  +49.30.1234567 ', '49301234567'],
  ])('strips formatting from %j', (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, phone: expected })
  })

  it('does not rewrite prefixes', () => {
    expect(normalizePhone('8 999 123 45 67')).toEqual({ ok: true, phone: '89991234567' })
  })

  it('accepts the 7 and 15 digit boundaries', () => {
    expect(normalizePhone('1234567')).toEqual({ ok: true, phone: '1234567' })
    expect(normalizePhone('123456789012345')).toEqual({ ok: true, phone: '123456789012345' })
  })

  it.each(['123456', '1234567890123456', '', '+', 'abc', '+7 (999)'])(
    'rejects %j as invalid length',
    (input) => {
      expect(normalizePhone(input)).toEqual({ ok: false, error: 'invalid-length' })
    },
  )
})
