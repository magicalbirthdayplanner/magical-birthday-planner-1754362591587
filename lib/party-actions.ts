"use server"

import { revalidatePath } from 'next/cache'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// Simplified database connection check for serverless environments
async function ensureDbConnection() {
  try {
    console.log('Testing database connection...')
    
    // Single, fast database connectivity test
    const connectionPromise = prisma.$queryRaw`SELECT 1 as health_check`
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), 3000) // Reduced to 3s for faster feedback
    })
    
    await Promise.race([connectionPromise, timeoutPromise])
    console.log('✓ Database connection verified successfully')
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    throw new Error('Database connection failed. Please try again.')
  }
}

// Simplified retry mechanism for serverless environments
async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 1 // Single retry only for fast feedback
): Promise<T> {
  try {
    console.log(`🔄 Database operation attempt 1/${maxRetries + 1}`)
    const result = await operation()
    console.log('✅ Database operation succeeded')
    return result
  } catch (error) {
    console.error('❌ Database operation failed:', error instanceof Error ? error.message : 'Unknown error')
    
    // Single retry for connection issues only
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (
      maxRetries > 0 && (
        errorMessage.includes("Can't reach database server") ||
        errorMessage.includes("connection terminated") ||
        errorMessage.includes("Connection terminated") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("ECONNRESET")
      )
    ) {
      console.log('🔧 Connection error detected, attempting single retry...')
      try {
        await prisma.$disconnect()
        await new Promise(resolve => setTimeout(resolve, 500)) // Short delay
        
        console.log('🔄 Database operation retry attempt')
        const result = await operation()
        console.log('✅ Database operation succeeded on retry')
        return result
      } catch (retryError) {
        console.error('❌ Retry attempt failed:', retryError instanceof Error ? retryError.message : 'Unknown error')
        throw new Error(`Database operation failed after retry: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`)
      }
    }
    
    // No retry for other types of errors
    throw error
  }
}

