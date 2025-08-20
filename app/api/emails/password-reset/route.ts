import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { generatePasswordResetEmail } from '@/lib/email-templates/password-reset';
import { generateEmailToken } from '@/lib/email';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // For security, we don't reveal if user exists or not
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Generate reset token
    const token = generateEmailToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store password reset token
    await prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      update: {
        token,
        expiresAt,
      },
      create: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Update user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetRequested: true,
        passwordResetAt: new Date(),
      },
    });

    // Generate reset URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    // Generate email content
    const { html, text } = generatePasswordResetEmail({
      name: user.name || 'there',
      resetUrl,
      baseUrl,
      expiresInHours: 1,
    });

    // Send password reset email
    const emailResult = await sendEmail({
      to: email,
      subject: 'Reset Your Password - Magical Birthday Planner',
      html,
      text,
    });

    if (!emailResult.success) {
      // Log email failure
      await prisma.emailLog.create({
        data: {
          userId: user.id,
          type: 'PASSWORD_RESET',
          status: 'FAILED',
          to: email,
          subject: 'Reset Your Password - Magical Birthday Planner',
          error: emailResult.error,
        },
      });

      return NextResponse.json(
        { error: 'Failed to send password reset email' },
        { status: 500 }
      );
    }

    // Log successful email
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        status: 'SENT',
        to: email,
        subject: 'Reset Your Password - Magical Birthday Planner',
        resendId: emailResult.id,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}