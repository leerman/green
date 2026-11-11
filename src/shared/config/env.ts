const DEFAULT_GREEN_API_URL = 'https://api.green-api.com'

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export const env = {
  greenApiUrl: trimTrailingSlash(import.meta.env.VITE_GREEN_API_URL || DEFAULT_GREEN_API_URL),
} as const
