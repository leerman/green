import type { GetSettingsResponse } from '@/shared/api'

export const WEBHOOK_URL_WARNING =
  'webhookUrl is set in the instance settings. Incoming messages will not arrive until webhookUrl is cleared.'
export const INCOMING_WEBHOOK_WARNING =
  'Incoming notifications are disabled. Set incomingWebhook to "yes" in the instance settings.'
export const SETTINGS_UNAVAILABLE_WARNING =
  'Could not load the instance settings. Make sure webhookUrl is empty and incomingWebhook is enabled.'

const OUTGOING_SETTINGS = ['outgoingMessageWebhook', 'outgoingAPIMessageWebhook'] as const

export function outgoingWebhookWarning(disabled: readonly string[]): string {
  return `Outgoing message notifications are disabled (${disabled.join(', ')}). Set them to "yes" to see messages you send from your phone.`
}

/** Returns warnings for settings that prevent receiving messages over the HTTP API. */
export function checkSettings(settings: GetSettingsResponse): string[] {
  const warnings: string[] = []
  if (typeof settings.webhookUrl === 'string' && settings.webhookUrl.trim() !== '') {
    warnings.push(WEBHOOK_URL_WARNING)
  }
  if (settings.incomingWebhook !== 'yes') {
    warnings.push(INCOMING_WEBHOOK_WARNING)
  }
  const disabledOutgoing = OUTGOING_SETTINGS.filter((key) => settings[key] !== 'yes')
  if (disabledOutgoing.length > 0) {
    warnings.push(outgoingWebhookWarning(disabledOutgoing))
  }
  return warnings
}
