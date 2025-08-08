import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { generateInvitationEmail } from '@/lib/email-templates/invitation';
import { generateEmailToken } from '@/lib/email';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { 
      partyId, 
      guestIds, 
      personalMessage,
      userId 
    } = await request.json();

    if (!partyId || !guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields or empty guest list' },
        { status: 400 }
      );
    }

    // Fetch party details with user info
    const party = await prisma.party.findUnique({
      where: { id: partyId },
      include: {
        user: true,
        guests: {
          where: { id: { in: guestIds } },
        },
      },
    });

    if (!party) {
      return NextResponse.json(
        { error: 'Party not found' },
        { status: 404 }
      );
    }

    if (userId && party.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const results: Array<{
      guestId: string;
      success: boolean;
      error?: string;
      emailId?: string;
    }> = [];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Send invitation to each guest
    for (const guest of party.guests) {
      if (!guest.email) {
        results.push({
          guestId: guest.id,
          success: false,
          error: 'Guest has no email address',
        });
        continue;
      }

      try {
        // Generate or get existing RSVP token
        let invitation = await prisma.invitation.findUnique({
          where: {
            partyId_guestId: {
              partyId: party.id,
              guestId: guest.id,
            },
          },
        });

        if (!invitation) {
          const rsvpToken = generateEmailToken();
          invitation = await prisma.invitation.create({
            data: {
              partyId: party.id,
              guestId: guest.id,
              rsvpToken,
              customMessage: personalMessage,
            },
          });
        } else {
          // Update existing invitation
          invitation = await prisma.invitation.update({
            where: { id: invitation.id },
            data: {
              customMessage: personalMessage,
              status: 'PENDING',
            },
          });
        }

        // Generate RSVP URL
        const rsvpUrl = `${baseUrl}/rsvp/${invitation.rsvpToken}`;

        // Format party date and time
        const partyDate = new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(new Date(party.partyDate));

        const partyTime = party.partyTime || 'Time TBD';
        const partyLocation = party.partyLocation || 'Location TBD';

        // Generate email content
        const { html, text } = generateInvitationEmail({
          guestName: guest.name,
          hostName: party.hostName || party.user.name || 'Host',
          childName: party.childName,
          childAge: party.childAge,
          partyTheme: party.theme,
          partyDate,
          partyTime,
          partyLocation,
          rsvpUrl,
          personalMessage,
          baseUrl,
        });

        // Send invitation email
        const emailResult = await sendEmail({
          to: guest.email,
          subject: `You're Invited! ${party.childName}'s ${party.childAge}th Birthday Party 🎉`,
          html,
          text,
        });

        if (emailResult.success) {
          // Update invitation status
          await prisma.invitation.update({
            where: { id: invitation.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              emailSent: true,
              resendId: emailResult.id,
            },
          });

          // Log successful email
          await prisma.emailLog.create({
            data: {
              userId: party.userId,
              partyId: party.id,
              guestId: guest.id,
              type: 'INVITATION',
              status: 'SENT',
              to: guest.email,
              subject: `You're Invited! ${party.childName}'s ${party.childAge}th Birthday Party 🎉`,
              resendId: emailResult.id,
              sentAt: new Date(),
            },
          });

          results.push({
            guestId: guest.id,
            success: true,
            emailId: emailResult.id || undefined,
          });
        } else {
          // Update invitation with error
          await prisma.invitation.update({
            where: { id: invitation.id },
            data: {
              status: 'FAILED',
              error: emailResult.error,
            },
          });

          // Log email failure
          await prisma.emailLog.create({
            data: {
              userId: party.userId,
              partyId: party.id,
              guestId: guest.id,
              type: 'INVITATION',
              status: 'FAILED',
              to: guest.email,
              subject: `You're Invited! ${party.childName}'s ${party.childAge}th Birthday Party 🎉`,
              error: emailResult.error,
            },
          });

          results.push({
            guestId: guest.id,
            success: false,
            error: emailResult.error || undefined,
          });
        }
      } catch (error) {
        console.error(`Error sending invitation to guest ${guest.id}:`, error);
        results.push({
          guestId: guest.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Sent ${successful} invitations successfully, ${failed} failed`,
      results,
      summary: {
        total: results.length,
        successful,
        failed,
      },
    });

  } catch (error) {
    console.error('Invitation email error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}