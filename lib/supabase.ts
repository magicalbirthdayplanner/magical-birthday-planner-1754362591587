import { createClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { noStoreFetch } from '@/lib/db/no-store-fetch'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: noStoreFetch } })

// Client-side Supabase client (for components)
export const createClientComponentClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  })
}

// Server-side Supabase client (for server actions and API routes)
export const createServerComponentClient = ({ cookies }: { cookies: any }) => {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: noStoreFetch },
    cookies: {
      get(name: string) {
        try {
          // Handle both function and object cookies
          if (typeof cookies === 'function') {
            return cookies().get(name)?.value
          } else if (cookies && typeof cookies.get === 'function') {
            return cookies.get(name)?.value
          }
          return undefined
        } catch (error) {
          return undefined
        }
      },
      set(name: string, value: string, options: any) {
        try {
          // Handle both function and object cookies
          if (typeof cookies === 'function') {
            cookies().set({ name, value, ...options })
          } else if (cookies && typeof cookies.set === 'function') {
            cookies.set({ name, value, ...options })
          }
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      remove(name: string, options: any) {
        try {
          // Handle both function and object cookies
          if (typeof cookies === 'function') {
            cookies().set({ name, value: '', ...options })
          } else if (cookies && typeof cookies.remove === 'function') {
            cookies.remove(name, options)
          } else if (cookies && typeof cookies.set === 'function') {
            cookies.set({ name, value: '', ...options })
          }
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}