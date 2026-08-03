//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      '.vercel/**',
      '.tanstack/**',
      '.nitro/**',
      'dist/**',
      'dist-ssr/**',
      '.output/**',
      'node_modules/**',
      'src/routeTree.gen.ts',
      // Agent-skill folders vendor JS/TS assets (test corpora, minified libs)
      // that are not part of the app and don't parse under this config.
      '.claude/**',
      '.codex/**',
      '.cursor/**',
      '.agents/**',
      'agent/**',
      'demo-output/**',
    ],
  },
]
