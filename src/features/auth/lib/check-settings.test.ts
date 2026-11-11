import { describe, expect, it } from 'vitest'
import { checkSettings, INCOMING_WEBHOOK_WARNING, WEBHOOK_URL_WARNING } from './check-settings'

describe('checkSettings', () => {
  it('returns no warnings for correct settings', () => {
    expect(checkSettings({ webhookUrl: '', incomingWebhook: 'yes' })).toEqual([])
  })

  it('warns when webhookUrl is set', () => {
    expect(checkSettings({ webhookUrl: 'https://example.com/hook', incomingWebhook: 'yes' })).toEqual([
      WEBHOOK_URL_WARNING,
    ])
  })

  it('warns when incoming notifications are disabled or missing', () => {
    expect(checkSettings({ webhookUrl: '', incomingWebhook: 'no' })).toEqual([INCOMING_WEBHOOK_WARNING])
    expect(checkSettings({ webhookUrl: '' })).toEqual([INCOMING_WEBHOOK_WARNING])
  })

  it('returns both warnings', () => {
    expect(checkSettings({ webhookUrl: 'x', incomingWebhook: 'no' })).toEqual([
      WEBHOOK_URL_WARNING,
      INCOMING_WEBHOOK_WARNING,
    ])
  })
})
