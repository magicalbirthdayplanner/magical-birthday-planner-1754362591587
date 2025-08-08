import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { generateWelcomeEmail } from '@/lib/email-templates/welcome';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if welcome email already sent
    if (user.onboardingSent) {
      return NextResponse.json({
        success: true,
        message: 'Welcome email already sent',
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Generate welcome email content
    const { html, text } = generateWelcomeEmail({
      name: user.name || 'there',
      baseUrl,
    });

    // Send welcome email
    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Welcome to Magical Birthday Planner! 🎉',
      html,
      text,
    });

    if (!emailResult.success) {
      // Log email failure
      await prisma.emailLog.create({
        data: {
          userId: user.id,
          type: 'WELCOME',
          status: 'FAILED',
          to: user.email,
          subject: 'Welcome to Magical Birthday Planner! 🎉',
          error: emailResult.error,
        },
      });

      return NextResponse.json(
        { error: 'Failed to send welcome email' },
        { status: 500 }
      );
    }

    // Update user record to mark onboarding as sent
    await prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingSent: true,
      },
    });

    // Log successful email
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        type: 'WELCOME',
        status: 'SENT',
        to: user.email,
        subject: 'Welcome to Magical Birthday Planner! 🎉',
        resendId: emailResult.id,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Welcome email sent successfully',
      emailId: emailResult.id,
    });

  } catch (error) {
    console.error('Welcome email error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}