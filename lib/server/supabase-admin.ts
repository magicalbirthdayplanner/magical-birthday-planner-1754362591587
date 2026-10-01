/**
 * Service-role Supabase client. SERVER ONLY. Bypasses RLS — use exclusively for
 * shared, non-user data (venue catalogue, discovery cache, analytics ingestion).
 * Never use it to read or write a user's party, guests, or saved venues.
 */
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/database.types'

let admin: SupabaseClient<Database> | null = null

export function hasServiceRole(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase service role is not configured')
    admin = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return admin
}
