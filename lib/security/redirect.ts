/**
 * Same-origin, relative redirect targets only. Blocks protocol-relative (//evil),
 * backslash tricks (/\evil), schemes (javascript:, https:) and control characters.
 */
export function safeNext(raw: string | null | undefined, fallback = '/home'): string {
  if (!raw || typeof raw !== 'string' || raw.length > 512) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback
  try {
    // Must resolve to the same origin.
    const u = new URL(raw, 'https://same-origin.invalid')
    if (u.origin !== 'https://same-origin.invalid') return fallback
    return u.pathname + u.search + u.hash
  } catch {
    return fallback
  }
}
