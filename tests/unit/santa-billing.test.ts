import { describe, expect, it, vi } from 'vitest'
import { santaPackForProduct, santaPriceCents, santaProductId, processSantaEvent } from '@/lib/santa/billing'
import { minutesLabel, SANTA_PACKS, TOPUP_QUANTITIES } from '@/lib/santa/packs'

const env = { DODO_PRODUCT_SANTA_TIME: 'pdt_santaTime01' }

describe('Santa pricing', () => {
  it('is $4.99 for 3 minutes; top-ups buy 3, 6 or 9 minutes', () => {
    expect(SANTA_PACKS.SANTA_TIME).toMatchObject({ seconds: 180, priceCents: 499 })
    expect([...TOPUP_QUANTITIES]).toEqual([1, 2, 3])
  })

  it('labels time in friendly minutes', () => {
    expect(minutesLabel(180)).toBe('3 minutes')
    expect(minutesLabel(60)).toBe('1 minute')
    expect(minutesLabel(110)).toBe('1½ minutes')
    expect(minutesLabel(40)).toBe('40 seconds')
  })

  it('maps the product id from server config only', () => {
    expect(santaProductId('SANTA_TIME', env)).toBe('pdt_santaTime01')
    expect(santaPackForProduct('pdt_santaTime01', env)).toBe('SANTA_TIME')
    expect(santaPackForProduct('pdt_e2eStarter01', env)).toBeNull()
    expect(santaProductId('SANTA_TIME', { DODO_PRODUCT_SANTA_TIME: 'not a product' })).toBeNull()
  })

  it('price can be overridden by env, else the default', () => {
    expect(santaPriceCents('SANTA_TIME', {})).toBe(499)
    expect(santaPriceCents('SANTA_TIME', { DODO_PRICE_SANTA_TIME_CENTS: '599' })).toBe(599)
  })
})

describe('Santa webhook routing', () => {
  const admin = () => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'update', 'insert', 'delete', 'upsert', 'neq', 'single']) q[m] = vi.fn(() => q)
    q.maybeSingle = vi.fn(async () => ({ data: null }))
    q.then = (r: (v: unknown) => unknown) => r({ data: null, error: null })
    return { from: vi.fn(() => q) } as never
  }

  it('leaves birthday-plan payments to the existing billing path', async () => {
    const e = { type: 'payment.succeeded', data: { payment_id: 'pay_1', product_cart: [{ product_id: 'pdt_e2eStarter01' }] } }
    expect(await processSantaEvent(admin(), 'evt', e, env)).toBeNull()
  })

  it('leaves refunds of non-Santa payments to the existing billing path', async () => {
    expect(await processSantaEvent(admin(), 'evt', { type: 'refund.succeeded', data: { payment_id: 'pay_x' } }, env)).toBeNull()
  })

  it('a Santa payment without our checkout reference unlocks nothing', async () => {
    const e = { type: 'payment.succeeded', data: { payment_id: 'pay_2', total_amount: 499, currency: 'USD', product_cart: [{ product_id: 'pdt_santaTime01', quantity: 1 }], metadata: {} } }
    expect(await processSantaEvent(admin(), 'evt', e, env)).toMatchObject({ status: 'unmatched', detail: 'santa_no_checkout' })
  })
})
