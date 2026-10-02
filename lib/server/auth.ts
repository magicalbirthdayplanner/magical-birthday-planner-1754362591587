/**
 * Request authentication for route handlers. SERVER ONLY.
 *
 * The browser keeps the Supabase session in localStorage, so clients send
 * `Authorization: Bearer <access_token>`. The returned client queries AS THE USER,
 * so Row Level Security applies to everything it touches.
 */
import 'server-only'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/database.types'
import { noStoreFetch } from '@/lib/db/no-store-fetch'

export interface AuthedRequest {
  user: User
  supabase: SupabaseClient<Database>
  accessToken: string
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization') ?? ''
  const m = h.match(/^Bearer\s+([A-Za-z0-9._-]{20,4096})$/)
  return m ? m[1] : null
}

export async function getAuthedRequest(req: Request): Promise<AuthedRequest | null> {
  const token = bearerToken(req)
  if (!token) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  const supabase = createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStoreFetch },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return { user: data.user, supabase, accessToken: token }
}
