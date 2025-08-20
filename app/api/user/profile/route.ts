import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { prisma, connectToPrisma } from '@/lib/prisma';

export async function GET(): Promise<NextResponse> {
  try {
    // Add timeout wrapper for entire operation
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 8000)
    );

    const operationPromise = async () => {
      const supabase = createServerComponentClient({ cookies });
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Test database connection before proceeding
      const isConnected = await connectToPrisma();
      if (!isConnected) {
        console.error('Failed to connect to database');
        return NextResponse.json(
          { error: 'Database connection failed' },
          { status: 503 }
        );
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

      // Calculate usage statistics with error handling
      let usageStats = {
        partiesThisMonth: 0,
        totalParties: 0,
        guestsThisMonth: 0,
        aiRequestsThisMonth: 0
      };

      try {
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        // Execute all counts in parallel with individual error handling
        const [partiesThisMonth, totalParties, guestsThisMonth] = await Promise.allSettled([
          prisma.party.count({
            where: {
              userId: dbUser.id,
              createdAt: { gte: startOfMonth }
            }
          }),
          prisma.party.count({
            where: { userId: dbUser.id }
          }),
          prisma.guest.count({
            where: {
              party: {
                userId: dbUser.id,
                createdAt: { gte: startOfMonth }
              }
            }
          })
        ]);

        usageStats = {
          partiesThisMonth: partiesThisMonth.status === 'fulfilled' ? partiesThisMonth.value : 0,
          totalParties: totalParties.status === 'fulfilled' ? totalParties.value : 0,
          guestsThisMonth: guestsThisMonth.status === 'fulfilled' ? guestsThisMonth.value : 0,
          aiRequestsThisMonth: 0
        };
      } catch (statsError) {
        console.error('Error calculating usage stats:', statsError);
        // Continue with default stats if calculations fail
      }

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
        usageStats
      };

      return NextResponse.json(profile);
    };

    // Race between operation and timeout
    const result = await Promise.race([operationPromise(), timeoutPromise]);
    return result as NextResponse;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    
    // Enhanced error categorization
    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: 'Request timeout - please try again' },
        { status: 408 }
      );
    }
    
    if ((error as any).code === 'P1001' || (error as any).code === 'P1008' || (error as any).code === 'P1009') {
      return NextResponse.json(
        { error: 'Database connection issue - please try again' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Add timeout wrapper for PATCH operation
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 8000)
    );

    const operationPromise = async () => {
      const supabase = createServerComponentClient({ cookies });
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error('PATCH /api/user/profile - Authentication failed:', authError);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Test database connection before proceeding
      const isConnected = await connectToPrisma();
      if (!isConnected) {
        console.error('PATCH /api/user/profile - Failed to connect to database');
        return NextResponse.json(
          { error: 'Database connection failed' },
          { status: 503 }
        );
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
        try {
          const { error: updateError } = await supabase.auth.updateUser({
            data: supabaseUpdateData
          });

          if (updateError) {
            console.error('Error updating Supabase user metadata:', updateError);
            // Continue even if metadata update fails, as database was updated
          }
        } catch (metadataError) {
          console.error('Supabase metadata update failed:', metadataError);
          // Continue with database update success
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
    };

    // Race between operation and timeout
    const result = await Promise.race([operationPromise(), timeoutPromise]);
    return result as NextResponse;
  } catch (error) {
    console.error('Error updating user profile:', error);
    
    // Enhanced error categorization
    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: 'Request timeout - please try again' },
        { status: 408 }
      );
    }
    
    if ((error as any).code === 'P1001' || (error as any).code === 'P1008' || (error as any).code === 'P1009') {
      return NextResponse.json(
        { error: 'Database connection issue - please try again' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}