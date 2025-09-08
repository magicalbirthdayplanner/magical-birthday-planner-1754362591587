import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { plan, purchaseDate, transactionId, sessionId } = body;

    // Validate required fields
    if (!plan || !purchaseDate) {
      return NextResponse.json(
        { error: 'Plan and purchase date are required' },
        { status: 400 }
      );
    }

    // Insert purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('user_purchases')
      .insert([
        {
          user_id: user.id,
          plan_type: plan,
          purchase_date: purchaseDate,
          transaction_id: transactionId,
          session_id: sessionId,
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (purchaseError) {
      console.error('Error saving purchase:', purchaseError);
      // Don't fail the request if database save fails
      return NextResponse.json(
        { 
          success: true, 
          message: 'Purchase processed but not saved to database',
          error: purchaseError.message 
        },
        { status: 200 }
      );
    }

    // Update user profile with current plan
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        subscription_plan: plan,
        subscription_status: 'ACTIVE',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user profile:', updateError);
    }

    return NextResponse.json(
      { 
        success: true, 
        purchase: purchase,
        message: 'Purchase saved successfully' 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in purchase API:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'Purchase may still be valid even if this fails'
      },
      { status: 200 } // Return 200 so it doesn't block the checkout process
    );
  }
}