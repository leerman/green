import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // TEMPORARY while slices are built bottom-up: a new slice has no consumers
    // until widgets/pages use it. Re-enable in task 5.4 once everything is wired.
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
])
