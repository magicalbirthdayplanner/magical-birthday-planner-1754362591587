import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies: () => [] });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { partyId, guestIds, customMessage } = await request.json();
    
    if (!partyId || !guestIds || !Array.isArray(guestIds)) {
      return NextResponse.json(
        { error: 'Party ID and guest IDs are required' },
        { status: 400 }
      );
    }

    // Verify user has access to this party
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('*')
      .eq('id', partyId)
      .eq('user_id', user.id)
      .single();

    if (partyError || !party) {
      return NextResponse.json(
        { error: 'Party not found or access denied' },
        { status: 404 }
      );
    }

    // Get guests for this party
    const { data: guests, error: guestsError } = await supabase
      .from('guests')
      .select('*')
      .eq('party_id', partyId)
      .in('id', guestIds);

    if (guestsError) {
      console.error('Error fetching guests:', guestsError);
      return NextResponse.json(
        { error: 'Failed to fetch guests' },
        { status: 500 }
      );
    }

    // Filter guests with valid email addresses
    const guestsWithEmail = guests?.filter(guest => guest.email) || [];
    
    if (guestsWithEmail.length === 0) {
      return NextResponse.json(
        { error: 'No guests with valid email addresses found' },
        { status: 400 }
      );
    }

    // Send invitations using Resend
    interface InvitationResult {
      guestId: string;
      guestName: string;
      email: string;
      success: boolean;
      error?: string;
      emailId?: string;
    }
    
    const invitationResults: InvitationResult[] = [];
    
    for (const guest of guestsWithEmail) {
      try {
        // Generate RSVP token for guest
        const rsvpToken = `${party.id}_${guest.id}_${Date.now()}`;
        
        // Create invitation HTML
        const invitationHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #e91e63; text-align: center; margin-bottom: 20px;">🎉 You're Invited! 🎉</h1>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #333; margin-bottom: 10px;">${party.child_name || 'Special Child'}'s Birthday Party!</h2>
                <p style="color: #666; font-size: 18px;">Join us for an amazing celebration!</p>
              </div>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #333; margin-top: 0;">Party Details:</h3>
                <p><strong>🎂 Birthday Child:</strong> ${party.child_name || 'Special Child'}</p>
                <p><strong>🎈 Age Turning:</strong> ${party.child_age || 'N/A'}</p>
                <p><strong>🎨 Theme:</strong> ${party.selected_theme || party.theme || 'Surprise Theme'}</p>
                <p><strong>📅 Date:</strong> ${party.party_date ? new Date(party.party_date).toLocaleDateString() : 'TBD'}</p>
                <p><strong>⏰ Time:</strong> ${party.party_time || 'TBD'}</p>
                <p><strong>📍 Location:</strong> ${party.venue || 'TBD'}</p>
                <p><strong>🎪 Duration:</strong> ${party.duration || 'TBD'}</p>
              </div>
              
              ${customMessage ? `
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                  <h4 style="color: #1976d2; margin-top: 0;">Personal Message:</h4>
                  <p style="color: #333; margin-bottom: 0;">${customMessage}</p>
                </div>
              ` : ''}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/rsvp/${rsvpToken}" 
                   style="background: #e91e63; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; margin: 0 10px 10px 0;">
                  ✅ Accept Invitation
                </a>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/rsvp/${rsvpToken}?response=decline" 
                   style="background: #666; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; margin: 0 10px 10px 0;">
                  ❌ Decline
                </a>
              </div>
              
              <div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                <p>Can't wait to celebrate with you! 🎊</p>
                <p><em>This invitation was sent from Magical Birthday Planner</em></p>
              </div>
            </div>
          </div>
        `;
        
        // Send email via Resend
        const { data, error } = await resend.emails.send({
          from: 'Birthday Party Invitations <invitations@resend.dev>',
          to: [guest.email],
          subject: `🎉 You're Invited to ${party.child_name || 'A Special'}'s Birthday Party!`,
          html: invitationHtml,
          text: `You're invited to ${party.child_name || 'a special child'}'s birthday party! Please visit ${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/rsvp/${rsvpToken} to RSVP.`
        });
        
        if (error) {
          console.error(`Failed to send invitation to ${guest.email}:`, error);
          invitationResults.push({
            guestId: guest.id,
            guestName: guest.name,
            email: guest.email,
            success: false,
            error: error.message
          });
        } else {
          console.log(`Invitation sent successfully to ${guest.email}`);
          
          // Update or create invitation record in database
          const { error: inviteError } = await supabase
            .from('invitations')
            .upsert({
              guest_id: guest.id,
              party_id: partyId,
              user_id: user.id,
              status: 'SENT',
              sent_at: new Date().toISOString(),
              token: rsvpToken,
              message: customMessage
            });
            
          if (inviteError) {
            console.error('Failed to save invitation record:', inviteError);
          }
          
          invitationResults.push({
            guestId: guest.id,
            guestName: guest.name,
            email: guest.email,
            success: true,
            emailId: data?.id
          });
        }
        
      } catch (emailError) {
        console.error(`Error sending invitation to ${guest.email}:`, emailError);
        invitationResults.push({
          guestId: guest.id,
          guestName: guest.name,
          email: guest.email,
          success: false,
          error: emailError instanceof Error ? emailError.message : 'Unknown error'
        });
      }
    }
    
    const successCount = invitationResults.filter(r => r.success).length;
    const failureCount = invitationResults.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Invitations processed: ${successCount} sent, ${failureCount} failed`,
      results: invitationResults,
      totalGuests: guestsWithEmail.length,
      successCount,
      failureCount
    });

  } catch (error) {
    console.error('Error sending invitations:', error);
    return NextResponse.json(
      { error: 'Failed to send invitations', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}