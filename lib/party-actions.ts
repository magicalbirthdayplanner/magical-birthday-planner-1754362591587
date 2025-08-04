"use server"

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

const prisma = new PrismaClient()

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
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Create user in database if doesn't exist
    await prisma.user.upsert({
      where: { email: user.email! },
      update: {},
      create: {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.display_name || user.user_metadata?.full_name || null,
      },
    })

    const party = await prisma.party.create({
      data: {
        ...partyData,
        userId: user.id,
      },
    })

    revalidatePath('/dashboard')
    revalidatePath('/party-plan')
    return { success: true, party }
  } catch (error) {
    console.error('Error creating party:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
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