export async function getCurrentUser() {
  try {
    const supabase = createServerComponentClient({ cookies })
    
    // Simplified authentication with fast fail for serverless environments
    console.log('🔐 Validating user authentication...')
    
    // Single, fast authentication check with shorter timeout
    const authPromise = Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser()
    ])
    
    // Reduced timeout for faster feedback in serverless environment
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Authentication timeout')), 5000) // Reduced to 5s
    })
    
    const [sessionResult, userResult] = await Promise.race([authPromise, timeoutPromise])
    
    // Check session
    const { data: sessionData, error: sessionError } = sessionResult
    if (sessionError || !sessionData.session) {
      throw new Error('No valid session found. Please sign in again.')
    }
    
    // Check user
    const { data: userData, error: userError } = userResult
    if (userError || !userData.user) {
      throw new Error('User authentication failed. Please sign in again.')
    }
    
    // Validate user has required properties
    if (!userData.user.id || !userData.user.email) {
      throw new Error('Invalid user data. Please sign out and sign in again.')
    }
    
    // Cross-validate session and user consistency
    if (sessionData.session.user.id !== userData.user.id) {
      throw new Error('Session mismatch detected. Please sign in again.')
    }
    
    console.log('✅ User authentication successful:', { 
      id: userData.user.id, 
      email: userData.user.email
    })
    
    return userData.user
    
  } catch (error) {
    console.error('getCurrentUser error:', error)
    
    // Simplified error categorization
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed'
    
    if (errorMessage.includes('timeout')) {
      throw new Error('Authentication taking too long. Please check your connection and try again.')
    } else if (errorMessage.includes('session') || errorMessage.includes('sign in')) {
      throw new Error('Please sign in again to continue.')
    } else {
      throw new Error(`Authentication failed: ${errorMessage}`)
    }
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
  adultCount?: number
  kidCount?: number
  budget?: number
  location?: string
  venue?: 'indoor' | 'outdoor' | 'mixed'
  duration?: string
  status?: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELED'
}) {
  try {
    console.log('🎉 Starting party creation process with data:', partyData)
    
    // Reduced overall timeout for faster feedback
    const operationTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Operation timeout: Party creation is taking too long. Please try again.'))
      }, 8000) // Reduced to 8 seconds for faster feedback
    })
    
    const createPartyOperation = async () => {
      const user = await getCurrentUser()
      if (!user) {
        console.error('❌ No authenticated user found')
        throw new Error('Authentication required: Please sign in to create a party')
      }
      
      console.log('✅ Authenticated user:', { id: user.id, email: user.email })

      // Quick database health check
      console.log('🔍 Testing database connection...')
      await ensureDbConnection()
      
      // Create user in database if doesn't exist
      console.log('👤 Creating/updating user in database...')
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
      })
      
      console.log('✅ Database user created/updated:', { id: dbUser.id, email: dbUser.email })

      // Create party
      console.log('🎊 Creating party in database...')
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
            adultCount: partyData.adultCount || null,
            kidCount: partyData.kidCount || null,
            budget: partyData.budget || null,
            status: partyData.status || 'PLANNING',
            userId: user.id,
          },
        })
      })

      console.log('🎉 Party created successfully:', { 
        id: party.id, 
        childName: party.childName, 
        theme: party.theme,
        date: party.partyDate 
      })

      return party
    }

    // Execute with timeout protection
    const party = await Promise.race([createPartyOperation(), operationTimeout])

    revalidatePath('/dashboard')
    revalidatePath('/party-plan')
    return { success: true, party }
  } catch (error) {
    console.error('💥 Error creating party:', error)
    
    // Simplified error categorization for better user experience
    let errorMessage: string
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('taking too long')) {
        errorMessage = 'Request is taking too long. Please check your internet connection and try again.'
      } else if (error.message.includes('sign in') || error.message.includes('Authentication')) {
        errorMessage = 'Please sign in again to continue.'
      } else if (error.message.includes('Database connection failed')) {
        errorMessage = 'Unable to connect to database. Please try again in a moment.'
      } else if (error.message.includes('UNIQUE constraint') || error.message.includes('duplicate')) {
        errorMessage = 'This party already exists. Please check your party list.'
      } else {
        errorMessage = `Unable to create party: ${error.message}`
      }
    } else {
      errorMessage = 'An unexpected error occurred. Please try again.'
    }
    
    return { 
      success: false, 
      error: errorMessage
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
  checklistData: any
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELED'
}>) {
  try {
    // Set timeout for update operation
    const operationTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Update timeout: Operation took too long. Please try again.'))
      }, 7000) // 7 second timeout for updates - Vercel compatible
    })

    const updatePartyOperation = async () => {
      const user = await getCurrentUser()
      if (!user) {
        throw new Error('Authentication required: Please sign in to update the party')
      }

      // Ensure database connection
      await ensureDbConnection()

      // Update with retry mechanism
      const party = await retryWithExponentialBackoff(async () => {
        return await prisma.party.updateMany({
          where: {
            id: partyId,
            userId: user.id,
          },
          data: updates,
        })
      })

      if (party.count === 0) {
        throw new Error('Party not found or you don\'t have permission to update it')
      }

      return party
    }

    // Execute with timeout protection
    await Promise.race([updatePartyOperation(), operationTimeout])

    revalidatePath('/party-plan')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error updating party:', error)
    
    let errorMessage: string
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('took too long')) {
        errorMessage = 'The update is taking longer than expected. Please try again in a moment.'
      } else if (error.message.includes('Authentication required') || error.message.includes('not authenticated')) {
        errorMessage = 'Please sign in again to continue updating your party.'
      } else if (error.message.includes('not found') || error.message.includes('permission')) {
        errorMessage = 'Party not found or you don\'t have permission to update it.'
      } else if (error.message.includes('Database connectivity') || error.message.includes('connection')) {
        errorMessage = 'We\'re experiencing temporary connectivity issues. Please try again.'
      } else {
        errorMessage = error.message
      }
    } else {
      errorMessage = 'An unexpected error occurred while updating the party.'
    }
    
    return { success: false, error: errorMessage }
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
        status: {
          in: ['PLANNING', 'ACTIVE', 'COMPLETED']
        }
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