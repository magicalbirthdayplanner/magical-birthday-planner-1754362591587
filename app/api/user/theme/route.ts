import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { theme: true }
    })

    return NextResponse.json({ 
      theme: dbUser?.theme || 'light' 
    })
  } catch (error) {
    console.error('Error fetching user theme:', error)
    return NextResponse.json(
      { error: 'Failed to fetch theme preference' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { theme } = await request.json()

    if (!theme || !['light', 'dark'].includes(theme)) {
      return NextResponse.json(
        { error: 'Invalid theme. Must be "light" or "dark"' },
        { status: 400 }
      )
    }

    // Create or update user with theme preference
    await prisma.user.upsert({
      where: { id: user.id },
      update: { theme },
      create: {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.display_name || user.user_metadata?.full_name || null,
        theme,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving user theme:', error)
    return NextResponse.json(
      { error: 'Failed to save theme preference' },
      { status: 500 }
    )
  }
}