import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const getResend = () => new Resend(process.env.RESEND_API_KEY || 're_not_configured');

export async function GET() {
  try {
    // Test if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'RESEND_API_KEY environment variable not configured',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Test Resend API connection by sending a test email
    const { data, error } = await getResend().emails.send({
      from: 'Birthday Planner <noreply@resend.dev>',
      to: ['magicalbirthdayplanner@gmail.com'], // Use verified email for testing
      subject: 'Birthday Planner - Resend Test',
      html: '<h1>Resend API Test Successful!</h1><p>Your email integration is working properly.</p>',
      text: 'Resend API Test Successful! Your email integration is working properly.'
    });

    if (error) {
      console.error('Resend API error:', error);
      return NextResponse.json({
        success: false,
        error: 'Resend API connection failed',
        details: error.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Resend API connection successful',
      emailId: data?.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}