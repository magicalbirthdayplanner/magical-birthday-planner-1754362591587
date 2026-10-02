'use client'
import { supabase } from '@/lib/supabase-client'

/** fetch() that sends the signed-in user's access token (routes check it with getAuthedRequest). */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`)
  return fetch(input, { ...init, headers })
}
