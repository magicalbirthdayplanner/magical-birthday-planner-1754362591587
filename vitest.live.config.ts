// Opt-in, manual live-model checks (never part of `npm test` / CI). Run: AI_LIVE=1 npx vitest run -c vitest.live.config.ts
import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config'
export default mergeConfig(base, defineConfig({ test: { include: ['tests/live/**/*.test.ts'], testTimeout: 180_000 } }))
