"use server"

import { revalidatePath } from 'next/cache'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-integration'

// Enhanced database connection health check for Vercel serverless
async function ensureDbConnection() {
  try {
    console.log('Testing database connection...')
    
    // Set connection timeout to prevent hanging - optimized for production
    const supabase = createAdminClient()
    const connectionPromise = supabase.from('health_check').select('*', { count: 'exact' })
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), 5000) // Reduced to 5s for faster feedback
    })
    
    await Promise.race([connectionPromise, timeoutPromise])
    console.log('✓ Database connection verified successfully')
    return true
  } catch (error) {
    console.error('❌ Database connection failed, attempting recovery:', error)
    
    // Enhanced recovery strategy for serverless environments
    try {
      // Graceful disconnect first
      const supabase = createAdminClient()
      await supabase.auth.signOut()
      console.log('Disconnected from database, waiting for reconnection...')
      
      // Reduced wait time for better user experience
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Test connection again with timeout protection
      const reconnectPromise = supabase.from('reconnect_test').select('*', { count: 'exact' })
      const reconnectTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Reconnection timeout')), 3000)
      })
      
      await Promise.race([reconnectPromise, reconnectTimeout])
      console.log('✓ Database reconnection successful')
      return true
    } catch (retryError) {
      console.error('❌ Database reconnection failed:', retryError)
      
      // Final attempt with minimal timeout to fail fast
      try {
        await new Promise(resolve => setTimeout(resolve, 200))
        const supabase = createAdminClient()
        const finalPromise = supabase.from('test').select('*', { count: 'exact' })
        const finalTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Final connection attempt timeout')), 2000)
        })
        
        await Promise.race([finalPromise, finalTimeout])
        console.log('✓ Database connection restored on final attempt')
        return true
      } catch (finalError) {
        console.error('❌ All database connection attempts failed:', finalError)
        // Don't throw error, just return false to allow fallback
        return false
      }
    }
  }
}

// Enhanced retry mechanism specifically optimized for Vercel serverless deployment
async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2, // Reduced retries to prevent long hanging
  baseDelay: number = 1000 // Reduced base delay for faster feedback
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Database operation attempt ${attempt + 1}/${maxRetries + 1}`)
      
      // Pre-operation connection health check for critical operations
      if (attempt > 0) {
        await ensureDbConnection()
      }
      
      const result = await operation()
      console.log(`✅ Database operation succeeded on attempt ${attempt + 1}`)
      return result
    } catch (error) {
      lastError = error as Error
      console.error(`❌ Database operation attempt ${attempt + 1} failed:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: attempt + 1,
        maxRetries: maxRetries + 1
      })
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        console.error('🚫 All retry attempts exhausted')
        break
      }
      
      // Enhanced error detection and recovery for serverless environments
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Don't retry on certain types of errors
      if (errorMessage.includes('P1001') || errorMessage.includes('P1002') || errorMessage.includes('P1003')) {
        console.error('🚫 Database connection error detected, skipping retry')
        break
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
      console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError || new Error('Operation failed after all retry attempts')
}

export async function getCurrentUser() {
  try {
    const supabase = createServerComponentClient({ cookies })
    
    // Enhanced session validation with retry mechanism for production environment
    let authAttempts = 0
    const maxAttempts = 3
    let lastError: Error | null = null
    
    while (authAttempts < maxAttempts) {
      try {
        console.log(`Auth attempt ${authAttempts + 1}/${maxAttempts}`)
        
        // Get user with timeout protection
        const getUserPromise = supabase.auth.getUser()
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Auth timeout')), 5000)
        })
        
        const { data, error } = await Promise.race([getUserPromise, timeoutPromise])
        
        if (error) {
          throw new Error(`Authentication error: ${error.message}`)
        }
        
        if (!data.user) {
          throw new Error('No authenticated user found')
        }
        
        // Validate user has required properties
        if (!data.user.id || !data.user.email) {
          throw new Error('Invalid user data: missing id or email')
        }
        
        console.log('✅ User authentication successful:', { 
          id: data.user.id, 
          email: data.user.email,
          attempt: authAttempts + 1 
        })
        
        return data.user
        
      } catch (error) {
        lastError = error as Error
        authAttempts++
        
        console.warn(`Auth attempt ${authAttempts} failed:`, lastError.message)
        
        // Don't retry on the last attempt
        if (authAttempts === maxAttempts) {
          break
        }
        
        // Progressive delay between retries
        const delay = 500 * authAttempts
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    // All attempts failed
    const errorMessage = lastError?.message || 'Authentication failed'
    console.error('❌ All authentication attempts failed:', errorMessage)
    throw new Error(`Authentication failed after ${maxAttempts} attempts: ${errorMessage}`)
    
  } catch (error) {
    console.error('getCurrentUser error:', error)
    throw error
  }
}

