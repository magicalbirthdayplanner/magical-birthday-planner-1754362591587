import { supabase, getCurrentUser } from './supabase-client'

// Create a new party
export const createParty = async (partyData: any) => {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const partyRecord = {
      user_id: user.id,
      child_name: partyData.childName || 'Your Child',
      child_age: partyData.childAge || 5,
      child_gender: partyData.childGender || null,
      party_date: new Date(partyData.partyDate || new Date()).toISOString().split('T')[0],
      theme: partyData.theme || 'Superhero',
      guest_count: partyData.guestCount || 0,
      budget: partyData.budget || null,
      zip_code: partyData.location || null,
      venue_type: partyData.venue || null,
      status: partyData.status || 'PLANNING' as const
    }

    console.log('Creating party record:', partyRecord)

    const { data: newParty, error } = await supabase
      .from('parties')
      .insert(partyRecord)
      .select()
      .single()

    if (error) {
      console.error('Supabase error creating party:', error)
      throw new Error(error.message)
    }

    return { success: true, party: newParty }
  } catch (error) {
    console.error('Error creating party:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}

// Get a party by ID
export const getParty = async (partyId: string) => {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { data: party, error } = await supabase
      .from('parties')
      .select(`
        *,
        guests(id, name, email, phone, type, age, notes),
        invitations(id, status, responded_at, sent_at)
      `)
      .eq('id', partyId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return { success: true, party }
  } catch (error) {
    console.error('Error getting party:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}

// Update a party
export const updateParty = async (partyId: string, updates: any) => {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { data: updatedParty, error } = await supabase
      .from('parties')
      .update(updates)
      .eq('id', partyId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return { success: true, party: updatedParty }
  } catch (error) {
    console.error('Error updating party:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}

// Add a guest
export const addGuest = async (partyId: string, guestData: any) => {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

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

    // Create guest
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .insert({
        ...guestData,
        party_id: partyId,
        user_id: user.id,
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
        user_id: user.id,
        token: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'PENDING',
      })

    return { success: true, guest }
  } catch (error) {
    console.error('Error adding guest:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}

// Update a guest
export const updateGuest = async (guestId: string, updates: any) => {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Verify guest ownership through party
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('parties!inner(user_id)')
      .eq('id', guestId)
      .eq('parties.user_id', user.id)
      .single()

    if (guestError || !guest) {
      throw new Error('Guest not found or access denied')
    }

    // Update guest
    const { data: updatedGuest, error: updateError } = await supabase
      .from('guests')
      .update(updates)
      .eq('id', guestId)
      .select()
      .single()

    if (updateError) {
      throw new Error(updateError.message)
    }

    return { success: true, guest: updatedGuest }
  } catch (error) {
    console.error('Error updating guest:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}

// Delete a guest
export const deleteGuest = async (guestId: string) => {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Verify guest ownership through party
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('parties!inner(user_id)')
      .eq('id', guestId)
      .eq('parties.user_id', user.id)
      .single()

    if (guestError || !guest) {
      throw new Error('Guest not found or access denied')
    }

    // Delete guest
    const { error: deleteError } = await supabase
      .from('guests')
      .delete()
      .eq('id', guestId)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting guest:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}

// Get user's parties
export const getUserParties = async () => {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { data: parties, error } = await supabase
      .from('parties')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    return { success: true, parties: parties || [] }
  } catch (error) {
    console.error('Error getting user parties:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}

// Delete a party
export const deleteParty = async (partyId: string) => {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

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

    // Delete party (this will cascade delete guests and invitations due to foreign key constraints)
    const { error: deleteError } = await supabase
      .from('parties')
      .delete()
      .eq('id', partyId)
      .eq('user_id', user.id)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting party:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}