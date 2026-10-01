import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/database.types'

// Defaults are the public, well-known keys of the local `supabase start` stack.
export const SUPABASE_URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
export const ANON_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
export const SERVICE_ROLE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SUPABASE_URL)) {
  // Integration tests create and delete users. Never point them at a hosted project.
  throw new Error(`Refusing to run integration tests against non-local Supabase: ${SUPABASE_URL}`)
}

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } }

export type TestClient = SupabaseClient<Database>

export function adminClient(): TestClient {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, noPersist)
}

export function anonClient(): TestClient {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, noPersist)
}

export async function isSupabaseUp(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: ANON_KEY } })
    return res.ok
  } catch {
    return false
  }
}

export interface TestUser {
  id: string
  email: string
  client: TestClient
  accessToken: string
}

export async function createTestUser(label: string): Promise<TestUser> {
  const admin = adminClient()
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
  const password = `pw-${Math.random().toString(36).slice(2)}-A1!`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('createUser failed')
  const client = anonClient()
  const { data: session, error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError || !session.session) throw signInError ?? new Error('signIn failed')
  return { id: data.user.id, email, client, accessToken: session.session.access_token }
}

export async function deleteTestUser(user: TestUser | undefined) {
  if (!user) return
  await adminClient().auth.admin.deleteUser(user.id)
}
