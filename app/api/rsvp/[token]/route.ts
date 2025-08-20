import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { generateRSVPConfirmationEmail } from '@/lib/email-templates/rsvp-confirmation';

const prisma = new PrismaClient();

// GET - Get RSVP details by token
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { error: 'RSVP token is required' },
        { status: 400 }
      );
    }

    // Find invitation by RSVP token
    const invitation = await prisma.invitation.findUnique({
      where: { rsvpToken: token },
      include: {
        guest: true,
        party: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid RSVP link' },
        { status: 404 }
      );
    }

    // Format party details for response
    const partyDate = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(invitation.party.partyDate));

    return NextResponse.json({
      success: true,
      rsvp: {
        guestName: invitation.guest.name,
        childName: invitation.party.childName,
        childAge: invitation.party.childAge,
        partyTheme: invitation.party.theme,
        partyDate,
        partyTime: invitation.party.partyTime || 'Time TBD',
        partyLocation: invitation.party.partyLocation || 'Location TBD',
        hostName: invitation.party.hostName || invitation.party.user.name || 'Host',
        currentStatus: invitation.status,
        customMessage: invitation.customMessage,
      },
    });

  } catch (error) {
    console.error('RSVP GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST - Submit RSVP response
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const { status, notes } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'RSVP token is required' },
        { status: 400 }
      );
    }

    if (!status || !['ACCEPTED', 'DECLINED', 'MAYBE'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid RSVP status is required (ACCEPTED, DECLINED, MAYBE)' },
        { status: 400 }
      );
    }

    // Find invitation by RSVP token
    const invitation = await prisma.invitation.findUnique({
      where: { rsvpToken: token },
      include: {
        guest: true,
        party: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid RSVP link' },
        { status: 404 }
      );
    }

    const now = new Date();

    // Update invitation with response
    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: status as any,
        respondedAt: now,
        notes: notes || null,
      },
    });

    // Format party details
    const partyDate = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(invitation.party.partyDate));

    // Send confirmation email if guest has email
    if (invitation.guest.email) {
      const { html, text } = generateRSVPConfirmationEmail({
        guestName: invitation.guest.name,
        childName: invitation.party.childName,
        partyDate,
        partyTime: invitation.party.partyTime || 'Time TBD',
        partyLocation: invitation.party.partyLocation || 'Location TBD',
        rsvpStatus: status.toLowerCase() as 'accepted' | 'declined' | 'maybe',
        hostName: invitation.party.hostName || invitation.party.user.name || 'Host',
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      });

      const emailResult = await sendEmail({
        to: invitation.guest.email,
        subject: `RSVP Confirmation - ${invitation.party.childName}'s Birthday Party`,
        html,
        text,
      });

      if (emailResult.success) {
        // Log successful confirmation email
        await prisma.emailLog.create({
          data: {
            userId: invitation.party.userId,
            partyId: invitation.party.id,
            guestId: invitation.guest.id,
            type: 'RSVP_CONFIRMATION',
            status: 'SENT',
            to: invitation.guest.email,
            subject: `RSVP Confirmation - ${invitation.party.childName}'s Birthday Party`,
            resendId: emailResult.id,
            sentAt: now,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `RSVP ${status.toLowerCase()} recorded successfully`,
      rsvp: {
        status: updatedInvitation.status,
        respondedAt: updatedInvitation.respondedAt,
        guestName: invitation.guest.name,
        partyDetails: {
          childName: invitation.party.childName,
          partyDate,
          partyTime: invitation.party.partyTime || 'Time TBD',
        },
      },
    });

  } catch (error) {
    console.error('RSVP POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}