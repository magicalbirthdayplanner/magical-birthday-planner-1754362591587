import { NextRequest, NextResponse } from 'next/server';
import { safeJson } from '@/lib/server/safe-json';
import { createServerComponentClient } from '@/lib/supabase';

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    
    if (!token) {
      return safeJson(
        { error: 'RSVP token is required' },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies: () => [] });
    
    // Get invitation details
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select(`
        *,
        parties (*),
        guests (*)
      `)
      .eq('token', token)
      .single();

    if (invitationError || !invitation) {
      return safeJson(
        { error: 'Invalid RSVP token' },
        { status: 404 }
      );
    }

    // Check if invitation has expired (24 hours)
    const invitationDate = new Date(invitation.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - invitationDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      return safeJson(
        { error: 'RSVP token has expired' },
        { status: 410 }
      );
    }

    return safeJson({
      success: true,
      invitation: {
        id: invitation.id,
        party: invitation.parties,
        guest: invitation.guests,
        status: invitation.status,
        token: invitation.token
      }
    });

  } catch (error) {
    console.error('Error fetching RSVP invitation:', error);
    return safeJson(
      { error: 'Failed to fetch RSVP invitation' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    const { status, dietaryRestrictions, notes } = await request.json();
    
    if (!token || !status) {
      return safeJson(
        { error: 'RSVP token and status are required' },
        { status: 400 }
      );
    }

    if (!['CONFIRMED', 'DECLINED', 'MAYBE'].includes(status)) {
      return safeJson(
        { error: 'Invalid RSVP status' },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies: () => [] });
    
    // Get invitation details
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select(`
        *,
        parties (*),
        guests (*)
      `)
      .eq('token', token)
      .single();

    if (invitationError || !invitation) {
      return safeJson(
        { error: 'Invalid RSVP token' },
        { status: 404 }
      );
    }

    // Update guest RSVP status
    const { data: updatedGuest, error: guestUpdateError } = await supabase
      .from('guests')
      .update({
        rsvp_status: status,
        dietary_restrictions: dietaryRestrictions || null,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', invitation.guest_id)
      .select()
      .single();

    if (guestUpdateError) {
      console.error('Error updating guest RSVP:', guestUpdateError);
      return safeJson(
        { error: 'Failed to update RSVP status' },
        { status: 500 }
      );
    }

    // Update invitation response timestamp
    await supabase
      .from('invitations')
      .update({
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', invitation.id);

    return safeJson({
      success: true,
      message: 'RSVP updated successfully',
      guest: updatedGuest
    });

  } catch (error) {
    console.error('Error updating RSVP:', error);
    return safeJson(
      { error: 'Failed to update RSVP' },
      { status: 500 }
    );
  }
}
