import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // The slice layout from design D1 intentionally has single-consumer slices
    // (each widget belongs to one page, each feature to one widget). This rule
    // would ask to merge them; layer boundaries, public APIs and cross-imports
    // are still enforced by the other rules.
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
])
