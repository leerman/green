import { describe, expect, it } from 'vitest'
import type { GetSettingsResponse } from '@/shared/api'
import { checkSettings, INCOMING_WEBHOOK_WARNING, outgoingWebhookWarning, WEBHOOK_URL_WARNING } from './check-settings'

const ok: GetSettingsResponse = {
  webhookUrl: '',
  incomingWebhook: 'yes',
  outgoingMessageWebhook: 'yes',
  outgoingAPIMessageWebhook: 'yes',
}

describe('checkSettings', () => {
  it('returns no warnings for correct settings', () => {
    expect(checkSettings(ok)).toEqual([])
  })

  it('warns when webhookUrl is set', () => {
    expect(checkSettings({ ...ok, webhookUrl: 'https://example.com/hook' })).toEqual([WEBHOOK_URL_WARNING])
  })

  it('warns when incoming notifications are disabled or missing', () => {
    expect(checkSettings({ ...ok, incomingWebhook: 'no' })).toEqual([INCOMING_WEBHOOK_WARNING])
    const { incomingWebhook: _, ...withoutIncoming } = ok
    expect(checkSettings(withoutIncoming)).toEqual([INCOMING_WEBHOOK_WARNING])
  })

  it('names each disabled outgoing setting in one warning', () => {
    expect(checkSettings({ ...ok, outgoingMessageWebhook: 'no' })).toEqual([
      outgoingWebhookWarning(['outgoingMessageWebhook']),
    ])
    expect(checkSettings({ ...ok, outgoingAPIMessageWebhook: 'no' })).toEqual([
      outgoingWebhookWarning(['outgoingAPIMessageWebhook']),
    ])
    const [warning] = checkSettings({ ...ok, outgoingMessageWebhook: 'no', outgoingAPIMessageWebhook: 'no' })
    expect(warning).toContain('outgoingMessageWebhook, outgoingAPIMessageWebhook')
    expect(warning).toContain('phone')
  })

  it('returns all warnings together', () => {
    expect(checkSettings({ webhookUrl: 'x', incomingWebhook: 'no' })).toEqual([
      WEBHOOK_URL_WARNING,
      INCOMING_WEBHOOK_WARNING,
      outgoingWebhookWarning(['outgoingMessageWebhook', 'outgoingAPIMessageWebhook']),
    ])
  })
})
