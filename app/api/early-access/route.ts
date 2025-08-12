import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { email, source = 'landing_page' } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Try to create the early access entry
    try {
      const earlyAccessEntry = await prisma.earlyAccess.create({
        data: {
          email: email.toLowerCase().trim(),
          source,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Email successfully added to early access list',
        id: earlyAccessEntry.id,
      });
    } catch (error: any) {
      // Handle unique constraint violation (email already exists)
      if (error.code === 'P2002') {
        return NextResponse.json({
          success: true,
          message: 'Email already registered for early access',
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error saving early access email:', error);
    return NextResponse.json(
      { error: 'Failed to save email. Please try again.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET() {
  try {
    const count = await prisma.earlyAccess.count();
    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error getting early access count:', error);
    return NextResponse.json(
      { error: 'Failed to get count' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}