import { describe, expect, it } from 'vitest'
import { safeNext } from '@/lib/security/redirect'

describe('safeNext (open-redirect protection)', () => {
  it.each(['/home', '/discover?fresh=1', '/start?resume=1', '/plan#x'])('allows %s', (p) => expect(safeNext(p)).toBe(p))
  it.each([
    '//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', 'evil.example', '/\u0000x',
    '/%0d%0aSet-Cookie:x', '', null, undefined, '/' + 'a'.repeat(600),
  ])('rejects %s', (p) => {
    const out = safeNext(p as string, '/home')
    expect(out.startsWith('//')).toBe(false)
    expect(['/home', '/%0d%0aSet-Cookie:x']).toContain(out)
  })
})
