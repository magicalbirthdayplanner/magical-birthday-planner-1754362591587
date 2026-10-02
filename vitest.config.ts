import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  // Same JSX runtime as Next.js (components don't import React).
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    // Integration tests talk to the local Supabase stack and share it.
    fileParallelism: false,
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['lib/discovery/**', 'lib/google/**', 'lib/geo/**', 'lib/planning/**', 'lib/security/**', 'lib/analytics/**'],
    },
  },
})
