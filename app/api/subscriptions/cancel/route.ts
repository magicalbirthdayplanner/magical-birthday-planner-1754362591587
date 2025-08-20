"use server";

import { NextRequest, NextResponse } from 'next/server';
import { getDodoPaymentsClient } from '@/lib/dodo-payments';
import { createClient } from '@supabase/supabase-js';
import { retryWithExponentialBackoff } from '@/lib/db-utils';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { userId, immediately = false } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Get user's current subscription
    const getSubscription = async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('userId', userId)
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    };

    let subscription;
    try {
      subscription = await retryWithExponentialBackoff(getSubscription);
    } catch (error) {
      console.error('Failed to get subscription from database:', error);
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (!subscription.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    const dodoClient = getDodoPaymentsClient();

    if (!dodoClient) {
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 500 }
      );
    }

    // Cancel subscription with DoDo Payments
    const cancelResult = await dodoClient.cancelSubscription(
      subscription.stripeSubscriptionId,
      immediately
    );

    if (!cancelResult.success) {
      console.error('DoDo Payments subscription cancellation failed:', cancelResult.error);
      return NextResponse.json(
        { error: 'Failed to cancel subscription' },
        { status: 500 }
      );
    }

    // Update subscription in database
    const updateSubscription = async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .update({
          status: immediately ? 'CANCELED' : 'ACTIVE',
          cancelAtPeriodEnd: !immediately,
          updatedAt: new Date().toISOString()
        })
        .eq('userId', userId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    };

    try {
      await retryWithExponentialBackoff(updateSubscription);
    } catch (dbError) {
      console.error('Failed to update subscription in database:', dbError);
      // Subscription was cancelled in DoDo Payments but failed to update in DB
      // This should be handled by webhook later
    }

    return NextResponse.json({
      success: true,
      subscription: cancelResult.data,
      message: immediately 
        ? 'Subscription cancelled immediately' 
        : 'Subscription will be cancelled at the end of the current period'
    });

  } catch (error) {
    console.error('Subscription cancellation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}