export async function createParty(partyData: {
  childName: string
  childAge: number
  childGender?: string
  partyDate: Date
  theme: string
  interests: string[]
  favoriteColors: string[]
  guestCount?: number
  budget?: number
  location?: string
  venue?: string
  duration?: string
  status?: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
}) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Authentication required')

  const supabase = createServerComponentClient({ cookies })
  
  const { data, error } = await supabase
    .from('parties')
    .insert({
      user_id: user.id,
      child_name: partyData.childName,
      child_age: partyData.childAge,
      child_gender: partyData.childGender,
      party_date: partyData.partyDate,
      theme: partyData.theme,
      guest_count: partyData.guestCount,
      budget: partyData.budget,
      zip_code: partyData.location,
      venue_type: partyData.venue,
      status: partyData.status || 'PLANNING'
    })
    .select()
    .single()

  if (error) {
    console.error('Party creation error:', error)
    throw new Error(error.message)
  }

  if (!data.id) {
    throw new Error('Party created but no ID returned from database')
  }

  revalidatePath('/dashboard')
  revalidatePath('/party-plan')

  return { success: true, party: data }
}

export async function updateParty(partyId: string, updates: Partial<{
  childName: string
  childAge: number
  childGender: string
  partyDate: Date
  theme: string
  interests: string[]
  favoriteColors: string[]
  guestCount: number
  budget: number
  location: string
  venue: string
  duration: string
  checklistData: any
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
}>) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Authentication required')

  const supabase = createServerComponentClient({ cookies })
  
  const { data, error } = await supabase
    .from('parties')
    .update({
      child_name: updates.childName,
      child_age: updates.childAge,
      child_gender: updates.childGender,
      party_date: updates.partyDate,
      theme: updates.theme,
      guest_count: updates.guestCount,
      budget: updates.budget,
      zip_code: updates.location,
      venue_type: updates.venue,
      status: updates.status
    })
    .eq('id', partyId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Party update error:', error)
    throw new Error(error.message)
  }

  revalidatePath('/party-plan')
  revalidatePath('/dashboard')
  
  return { success: true, party: data }
}

export async function getParty(partyId: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const supabase = createServerComponentClient({ cookies })
    const { data, error } = await supabase
      .from('parties')
      .select('*, guests(id, name, email, phone, type, age, notes), invitations(id, status, responded_at, sent_at)')
      .eq('id', partyId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return { success: true, party: data }
  } catch (error) {
    console.error('Error getting party:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function getUserParties() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const supabase = createServerComponentClient({ cookies })
    const { data, error } = await supabase
      .from('parties')
      .select('*, guests(id, name, email, phone, type, age, notes), invitations(id, status, responded_at, sent_at)')
      .eq('user_id', user.id)
      .eq('status', 'PLANNING')
      .or(`status.eq.ACTIVE,status.eq.COMPLETED`)
      .order('party_date', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return { success: true, parties: data }
  } catch (error) {
    console.error('Error getting user parties:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function deleteParty(partyId: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const party = await createAdminClient().from('parties').delete().eq('id', partyId).eq('userId', user.id)

    if (party.count === 0) {
      throw new Error('Party not found or access denied')
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error deleting party:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Guest management actions
export async function addGuest(partyId: string, guestData: {
  name: string
  email?: string
  phone?: string
  type: 'ADULT' | 'CHILD' | 'FAMILY' | 'COUPLE'
  age?: number
  notes?: string
}) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Verify party ownership
    const party = await createAdminClient().from('parties').select('*').eq('id', partyId).eq('userId', user.id).single()

    if (!party.data) {
      throw new Error('Party not found or access denied')
    }

    const guest = await createAdminClient().from('guests').insert({
      ...guestData,
      partyId,
    }).select().single()

    // Create invitation record
    await createAdminClient().from('invitations').insert({
      partyId,
      guestId: guest.data?.id,
      status: 'PENDING',
    }).select().single()

    revalidatePath('/party-plan')
    return { success: true, guest }
  } catch (error) {
    console.error('Error adding guest:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function updateGuest(guestId: string, updates: Partial<{
  name: string
  email: string
  phone: string
  type: 'ADULT' | 'CHILD' | 'FAMILY' | 'COUPLE'
  age: number
  notes: string
}>) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Verify party ownership through guest
    const guest = await createAdminClient().from('guests').select('*').eq('id', guestId).eq('party.userId', user.id).single()

    if (!guest.data) {
      throw new Error('Guest not found or access denied')
    }

    await createAdminClient().from('guests').update(updates).eq('id', guestId)

    revalidatePath('/party-plan')
    return { success: true }
  } catch (error) {
    console.error('Error updating guest:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function deleteGuest(guestId: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Verify party ownership through guest
    const guest = await createAdminClient().from('guests').select('*').eq('id', guestId).eq('party.userId', user.id).single()

    if (!guest.data) {
      throw new Error('Guest not found or access denied')
    }

    await createAdminClient().from('guests').delete().eq('id', guestId)

    revalidatePath('/party-plan')
    return { success: true }
  } catch (error) {
    console.error('Error deleting guest:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function updateInvitationStatus(invitationId: string, status: 'PENDING' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'MAYBE', notes?: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Verify party ownership through invitation
    const invitation = await createAdminClient().from('invitations').select('*').eq('id', invitationId).eq('party.userId', user.id).single()

    if (!invitation.data) {
      throw new Error('Invitation not found or access denied')
    }

    await createAdminClient().from('invitations').update({
      status,
      notes,
      responded_at: ['ACCEPTED', 'DECLINED', 'MAYBE'].includes(status) ? new Date() : null,
      sent_at: status === 'SENT' ? new Date() : invitation.data.sent_at,
    }).eq('id', invitationId)

    revalidatePath('/party-plan')
    return { success: true }
  } catch (error) {
    console.error('Error updating invitation status:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}