import { createClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient } from '@supabase/ssr';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Types for our data
export interface Activity {
  id: string;
  name: string;
  description: string;
  fullDescription?: string;
  suppliesNeeded: string[];
  setupTime: number;
  helpersRequired: number;
  stepByStepInstructions: string;
  hostScript: string;
  ageGroup: string[];
  venueType: string[];
  duration: string;
  durationMinutes: number;
  themeCompatibility: string[];
  effortLevel: string;
  participantRange: string;
  minParticipants: number;
  maxParticipants: number;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityFavorite {
  id: string;
  userId: string;
  activityId: string;
  createdAt: string;
  updatedAt: string;
  activity?: Activity;
}

export interface SelectedActivity {
  id: string;
  userId: string;
  partyId: string;
  activityId: string;
  isSelected: boolean;
  createdAt: string;
  updatedAt: string;
  activity?: Activity;
}

export interface Party {
  id: string;
  childName: string;
  childAge: number;
  childGender?: string;
  partyDate: string;
  partyTime?: string;
  partyLocation?: string;
  theme: string;
  interests: string[];
  favoriteColors: string[];
  guestCount?: number;
  maxGuests?: number;
  budget?: number;
  checklistData?: any;
  packageType: string;
  status: string;
  rsvpDeadline?: string;
  hostName?: string;
  hostEmail?: string;
  hostPhone?: string;
  customInstructions?: string;
  shareToken?: string;
  isShared: boolean;
  sharedAt?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  eventPurchaseId?: string;
  adultCount?: number;
  kidCount?: number;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  displayName?: string;
  currentPlan: string;
  emailVerified: boolean;
  emailVerifiedAt?: string;
  passwordResetRequested: boolean;
  passwordResetAt?: string;
  createdAt: string;
  updatedAt: string;
  theme?: string;
  emailNotifications: boolean;
  partyReminders: boolean;
  marketingEmails: boolean;
}

// Supabase client instances
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client-side Supabase client (for components)
export const createClientComponentClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};

// Server-side Supabase client (for server actions and API routes)
export const createServerComponentClient = ({ cookies }: { cookies: any }) => {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookies().get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        try {
          const isProduction = process.env.NODE_ENV === 'production';
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'localhost:3000';
          const domain = isProduction && baseUrl.includes('.') ? `.${baseUrl.replace(/^https?:\/\/(www\.)?/, '')}` : undefined;
          
          const cookieOptions = {
            ...options,
            domain,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax'
          };
          cookies().set({ name, value, ...cookieOptions });
        } catch (error) {
          // Ignore errors in Server Components
        }
      },
      remove(name: string, options: any) {
        try {
          const isProduction = process.env.NODE_ENV === 'production';
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'localhost:3000';
          const domain = isProduction && baseUrl.includes('.') ? `.${baseUrl.replace(/^https?:\/\/(www\.)?/, '')}` : undefined;
          
          const cookieOptions = {
            ...options,
            domain,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax'
          };
          cookies().set({ name, value: '', ...cookieOptions });
        } catch (error) {
          // Ignore errors in Server Components
        }
      },
    },
  });
};

// Admin client for privileged operations
export const createAdminClient = () => {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
};

// Activity-related functions
export const activitiesApi = {
  // Get all activities with pagination and filtering
  async getActivities(params: {
    page?: number;
    limit?: number;
    category?: string;
    time?: string;
    materials?: string;
    search?: string;
  } = {}) {
    const { page = 1, limit = 50, category, time, materials, search } = params;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('activities')
      .select('*', { count: 'exact' });

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }
    if (time) {
      query = query.eq('duration', time);
    }
    if (materials) {
      // Filter by setup time which correlates with materials needed
      switch (materials) {
        case 'No Prep':
          query = query.lte('setupTime', 5);
          break;
        case 'Simple Prep':
          query = query.gte('setupTime', 6).lte('setupTime', 15);
          break;
        case 'Advanced Prep':
          query = query.gte('setupTime', 16);
          break;
      }
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch activities: ${error.message}`);
    }

    return {
      activities: data || [],
      totalCount: count || 0,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        hasNextPage: (count || 0) > offset + limit,
        hasPrevPage: page > 1
      }
    };
  },

  // Get a single activity by ID
  async getActivity(id: string) {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch activity: ${error.message}`);
    }

    return data;
  },

  // Get activities by category
  async getActivitiesByCategory(category: string) {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('category', category)
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch activities by category: ${error.message}`);
    }

    return data || [];
  },

  // Get activities compatible with a theme
  async getActivitiesByTheme(theme: string) {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .contains('themeCompatibility', [theme])
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch activities by theme: ${error.message}`);
    }

    return data || [];
  }
};

