import { createClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Environment validation
const requiredEnvVars = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

// Validate environment variables
Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

// Type definitions for database schema
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          current_plan: 'FREE' | 'STARTER' | 'PROFESSIONAL';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          current_plan?: 'FREE' | 'STARTER' | 'PROFESSIONAL';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          current_plan?: 'FREE' | 'STARTER' | 'PROFESSIONAL';
          created_at?: string;
          updated_at?: string;
        };
      };
      parties: {
        Row: {
          id: string;
          user_id: string;
          child_name: string;
          child_age: number;
          child_gender: string | null;
          party_date: string;
          party_time: string | null;
          party_location: string | null;
          zip_code: string | null;
          guest_count: number;
          budget: number | null;
          theme: string | null;
          colors: string[] | null;
          venue_type: string | null;
          status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
          is_shared: boolean;
          share_token: string | null;
          shared_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          child_name: string;
          child_age: number;
          child_gender?: string | null;
          party_date: string;
          party_time?: string | null;
          party_location?: string | null;
          zip_code?: string | null;
          guest_count?: number;
          budget?: number | null;
          theme?: string | null;
          colors?: string[] | null;
          venue_type?: string | null;
          status?: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
          is_shared?: boolean;
          share_token?: string | null;
          shared_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          child_name?: string;
          child_age?: number;
          child_gender?: string | null;
          party_date?: string;
          party_time?: string | null;
          party_location?: string | null;
          zip_code?: string | null;
          guest_count?: number;
          budget?: number | null;
          theme?: string | null;
          colors?: string[] | null;
          venue_type?: string | null;
          status?: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
          is_shared?: boolean;
          share_token?: string | null;
          shared_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      activities: {
        Row: {
          id: string;
          name: string;
          description: string;
          full_description: string | null;
          supplies_needed: string[];
          setup_time: number;
          helpers_required: number;
          step_by_step_instructions: string;
          host_script: string | null;
          age_group: string[];
          venue_type: string[];
          duration: string;
          duration_minutes: number;
          theme_compatibility: string[];
          effort_level: string;
          participant_range: string;
          min_participants: number;
          max_participants: number | null;
          category: string;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          full_description?: string | null;
          supplies_needed: string[];
          setup_time: number;
          helpers_required?: number;
          step_by_step_instructions: string;
          host_script?: string | null;
          age_group: string[];
          venue_type: string[];
          duration: string;
          duration_minutes: number;
          theme_compatibility: string[];
          effort_level: string;
          participant_range: string;
          min_participants?: number;
          max_participants?: number | null;
          category: string;
          tags: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          full_description?: string | null;
          supplies_needed?: string[];
          setup_time?: number;
          helpers_required?: number;
          step_by_step_instructions?: string;
          host_script?: string | null;
          age_group?: string[];
          venue_type?: string[];
          duration?: string;
          duration_minutes?: number;
          theme_compatibility?: string[];
          effort_level?: string;
          participant_range?: string;
          min_participants?: number;
          max_participants?: number | null;
          category?: string;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      guests: {
        Row: {
          id: string;
          party_id: string;
          user_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          type: 'GUEST' | 'HELPER' | 'HOST';
          age: number | null;
          notes: string | null;
          rsvp_status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'MAYBE';
          dietary_restrictions: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          party_id: string;
          user_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          type?: 'GUEST' | 'HELPER' | 'HOST';
          age?: number | null;
          notes?: string | null;
          rsvp_status?: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'MAYBE';
          dietary_restrictions?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          party_id?: string;
          user_id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          type?: 'GUEST' | 'HELPER' | 'HOST';
          age?: number | null;
          notes?: string | null;
          rsvp_status?: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'MAYBE';
          dietary_restrictions?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      party_activities: {
        Row: {
          id: string;
          party_id: string;
          user_id: string;
          activity_id: string;
          is_selected: boolean;
          sort_order: number;
          custom_notes: string | null;
          estimated_time: number | null;
          people_required: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          party_id: string;
          user_id: string;
          activity_id: string;
          is_selected?: boolean;
          sort_order?: number;
          custom_notes?: string | null;
          estimated_time?: number | null;
          people_required?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          party_id?: string;
          user_id?: string;
          activity_id?: string;
          is_selected?: boolean;
          sort_order?: number;
          custom_notes?: string | null;
          estimated_time?: number | null;
          people_required?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      activity_favorites: {
        Row: {
          id: string;
          user_id: string;
          activity_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          activity_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          activity_id?: string;
          created_at?: string;
        };
      };
      theme_preferences: {
        Row: {
          id: string;
          user_id: string;
          theme_name: string;
          is_favorite: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          theme_name: string;
          is_favorite?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          theme_name?: string;
          is_favorite?: boolean;
          created_at?: string;
        };
      };
      email_logs: {
        Row: {
          id: string;
          user_id: string;
          party_id: string | null;
          email_type: string;
          recipient_email: string;
          subject: string;
          sent_at: string;
          status: 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          party_id?: string | null;
          email_type: string;
          recipient_email: string;
          subject: string;
          sent_at?: string;
          status?: 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          party_id?: string | null;
          email_type?: string;
          recipient_email?: string;
          subject?: string;
          sent_at?: string;
          status?: 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
          error_message?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

// Client-side Supabase client
export const createClientComponentClient = () => {
  return createBrowserClient<Database>(
    requiredEnvVars.supabaseUrl!,
    requiredEnvVars.supabaseAnonKey!
  );
};

// Server-side Supabase client
export const createServerComponentClient = () => {
  const cookieStore = cookies();
  
  return createServerClient<Database>(
    requiredEnvVars.supabaseUrl!,
    requiredEnvVars.supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
};

// Admin client for privileged operations
export const createAdminClient = () => {
  return createClient<Database>(
    requiredEnvVars.supabaseUrl!,
    requiredEnvVars.supabaseServiceKey!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};

// Default client for direct usage
export const supabase = createClient<Database>(
  requiredEnvVars.supabaseUrl!,
  requiredEnvVars.supabaseAnonKey!
);

// Error handling utility
export class SupabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: string,
    public hint?: string
  ) {
    super(message);
    this.name = 'SupabaseError';
  }
}

// Response wrapper for consistent error handling
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Utility function to handle Supabase responses
export function handleSupabaseResponse<T>(
  response: { data: T | null; error: any }
): ApiResponse<T> {
  if (response.error) {
    return {
      success: false,
      error: response.error.message || 'Database operation failed',
    };
  }
  
  return {
    success: true,
    data: response.data as T,
  };
}

// Database health check
export async function checkDatabaseHealth(): Promise<ApiResponse> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('activities')
      .select('count')
      .limit(1);
    
    if (error) {
      return {
        success: false,
        error: `Database connection failed: ${error.message}`,
      };
    }
    
    return {
      success: true,
      message: 'Database connection successful',
    };
  } catch (error) {
    return {
      success: false,
      error: `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
