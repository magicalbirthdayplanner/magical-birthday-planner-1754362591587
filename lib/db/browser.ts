import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-client'
import type { Database } from './database.types'

/**
 * The app's single browser Supabase client (shared with AuthContext), typed with
 * the generated schema. All queries run as the signed-in user under RLS.
 */
export const db = supabase as unknown as SupabaseClient<Database>

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
