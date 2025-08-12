import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'RESEND_API_KEY not configured' 
        },
        { status: 503 }
      );
    }

    const { to } = await request.json();

    if (!to) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Email address (to) is required' 
        },
        { status: 400 }
      );
    }

    // Send test email
    const result = await sendEmail({
      to,
      subject: '🎉 Test Email from Magical Birthday Planner',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #6366f1; text-align: center;">🎉 Resend Integration Test</h1>
          <p>Hi there!</p>
          <p>This is a test email from the Magical Birthday Planner to verify that the Resend integration is working properly.</p>
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
            <h2>✅ Resend Integration is Working!</h2>
            <p>Your email service is properly configured and ready to send party invitations.</p>
          </div>
          <p>Best regards,<br>The Magical Birthday Planner Team</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">
            Test sent at: ${new Date().toISOString()}<br>
            From: noreply@magicalbirthdays.com<br>
            API Key configured: ✅
          </p>
        </div>
      `,
      text: `
        🎉 Resend Integration Test

        Hi there!

        This is a test email from the Magical Birthday Planner to verify that the Resend integration is working properly.

        ✅ Resend Integration is Working!
        Your email service is properly configured and ready to send party invitations.

        Best regards,
        The Magical Birthday Planner Team

        Test sent at: ${new Date().toISOString()}
        From: noreply@magicalbirthdays.com
        API Key configured: ✅
      `,
    });

    return NextResponse.json({
      success: result.success,
      message: result.success ? 
        'Test email sent successfully! Check your inbox.' :
        'Failed to send test email.',
      resendId: result.id,
      error: result.error,
      config: {
        apiKeyConfigured: !!process.env.RESEND_API_KEY,
        fromDomain: 'noreply@magicalbirthdays.com',
        testTimestamp: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}