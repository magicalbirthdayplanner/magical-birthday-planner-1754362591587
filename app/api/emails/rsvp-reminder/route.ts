import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { generateRSVPReminderEmail } from '@/lib/email-templates/rsvp-confirmation';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { partyId, guestIds, userId } = await request.json();

    if (!partyId || !guestIds || !Array.isArray(guestIds)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch party with guests and invitations
    const party = await prisma.party.findUnique({
      where: { id: partyId },
      include: {
        user: true,
        guests: {
          where: { 
            id: { in: guestIds },
            email: { not: null },
          },
        },
        invitations: {
          where: {
            guestId: { in: guestIds },
            status: { in: ['PENDING', 'SENT', 'DELIVERED', 'OPENED'] },
          },
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
    const now = new Date();
    const partyDate = new Date(party.partyDate);
    const daysUntilParty = Math.ceil((partyDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Send reminders to pending guests
    for (const guest of party.guests) {
      const invitation = party.invitations.find(inv => inv.guestId === guest.id);
      
      if (!invitation) {
        results.push({
          guestId: guest.id,
          success: false,
          error: 'No invitation found for guest',
        });
        continue;
      }

      try {
        // Generate RSVP URL
        const rsvpUrl = `${baseUrl}/rsvp/${invitation.rsvpToken}`;

        // Format party date
        const partyDateFormatted = new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(partyDate);

        // Generate reminder email content
        const { html, text } = generateRSVPReminderEmail({
          guestName: guest.name,
          childName: party.childName,
          childAge: party.childAge,
          partyDate: partyDateFormatted,
          partyTime: party.partyTime || 'Time TBD',
          rsvpUrl,
          daysUntilParty,
          hostName: party.hostName || party.user.name || 'Host',
          baseUrl,
        });

        // Send reminder email
        const emailResult = await sendEmail({
          to: guest.email!,
          subject: `RSVP Reminder - ${party.childName}'s Birthday Party 🎉`,
          html,
          text,
        });

        if (emailResult.success) {
          // Update invitation reminder count and timestamp
          await prisma.invitation.update({
            where: { id: invitation.id },
            data: {
              reminderCount: invitation.reminderCount + 1,
              lastReminderAt: now,
            },
          });

          // Log successful email
          await prisma.emailLog.create({
            data: {
              userId: party.userId,
              partyId: party.id,
              guestId: guest.id,
              type: 'RSVP_REMINDER',
              status: 'SENT',
              to: guest.email!,
              subject: `RSVP Reminder - ${party.childName}'s Birthday Party 🎉`,
              resendId: emailResult.id,
              sentAt: now,
            },
          });

          results.push({
            guestId: guest.id,
            success: true,
            emailId: emailResult.id || undefined,
          });
        } else {
          // Log email failure
          await prisma.emailLog.create({
            data: {
              userId: party.userId,
              partyId: party.id,
              guestId: guest.id,
              type: 'RSVP_REMINDER',
              status: 'FAILED',
              to: guest.email!,
              subject: `RSVP Reminder - ${party.childName}'s Birthday Party 🎉`,
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
        console.error(`Error sending reminder to guest ${guest.id}:`, error);
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
      message: `Sent ${successful} RSVP reminders successfully, ${failed} failed`,
      results,
      summary: {
        total: results.length,
        successful,
        failed,
      },
    });

  } catch (error) {
    console.error('RSVP reminder error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}