// Favorites-related functions
export const favoritesApi = {
  // Get user's favorite activities
  async getUserFavorites(userId: string) {
    const { data, error } = await supabase
      .from('activity_favorites')
      .select(`
        *,
        activity:activities(*)
      `)
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch favorites: ${error.message}`);
    }

    return data || [];
  },

  // Add activity to favorites
  async addToFavorites(userId: string, activityId: string) {
    const { data, error } = await supabase
      .from('activity_favorites')
      .insert({
        userId,
        activityId
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add to favorites: ${error.message}`);
    }

    return data;
  },

  // Remove activity from favorites
  async removeFromFavorites(userId: string, activityId: string) {
    const { error } = await supabase
      .from('activity_favorites')
      .delete()
      .eq('userId', userId)
      .eq('activityId', activityId);

    if (error) {
      throw new Error(`Failed to remove from favorites: ${error.message}`);
    }

    return true;
  },

  // Check if activity is favorited
  async isFavorited(userId: string, activityId: string) {
    const { data, error } = await supabase
      .from('activity_favorites')
      .select('id')
      .eq('userId', userId)
      .eq('activityId', activityId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new Error(`Failed to check favorite status: ${error.message}`);
    }

    return !!data;
  }
};

// Selected activities functions
export const selectedActivitiesApi = {
  // Get activities selected for a party
  async getPartySelectedActivities(userId: string, partyId: string) {
    const { data, error } = await supabase
      .from('selected_activities')
      .select(`
        *,
        activity:activities(*)
      `)
      .eq('userId', userId)
      .eq('partyId', partyId)
      .eq('isSelected', true)
      .order('createdAt', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch selected activities: ${error.message}`);
    }

    return data || [];
  },

  // Add activity to party selection
  async addToPartySelection(userId: string, partyId: string, activityId: string) {
    const { data, error } = await supabase
      .from('selected_activities')
      .upsert({
        userId,
        partyId,
        activityId,
        isSelected: true
      }, {
        onConflict: 'userId,partyId,activityId'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add to party selection: ${error.message}`);
    }

    return data;
  },

  // Remove activity from party selection
  async removeFromPartySelection(userId: string, partyId: string, activityId: string) {
    const { error } = await supabase
      .from('selected_activities')
      .delete()
      .eq('userId', userId)
      .eq('partyId', partyId)
      .eq('activityId', activityId);

    if (error) {
      throw new Error(`Failed to remove from party selection: ${error.message}`);
    }

    return true;
  },

  // Toggle activity selection
  async toggleActivitySelection(userId: string, partyId: string, activityId: string) {
    const { data, error } = await supabase
      .from('selected_activities')
      .upsert({
        userId,
        partyId,
        activityId,
        isSelected: true
      }, {
        onConflict: 'userId,partyId,activityId'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to toggle activity selection: ${error.message}`);
    }

    return data;
  }
};

// Party-related functions
export const partiesApi = {
  // Get user's parties
  async getUserParties(userId: string) {
    const { data, error } = await supabase
      .from('parties')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user parties: ${error.message}`);
    }

    return data || [];
  },

  // Get party by ID
  async getParty(partyId: string) {
    const { data, error } = await supabase
      .from('parties')
      .select('*')
      .eq('id', partyId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch party: ${error.message}`);
    }

    return data;
  },

  // Create new party
  async createParty(partyData: Partial<Party>) {
    const { data, error } = await supabase
      .from('parties')
      .insert(partyData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create party: ${error.message}`);
    }

    return data;
  },

  // Update party
  async updateParty(partyId: string, updates: Partial<Party>) {
    const { data, error } = await supabase
      .from('parties')
      .update(updates)
      .eq('id', partyId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update party: ${error.message}`);
    }

    return data;
  },

  // Delete party
  async deleteParty(partyId: string) {
    const { error } = await supabase
      .from('parties')
      .delete()
      .eq('id', partyId);

    if (error) {
      throw new Error(`Failed to delete party: ${error.message}`);
    }

    return true;
  }
};

// User-related functions
export const usersApi = {
  // Get user profile
  async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    return data;
  },

  // Update user profile
  async updateUserProfile(userId: string, updates: Partial<User>) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user profile: ${error.message}`);
    }

    return data;
  },

  // Update user subscription plan
  async updateUserPlan(userId: string, plan: string) {
    const { data, error } = await supabase
      .from('users')
      .update({ currentPlan: plan })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user plan: ${error.message}`);
    }

    return data;
  }
};

// Database health check
export const dbHealthCheck = {
  async checkConnection() {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('id')
        .limit(1);

      if (error) {
        return { healthy: false, error: error.message };
      }

      return { healthy: true, message: 'Database connection successful' };
    } catch (error) {
      return { healthy: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getTableCounts() {
    try {
      const tables = ['activities', 'parties', 'users', 'activity_favorites', 'selected_activities'];
      const counts: Record<string, number> = {};

      for (const table of tables) {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          counts[table] = -1; // Error
        } else {
          counts[table] = count || 0;
        }
      }

      return counts;
    } catch (error) {
      throw new Error(`Failed to get table counts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

// Export all APIs
export default {
  activities: activitiesApi,
  favorites: favoritesApi,
  selectedActivities: selectedActivitiesApi,
  parties: partiesApi,
  users: usersApi,
  health: dbHealthCheck,
  supabase,
  createClientComponentClient,
  createServerComponentClient,
  createAdminClient
};
