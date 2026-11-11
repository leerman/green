/** Delays between failed polling attempts: 1, 2, 5, 10, 10, … seconds. */
export const BACKOFF_STEPS_MS = [1000, 2000, 5000, 10000] as const

export interface Backoff {
  /** Number of consecutive failures recorded with `next()`. */
  readonly attempts: number
  /** Records a failure and returns the delay before the next attempt. */
  next(): number
  reset(): void
}

export function createBackoff(steps: readonly number[] = BACKOFF_STEPS_MS): Backoff {
  let attempts = 0
  return {
    get attempts() {
      return attempts
    },
    next() {
      const delay = steps[Math.min(attempts, steps.length - 1)]
      attempts++
      return delay
    },
    reset() {
      attempts = 0
    },
  }
}
