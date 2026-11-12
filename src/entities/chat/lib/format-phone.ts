export function formatPhone(phone: string): string {
  return `+${phone}`
}

export function initials(title: string): string {
  const letters = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w].find((ch) => /[\p{L}\p{N}]/u.test(ch)) ?? '')
    .join('')
  return letters.toUpperCase() || '?'
}
