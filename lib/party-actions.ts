"use server"

import { revalidatePath } from 'next/cache'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// Enhanced database connection health check for Vercel serverless
async function ensureDbConnection() {
  try {
    console.log('Testing database connection...')
    
    // Set connection timeout to prevent hanging - optimized for production
    const connectionPromise = prisma.$queryRaw`SELECT 1 as health_check`
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), 10000) // Increased to 10s for stability
    })
    
    await Promise.race([connectionPromise, timeoutPromise])
    console.log('✓ Database connection verified successfully')
    return true
  } catch (error) {
    console.error('❌ Database connection failed, attempting recovery:', error)
    
    // Enhanced recovery strategy for serverless environments
    try {
      // Graceful disconnect first
      await prisma.$disconnect()
      console.log('Disconnected from database, waiting for reconnection...')
      
      // Reduced wait time for better user experience
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Test connection again with timeout protection
      const reconnectPromise = prisma.$queryRaw`SELECT CURRENT_TIMESTAMP as reconnect_test`
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
        await new Promise(resolve => setTimeout(resolve, 500))
        const finalPromise = prisma.$queryRaw`SELECT 'final_attempt' as test`
        const finalTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Final connection attempt timeout')), 2000)
        })
        
        await Promise.race([finalPromise, finalTimeout])
        console.log('✓ Database connection restored on final attempt')
        return true
      } catch (finalError) {
        console.error('❌ All database connection attempts failed:', finalError)
        throw new Error(`Database connectivity issues detected. Please try again in a few moments.`)
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
      if (
        errorMessage.includes("Can't reach database server") ||
        errorMessage.includes("connection terminated") ||
        errorMessage.includes("Connection terminated") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("ENOTFOUND")
      ) {
        console.log('🔧 Connection error detected, performing enhanced recovery...')
        try {
          // Aggressive disconnection and reconnection
          await prisma.$disconnect()
          console.log('Disconnected from database for clean reconnection')
          
          // Reduced wait time for faster user feedback
          const recoveryDelay = 500 + (attempt * 250)
          await new Promise(resolve => setTimeout(resolve, recoveryDelay))
          
          // Test connection before next attempt
          await ensureDbConnection()
        } catch (recoveryError) {
          console.error('Recovery attempt failed:', recoveryError)
        }
      }
      
      // Reduced exponential backoff with jitter for faster feedback
      const jitter = Math.random() * 200 // Reduced jitter
      const delay = Math.min((baseDelay * Math.pow(1.5, attempt)) + jitter, 3000) // Cap max delay at 3s
      console.log(`⏳ Retrying in ${Math.round(delay)}ms... (attempt ${attempt + 2}/${maxRetries + 1})`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  const finalError = new Error(
    `Database operation failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  )
  console.error('💥 Final error:', finalError.message)
  throw finalError
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
  adultCount?: number
  kidCount?: number
  budget?: number
  location?: string
  status?: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELED'
}) {
  try {
    console.log('🎉 Starting party creation process with data:', partyData)
    
    // Set overall timeout for the entire function to prevent hanging
    const operationTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Operation timeout: Party creation took too long. This might be due to database connectivity issues.'))
      }, 15000) // 15 second timeout - increased for better reliability on production
    })
    
    const createPartyOperation = async () => {
      const user = await getCurrentUser()
      if (!user) {
        console.error('❌ No authenticated user found')
        throw new Error('Authentication required: Please sign in to create a party')
      }
      
      console.log('✅ Authenticated user:', { id: user.id, email: user.email })

      // Enhanced pre-operation database health check
      console.log('🔍 Performing comprehensive database health check...')
      await ensureDbConnection()
      
      // Create user in database if doesn't exist with enhanced retry mechanism
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

      // Create party with enhanced retry mechanism
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
    
    // Enhanced error categorization and user-friendly messages
    let errorMessage: string
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('took too long')) {
        errorMessage = 'The server is taking longer than expected to respond. This might be due to high traffic or network issues. Please try again in a moment.'
      } else if (error.message.includes('Authentication required') || error.message.includes('not authenticated')) {
        errorMessage = 'Please sign in again to continue creating your party.'
      } else if (error.message.includes('Database connectivity') || error.message.includes('connection')) {
        errorMessage = 'We\'re experiencing temporary connectivity issues. Please wait a moment and try again.'
      } else if (error.message.includes('UNIQUE constraint') || error.message.includes('duplicate')) {
        errorMessage = 'It looks like this party already exists. Please check your party list or try with different details.'
      } else {
        errorMessage = `Unable to create party: ${error.message}`
      }
    } else {
      errorMessage = 'An unexpected error occurred while creating your party. Please try again.'
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