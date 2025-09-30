import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userEmail } = await request.json()
    
    if (userEmail === 'magicalbirthdayplanner@gmail.com') {
      return NextResponse.json({
        success: true,
        message: 'Force welcome screen for test user',
        redirect_to: '/signin?show_welcome=true',
        is_new_user: true,
        debug: 'Forced welcome screen for testing'
      })
    }
    
    return NextResponse.json({
      success: false,
      message: 'Test endpoint only works for magicalbirthdayplanner@gmail.com'
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  // Direct redirect to signin with welcome screen
  return NextResponse.redirect(new URL('/signin?show_welcome=true', 'https://www.magicalbirthdayplanner.com'))
}