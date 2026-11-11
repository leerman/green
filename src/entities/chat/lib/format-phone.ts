export function formatPhone(phone: string): string {
  return `+${phone}`
}

export function initials(title: string): string {
  const letters = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0] ?? '')
    .join('')
  return letters.toUpperCase() || '?'
}
