import { useEffect, useState } from 'react'

/** Milliseconds until the next local midnight after `now`. */
export function msUntilNextMidnight(now: number): number {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - now
}

/**
 * Current time for date labels ("Today", "Yesterday"). It is read once and refreshed
 * at each local midnight, so labels stay stable between renders and still roll over.
 */
export function useNow(): number {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    // A small margin so the timer never fires just before midnight.
    const timer = setTimeout(() => setNow(Date.now()), msUntilNextMidnight(now) + 1000)
    return () => clearTimeout(timer)
  }, [now])

  return now
}
