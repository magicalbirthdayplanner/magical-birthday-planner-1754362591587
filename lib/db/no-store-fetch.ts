/**
 * fetch for Supabase clients that bypasses Next.js's data cache. Next 14 patches
 * fetch() in route handlers and can cache GET responses (keyed by headers), which
 * served stale user data (e.g. plan state) and stale shared service-role reads.
 */
export const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })
