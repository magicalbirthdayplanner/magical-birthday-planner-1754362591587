"use server"

import { revalidatePath } from 'next/cache'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// Database connection health check
async function ensureDbConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('Database connection verified')
  } catch (error) {
    console.error('Database connection failed, attempting reconnection:', error)
    // Force reconnection by disconnecting and reconnecting
    await prisma.$disconnect()
    await new Promise(resolve => setTimeout(resolve, 1000))
    await prisma.$queryRaw`SELECT 1`
    console.log('Database reconnection successful')
  }
}

// Retry mechanism for database operations in serverless environments
async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      console.error(`Database operation attempt ${attempt + 1} failed:`, error)
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break
      }
      
      // For connection errors, try to reconnect
      if (error instanceof Error && error.message.includes("Can't reach database server")) {
        console.log('Connection error detected, forcing reconnection...')
        try {
          await prisma.$disconnect()
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (disconnectError) {
          console.error('Error during disconnect:', disconnectError)
        }
      }
      
      // Exponential backoff: wait 1s, 2s, 4s, etc.
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError || new Error('Database operation failed after all retries')
}

export async function getCurrentUser() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  return user
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
}) {
  try {
    console.log('Creating party with data:', partyData)
    
    const user = await getCurrentUser()
    if (!user) {
      console.error('No authenticated user found')
      throw new Error('User not authenticated')
    }
    
    console.log('Authenticated user:', { id: user.id, email: user.email })

    // Ensure database connection is healthy before creating user
    await ensureDbConnection()
    
    // Create user in database if doesn't exist with retry mechanism
    const dbUser = await retryWithExponentialBackoff(async () => {
      return await prisma.user.upsert({
        where: { email: user.email! },
        update: {},
        create: {
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.display_name || user.user_metadata?.full_name || null,
        },
      })
    }, 3)
    
    console.log('Database user created/updated:', dbUser)

    const party = await retryWithExponentialBackoff(async () => {
      return await prisma.party.create({
        data: {
          childName: partyData.childName,
          childAge: partyData.childAge,
          childGender: partyData.childGender || null,
          partyDate: partyData.partyDate,
          theme: partyData.theme,
          interests: partyData.interests,
          favoriteColors: partyData.favoriteColors,
          guestCount: partyData.guestCount || null,
          budget: partyData.budget || null,
          location: partyData.location || null,
          userId: user.id,
        },
      })
    }, 3)

    console.log('Party created successfully:', party)

    revalidatePath('/dashboard')
    revalidatePath('/party-plan')
    return { success: true, party }
  } catch (error) {
    console.error('Error creating party:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred while creating party' }
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
  checklistData: any
}>) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const party = await prisma.party.updateMany({
      where: {
        id: partyId,
        userId: user.id,
      },
      data: updates,
    })

    if (party.count === 0) {
      throw new Error('Party not found or access denied')
    }

    revalidatePath('/party-plan')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error updating party:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function getParty(partyId: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const party = await prisma.party.findFirst({
      where: {
        id: partyId,
        userId: user.id,
      },
      include: {
        guests: true,
        invitations: {
          include: {
            guest: true,
          },
        },
      },
    })

    return { success: true, party }
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

    // Ensure user exists in database
    await prisma.user.upsert({
      where: { email: user.email! },
      update: {},
      create: {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.display_name || user.user_metadata?.full_name || null,
      },
    })

    const parties = await prisma.party.findMany({
      where: {
        userId: user.id,
      },
      include: {
        guests: true,
        invitations: true,
      },
      orderBy: {
        partyDate: 'asc',
      },
    })

    return { success: true, parties }
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

    const party = await prisma.party.deleteMany({
      where: {
        id: partyId,
        userId: user.id,
      },
    })

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
  type: 'ADULT' | 'CHILD'
  age?: number
  notes?: string
}) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Verify party ownership
    const party = await prisma.party.findFirst({
      where: {
        id: partyId,
        userId: user.id,
      },
    })

    if (!party) {
      throw new Error('Party not found or access denied')
    }

    const guest = await prisma.guest.create({
      data: {
        ...guestData,
        partyId,
      },
    })

    // Create invitation record
    await prisma.invitation.create({
      data: {
        partyId,
        guestId: guest.id,
        status: 'PENDING',
      },
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
  type: 'ADULT' | 'CHILD'
  age: number
  notes: string
}>) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Verify party ownership through guest
    const guest = await prisma.guest.findFirst({
      where: {
        id: guestId,
        party: {
          userId: user.id,
        },
      },
    })

    if (!guest) {
      throw new Error('Guest not found or access denied')
    }

    await prisma.guest.update({
      where: { id: guestId },
      data: updates,
    })

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
    const guest = await prisma.guest.findFirst({
      where: {
        id: guestId,
        party: {
          userId: user.id,
        },
      },
    })

    if (!guest) {
      throw new Error('Guest not found or access denied')
    }

    await prisma.guest.delete({
      where: { id: guestId },
    })

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
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: invitationId,
        party: {
          userId: user.id,
        },
      },
    })

    if (!invitation) {
      throw new Error('Invitation not found or access denied')
    }

    await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status,
        notes,
        respondedAt: ['ACCEPTED', 'DECLINED', 'MAYBE'].includes(status) ? new Date() : null,
        sentAt: status === 'SENT' ? new Date() : invitation.sentAt,
      },
    })

    revalidatePath('/party-plan')
    return { success: true }
  } catch (error) {
    console.error('Error updating invitation status:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}