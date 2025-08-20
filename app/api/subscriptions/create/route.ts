"use server";

import { NextRequest, NextResponse } from 'next/server';
import { getDodoPaymentsClient, SUBSCRIPTION_PLANS } from '@/lib/dodo-payments';
import { createClient } from '@supabase/supabase-js';
import { retryWithExponentialBackoff } from '@/lib/db-utils';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { planType, userId, userEmail, userName } = await request.json();

    if (!planType || !userId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: planType, userId, userEmail' },
        { status: 400 }
      );
    }

    // Validate plan type
    if (!SUBSCRIPTION_PLANS[planType as keyof typeof SUBSCRIPTION_PLANS]) {
      return NextResponse.json(
        { error: 'Invalid plan type' },
        { status: 400 }
      );
    }

    const plan = SUBSCRIPTION_PLANS[planType as keyof typeof SUBSCRIPTION_PLANS];
    const dodoClient = getDodoPaymentsClient();

    if (!dodoClient) {
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 500 }
      );
    }

    // Get base URL for callback URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Create subscription with DoDo Payments
    const subscriptionResult = await dodoClient.createSubscription({
      customer_email: userEmail,
      customer_name: userName || userEmail.split('@')[0],
      plan_id: plan.id,
      success_url: `${baseUrl}/account?subscription=success`,
      cancel_url: `${baseUrl}/pricing?subscription=cancelled`,
      metadata: {
        userId,
        planType,
        source: 'magical_birthday_planner'
      }
    });

    if (!subscriptionResult.success || !subscriptionResult.data) {
      console.error('DoDo Payments subscription creation failed:', subscriptionResult.error);
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 }
      );
    }

    // Store subscription in database with retry logic
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const saveSubscription = async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .upsert({
          userId,
          planType,
          status: 'INCOMPLETE',
          stripeSubscriptionId: subscriptionResult.data!.id,
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancelAtPeriodEnd: false,
          updatedAt: new Date().toISOString()
        }, {
          onConflict: 'userId'
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    };

    try {
      await retryWithExponentialBackoff(saveSubscription);
    } catch (dbError) {
      console.error('Failed to save subscription to database:', dbError);
      // Note: Subscription was created in DoDo Payments but failed to save to DB
      // This should be handled by webhook later
    }

    return NextResponse.json({
      success: true,
      subscription: subscriptionResult.data,
      checkoutUrl: (subscriptionResult.data as any)?.url || (subscriptionResult.data as any)?.checkout_url
    });

  } catch (error) {
    console.error('Subscription creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}