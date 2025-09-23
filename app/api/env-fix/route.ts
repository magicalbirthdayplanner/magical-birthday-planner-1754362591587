import { NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const currentBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
    const hasNewline = currentBaseUrl.includes('\n')
    const trimmedUrl = currentBaseUrl.trim()
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      issue_detected: hasNewline,
      current_value: {
        raw: JSON.stringify(currentBaseUrl),
        length: currentBaseUrl.length,
        trimmed: trimmedUrl,
        trimmed_length: trimmedUrl.length
      },
      fix_instructions: {
        problem: hasNewline ? 'NEWLINE CHARACTER DETECTED in NEXT_PUBLIC_BASE_URL' : 'Environment variable looks clean',
        solution: hasNewline ? [
          '1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
          '2. Find NEXT_PUBLIC_BASE_URL',
          '3. Edit the variable and set it to: https://www.magicalbirthdayplanner.com',
          '4. Make sure there are NO trailing spaces or newlines',
          '5. Save and redeploy',
          '6. Alternative: Use Vercel CLI: vercel env rm NEXT_PUBLIC_BASE_URL',
          '7. Then: vercel env add NEXT_PUBLIC_BASE_URL production',
          '8. Enter: https://www.magicalbirthdayplanner.com'
        ] : [
          'Environment variable appears to be correctly formatted',
          'The issue might be in Supabase Dashboard configuration'
        ]
      },
      vercel_cli_commands: hasNewline ? [
        'vercel env rm NEXT_PUBLIC_BASE_URL production',
        'vercel env add NEXT_PUBLIC_BASE_URL production',
        '# When prompted, enter: https://www.magicalbirthdayplanner.com'
      ] : [],
      next_steps: [
        'After fixing the environment variable, redeploy the application',
        'Test the oauth-config endpoint again',
        'Verify that URLs no longer contain \\\n characters'
      ]
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}