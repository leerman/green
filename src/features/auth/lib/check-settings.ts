import type { GetSettingsResponse } from '@/shared/api'

export const WEBHOOK_URL_WARNING =
  'webhookUrl is set in the instance settings. Incoming messages will not arrive until webhookUrl is cleared.'
export const INCOMING_WEBHOOK_WARNING =
  'Incoming notifications are disabled. Set incomingWebhook to "yes" in the instance settings.'
export const SETTINGS_UNAVAILABLE_WARNING =
  'Could not load the instance settings. Make sure webhookUrl is empty and incomingWebhook is enabled.'

/** Returns warnings for settings that prevent receiving messages over the HTTP API. */
export function checkSettings(settings: GetSettingsResponse): string[] {
  const warnings: string[] = []
  if (typeof settings.webhookUrl === 'string' && settings.webhookUrl.trim() !== '') {
    warnings.push(WEBHOOK_URL_WARNING)
  }
  if (settings.incomingWebhook !== 'yes') {
    warnings.push(INCOMING_WEBHOOK_WARNING)
  }
  return warnings
}
