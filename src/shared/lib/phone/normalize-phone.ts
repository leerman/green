export const PHONE_MIN_DIGITS = 7
export const PHONE_MAX_DIGITS = 15

export type NormalizePhoneResult =
  | { ok: true; phone: string }
  | { ok: false; error: 'invalid-length' }

/**
 * Strips everything except digits from an international phone number.
 * No country binding and no prefix rewriting: only the E.164 length (7–15 digits) is checked.
 */
export function normalizePhone(input: string): NormalizePhoneResult {
  const phone = input.replace(/\D/g, '')
  if (phone.length < PHONE_MIN_DIGITS || phone.length > PHONE_MAX_DIGITS) {
    return { ok: false, error: 'invalid-length' }
  }
  return { ok: true, phone }
}
