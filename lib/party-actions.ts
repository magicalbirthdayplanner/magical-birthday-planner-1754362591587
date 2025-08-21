"use server"

import { revalidatePath } from 'next/cache'
import { createServerComponentClient } from '@/lib/supabase-client'

async function getCurrentUser() {
  // This is a placeholder - you'll need to implement proper user authentication
  // For now, return a mock user for testing
  return {
    id: 'test-user-id',
    email: 'test@example.com'
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
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error('Authentication required')

    const supabase = createServerComponentClient()
    
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
  } catch (error) {
    console.error('Error creating party:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
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
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error('Authentication required')

    const supabase = createServerComponentClient()
    
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
  } catch (error) {
    console.error('Error updating party:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}

export async function getParty(partyId: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const supabase = createServerComponentClient()
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

    const supabase = createServerComponentClient()
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

    const supabase = createServerComponentClient()
    const { error } = await supabase
      .from('parties')
      .delete()
      .eq('id', partyId)
      .eq('user_id', user.id)

    if (error) {
      throw new Error(error.message)
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

    const supabase = createServerComponentClient()
    
    // Verify party ownership
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('*')
      .eq('id', partyId)
      .eq('user_id', user.id)
      .single()

    if (partyError || !party) {
      throw new Error('Party not found or access denied')
    }

    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .insert({
        ...guestData,
        party_id: partyId,
      })
      .select()
      .single()

    if (guestError) {
      throw new Error(guestError.message)
    }

    // Create invitation record
    await supabase
      .from('invitations')
      .insert({
        party_id: partyId,
        guest_id: guest.id,
        status: 'PENDING',
      })

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

    const supabase = createServerComponentClient()
    
    // Verify party ownership through guest
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('*, parties!inner(user_id)')
      .eq('id', guestId)
      .eq('parties.user_id', user.id)
      .single()

    if (guestError || !guest) {
      throw new Error('Guest not found or access denied')
    }

    const { error: updateError } = await supabase
      .from('guests')
      .update(updates)
      .eq('id', guestId)

    if (updateError) {
      throw new Error(updateError.message)
    }

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

    const supabase = createServerComponentClient()
    
    // Verify party ownership through guest
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('*, parties!inner(user_id)')
      .eq('id', guestId)
      .eq('parties.user_id', user.id)
      .single()

    if (guestError || !guest) {
      throw new Error('Guest not found or access denied')
    }

    const { error: deleteError } = await supabase
      .from('guests')
      .delete()
      .eq('id', guestId)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

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

    const supabase = createServerComponentClient()
    
    // Verify party ownership through invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select('*, parties!inner(user_id)')
      .eq('id', invitationId)
      .eq('parties.user_id', user.id)
      .single()

    if (invitationError || !invitation) {
      throw new Error('Invitation not found or access denied')
    }

    const { error: updateError } = await supabase
      .from('invitations')
      .update({
        status,
        notes,
        responded_at: ['ACCEPTED', 'DECLINED', 'MAYBE'].includes(status) ? new Date().toISOString() : null,
        sent_at: status === 'SENT' ? new Date().toISOString() : invitation.sent_at,
      })
      .eq('id', invitationId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    revalidatePath('/party-plan')
    return { success: true }
  } catch (error) {
    console.error('Error updating invitation status:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}