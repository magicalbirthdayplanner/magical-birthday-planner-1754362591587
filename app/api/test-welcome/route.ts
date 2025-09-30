import { NextResponse } from 'next/server'

export async function GET() {
  // Simple test endpoint to redirect to signin with welcome screen
  const redirectUrl = new URL('/signin?show_welcome=true', 'https://www.magicalbirthdayplanner.com')
  
  return NextResponse.redirect(redirectUrl)
}

export async function POST(request: Request) {
  const { trigger } = await request.json()
  
  if (trigger === 'welcome') {
    return NextResponse.json({
      success: true,
      message: 'Welcome screen test trigger',
      redirect_to: '/signin?show_welcome=true',
      instructions: 'Navigate to /signin?show_welcome=true to test the welcome screen'
    })
  }
  
  return NextResponse.json({
    success: false,
    message: 'Invalid trigger'
  })
}