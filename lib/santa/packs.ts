/**
 * Santa time (isomorphic). One product: 3 minutes with Santa for $4.99. Top-ups buy the same product again
 * (quantity 1–3 → 3, 6 or 9 minutes). Prices here are display defaults; the server charges via the Dodo product and
 * checks the paid amount against DODO_PRICE_<PACK>_CENTS × quantity.
 */
export const SANTA_PACKS = {
  SANTA_TIME: { seconds: 180, priceCents: 499, name: '3 minutes with Santa', blurb: 'A live, personal video call' },
} as const

export type SantaPack = keyof typeof SANTA_PACKS
export const SANTA_PACK: SantaPack = 'SANTA_TIME'
export const TOPUP_QUANTITIES = [1, 2, 3] as const
export const MAX_QUANTITY = 3

export const isSantaPack = (x: unknown): x is SantaPack => typeof x === 'string' && x in SANTA_PACKS
export const priceLabel = (cents: number) => `$${(cents / 100).toFixed(2)}`
export const minutesLabel = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s} seconds`
  return s >= 30 ? `${m}½ minutes` : `${m} minute${m === 1 ? '' : 's'}`
}
