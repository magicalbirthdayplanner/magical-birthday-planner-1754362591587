import { createClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client-side Supabase client (for components)
export const createClientComponentClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Server-side Supabase client (for server actions and API routes)
export const createServerComponentClient = ({ cookies }: { cookies: any }) => {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookies().get(name)?.value
      },
      set(name: string, value: string, options: any) {
        try {
          // Set cookies with domain configuration for cross-domain compatibility
          const cookieOptions = {
            ...options,
            domain: process.env.NODE_ENV === 'production' ? '.magicalbirthdayplanner.com' : undefined,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
          }
          cookies().set({ name, value, ...cookieOptions })
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      remove(name: string, options: any) {
        try {
          const cookieOptions = {
            ...options,
            domain: process.env.NODE_ENV === 'production' ? '.magicalbirthdayplanner.com' : undefined,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
          }
          cookies().set({ name, value: '', ...cookieOptions })
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}