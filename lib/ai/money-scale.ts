/**
 * Per-request money scale for AI result validation (lib/ai/schemas/shared.ts `money()`): a party in India gets caps
 * ~100× the US-dollar caps, so a ₹15,000 budget line is not clamped to "10000". SERVER ONLY (AsyncLocalStorage).
 */
import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import { setMoneyScaleProvider } from './schemas/shared'

const store = new AsyncLocalStorage<number>()
setMoneyScaleProvider(() => store.getStore() ?? 1)

export function runWithMoneyScale<T>(scale: number, fn: () => Promise<T>): Promise<T> {
  return store.run(scale > 0 ? scale : 1, fn)
}
