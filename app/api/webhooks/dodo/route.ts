"use server";

import { NextRequest, NextResponse } from 'next/server';
import { safeJson } from '@/lib/server/safe-json';
import { getDodoPaymentsClient } from '@/lib/dodo-payments';
import { createClient } from '@supabase/supabase-js';
import { retryWithExponentialBackoff } from '@/lib/db-utils';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface DodoWebhookEvent {
  id: string;
  type: string;
  data: {
    id: string;
    object: string;
    customer_id?: string;
    status?: string;
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
    metadata?: Record<string, any>;
    amount?: number;
    currency?: string;
    invoice_id?: string;
    paid_at?: string;
  };
  created_at: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('dodo-signature') || '';

    const dodoClient = getDodoPaymentsClient();
    
    if (!dodoClient) {
      console.error('DoDo Payments client not configured');
      return safeJson({ error: 'Payment gateway not configured' }, { status: 500 });
    }

    // Verify webhook signature
    if (!dodoClient.verifyWebhook(body, signature)) {
      console.error('Invalid webhook signature');
      return safeJson({ error: 'Invalid signature' }, { status: 401 });
    }

    const event: DodoWebhookEvent = JSON.parse(body);
    console.log('Received DoDo webhook:', event.type, event.id);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    switch (event.type) {
      case 'subscription.created':
      case 'subscription.updated':
        await handleSubscriptionEvent(supabase, event);
        break;

      case 'subscription.cancelled':
        await handleSubscriptionCancellation(supabase, event);
        break;

      case 'payment.succeeded':
        await handlePaymentSuccess(supabase, event);
        break;

      case 'payment.failed':
        await handlePaymentFailure(supabase, event);
        break;

      case 'invoice.created':
      case 'invoice.updated':
        await handleInvoiceEvent(supabase, event);
        break;

      default:
        console.log('Unhandled webhook type:', event.type);
    }

    return safeJson({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return safeJson(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleSubscriptionEvent(supabase: any, event: DodoWebhookEvent) {
  const { data } = event;
  const userId = data.metadata?.userId;

  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  const updateSubscription = async () => {
    const subscriptionData = {
      userId,
      planType: data.metadata?.planType || 'STARTER',
      status: mapSubscriptionStatus(data.status || 'active'),
      stripeSubscriptionId: data.id,
      currentPeriodStart: data.current_period_start ? new Date(data.current_period_start).toISOString() : new Date().toISOString(),
      currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end).toISOString() : null,
      cancelAtPeriodEnd: data.cancel_at_period_end || false,
      updatedAt: new Date().toISOString()
    };

    const { error } = await supabase
      .from('subscriptions')
      .upsert(subscriptionData, { onConflict: 'userId' });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  };

  try {
    await retryWithExponentialBackoff(updateSubscription);
    console.log('Subscription updated successfully for user:', userId);
  } catch (error) {
    console.error('Failed to update subscription:', error);
  }
}

async function handleSubscriptionCancellation(supabase: any, event: DodoWebhookEvent) {
  const { data } = event;
  const userId = data.metadata?.userId;

  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  const cancelSubscription = async () => {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'CANCELED',
        cancelAtPeriodEnd: true,
        updatedAt: new Date().toISOString()
      })
      .eq('stripeSubscriptionId', data.id);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  };

  try {
    await retryWithExponentialBackoff(cancelSubscription);
    console.log('Subscription cancelled successfully for user:', userId);
  } catch (error) {
    console.error('Failed to cancel subscription:', error);
  }
}

async function handlePaymentSuccess(supabase: any, event: DodoWebhookEvent) {
  const { data } = event;
  
  if (data.invoice_id) {
    const updateInvoice = async () => {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'PAID',
          paidAt: data.paid_at ? new Date(data.paid_at).toISOString() : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .eq('stripeInvoiceId', data.invoice_id);

      if (error) {
        console.error('Failed to update invoice status:', error);
      }
    };

    try {
      await retryWithExponentialBackoff(updateInvoice);
      console.log('Invoice payment recorded successfully:', data.invoice_id);
    } catch (error) {
      console.error('Failed to record invoice payment:', error);
    }
  }
}

async function handlePaymentFailure(supabase: any, event: DodoWebhookEvent) {
  const { data } = event;
  
  if (data.invoice_id) {
    const updateInvoice = async () => {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'FAILED',
          updatedAt: new Date().toISOString()
        })
        .eq('stripeInvoiceId', data.invoice_id);

      if (error) {
        console.error('Failed to update invoice status:', error);
      }
    };

    try {
      await retryWithExponentialBackoff(updateInvoice);
      console.log('Invoice payment failure recorded:', data.invoice_id);
    } catch (error) {
      console.error('Failed to record invoice payment failure:', error);
    }
  }
}

async function handleInvoiceEvent(supabase: any, event: DodoWebhookEvent) {
  const { data } = event;
  const userId = data.metadata?.userId;
  
  if (!userId) {
    console.error('No userId in invoice metadata');
    return;
  }

  const upsertInvoice = async () => {
    const invoiceData = {
      userId,
      amount: (data.amount || 0) / 100, // Convert from cents
      currency: data.currency || 'USD',
      status: mapInvoiceStatus(data.status || 'pending'),
      invoiceNumber: data.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      stripeInvoiceId: data.id,
      updatedAt: new Date().toISOString()
    };

    const { error } = await supabase
      .from('invoices')
      .upsert(invoiceData, { onConflict: 'stripeInvoiceId' });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  };

  try {
    await retryWithExponentialBackoff(upsertInvoice);
    console.log('Invoice updated successfully:', data.id);
  } catch (error) {
    console.error('Failed to update invoice:', error);
  }
}

function mapSubscriptionStatus(dodoStatus: string): 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'TRIALING' | 'UNPAID' {
  switch (dodoStatus.toLowerCase()) {
    case 'active':
      return 'ACTIVE';
    case 'cancelled':
    case 'canceled':
      return 'CANCELED';
    case 'past_due':
      return 'PAST_DUE';
    case 'incomplete':
      return 'INCOMPLETE';
    case 'incomplete_expired':
      return 'INCOMPLETE_EXPIRED';
    case 'trialing':
      return 'TRIALING';
    case 'unpaid':
      return 'UNPAID';
    default:
      return 'ACTIVE';
  }
}

function mapInvoiceStatus(dodoStatus: string): 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' {
  switch (dodoStatus.toLowerCase()) {
    case 'paid':
      return 'PAID';
    case 'failed':
      return 'FAILED';
    case 'cancelled':
    case 'canceled':
      return 'CANCELED';
    case 'pending':
    default:
      return 'PENDING';
  }
}