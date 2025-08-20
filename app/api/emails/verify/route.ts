import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { generateVerificationEmail } from '@/lib/email-templates/verification';
import { generateEmailToken } from '@/lib/email';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { userId, email, name } = await request.json();

    if (!userId || !email || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate verification token
    const token = generateEmailToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store verification token
    await prisma.emailVerificationToken.upsert({
      where: { userId },
      update: {
        token,
        expiresAt,
      },
      create: {
        userId,
        token,
        expiresAt,
      },
    });

    // Generate verification URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${token}`;

    // Generate email content
    const { html, text } = generateVerificationEmail({
      name,
      verificationUrl,
      baseUrl,
    });

    // Send verification email
    const emailResult = await sendEmail({
      to: email,
      subject: 'Verify Your Email - Magical Birthday Planner',
      html,
      text,
    });

    if (!emailResult.success) {
      // Log email failure
      await prisma.emailLog.create({
        data: {
          userId,
          type: 'VERIFICATION',
          status: 'FAILED',
          to: email,
          subject: 'Verify Your Email - Magical Birthday Planner',
          error: emailResult.error,
        },
      });

      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    // Log successful email
    await prisma.emailLog.create({
      data: {
        userId,
        type: 'VERIFICATION',
        status: 'SENT',
        to: email,
        subject: 'Verify Your Email - Magical Birthday Planner',
        resendId: emailResult.id,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully',
    });

  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}