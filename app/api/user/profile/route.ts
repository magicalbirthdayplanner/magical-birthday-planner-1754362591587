import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile data from database or create if doesn't exist
    const dbUser = await prisma.user.upsert({
      where: { email: user.email! },
      update: {
        // Update name from Supabase metadata if available
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        displayName: user.user_metadata?.display_name || ''
      },
      create: {
        email: user.email!,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        displayName: user.user_metadata?.display_name || '',
        currentPlan: 'FREE',
        emailNotifications: true,
        partyReminders: true,
        marketingEmails: false
      },
      select: { 
        id: true,
        email: true,
        name: true,
        displayName: true,
        currentPlan: true,
        emailNotifications: true,
        partyReminders: true,
        marketingEmails: true,
        createdAt: true
      }
    });

    // Calculate usage statistics
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    // Get parties created this month
    const partiesThisMonth = await prisma.party.count({
      where: {
        userId: dbUser.id,
        createdAt: {
          gte: startOfMonth
        }
      }
    });

    // Get total parties created
    const totalParties = await prisma.party.count({
      where: {
        userId: dbUser.id
      }
    });

    // Get total guests this month
    const guestsThisMonth = await prisma.guest.count({
      where: {
        party: {
          userId: dbUser.id,
          createdAt: {
            gte: startOfMonth
          }
        }
      }
    });

    // Combine database data with Supabase user metadata
    const profile = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name || user.user_metadata?.name || user.email?.split('@')[0] || '',
      displayName: dbUser.displayName || user.user_metadata?.display_name || '',
      currentPlan: dbUser.currentPlan,
      emailNotifications: dbUser.emailNotifications,
      partyReminders: dbUser.partyReminders,
      marketingEmails: dbUser.marketingEmails,
      createdAt: dbUser.createdAt.toISOString(),
      usageStats: {
        partiesThisMonth,
        totalParties,
        guestsThisMonth,
        aiRequestsThisMonth: 0 // We'll implement AI request tracking later if needed
      }
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('PATCH /api/user/profile - Authentication failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestBody = await request.json();
    const { name, displayName, emailNotifications, partyReminders, marketingEmails } = requestBody;
    
    console.log('PATCH /api/user/profile - Request body:', requestBody);
    console.log('PATCH /api/user/profile - User email:', user.email);

    // Validate input
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Name must be a non-empty string' },
        { status: 400 }
      );
    }

    if (displayName !== undefined && typeof displayName !== 'string') {
      return NextResponse.json(
        { error: 'Display name must be a string' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (displayName !== undefined) updateData.displayName = displayName.trim();
    if (emailNotifications !== undefined) updateData.emailNotifications = Boolean(emailNotifications);
    if (partyReminders !== undefined) updateData.partyReminders = Boolean(partyReminders);
    if (marketingEmails !== undefined) updateData.marketingEmails = Boolean(marketingEmails);

    console.log('PATCH /api/user/profile - Update data:', updateData);

    // Update user's profile in database
    const updatedDbUser = await prisma.user.update({
      where: { email: user.email! },
      data: updateData,
      select: { 
        id: true,
        email: true,
        name: true,
        displayName: true,
        currentPlan: true,
        emailNotifications: true,
        partyReminders: true,
        marketingEmails: true,
        createdAt: true
      }
    });

    console.log('PATCH /api/user/profile - Updated user:', updatedDbUser);

    // Update user metadata in Supabase Auth only for name and displayName
    const supabaseUpdateData: any = {};
    if (name !== undefined) supabaseUpdateData.name = name.trim();
    if (displayName !== undefined) supabaseUpdateData.display_name = displayName.trim();

    if (Object.keys(supabaseUpdateData).length > 0) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: supabaseUpdateData
      });

      if (updateError) {
        console.error('Error updating Supabase user metadata:', updateError);
        // Continue even if metadata update fails, as database was updated
      }
    }

    // Return updated profile
    const profile = {
      id: updatedDbUser.id,
      email: updatedDbUser.email,
      name: updatedDbUser.name,
      displayName: updatedDbUser.displayName,
      currentPlan: updatedDbUser.currentPlan,
      emailNotifications: updatedDbUser.emailNotifications,
      partyReminders: updatedDbUser.partyReminders,
      marketingEmails: updatedDbUser.marketingEmails,
      createdAt: updatedDbUser.createdAt.toISOString()
    };

    return NextResponse.json({
      ...profile,
      success: true
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}