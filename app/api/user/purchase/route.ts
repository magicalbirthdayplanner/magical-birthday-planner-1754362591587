import { NextResponse } from 'next/server';

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

/**
 * Retired. This endpoint used to record a purchase and set the user's plan from
 * values sent by the browser (plan, transaction id) with no payment verification,
 * so anyone could grant themselves a paid plan by visiting /checkout-success?plan=PRO.
 *
 * Purchases must be confirmed server-to-server by the payment provider's signed
 * webhook (app/api/webhooks/dodo), which updates entitlements with the service role.
 * See docs/BILLING_SECURITY.md.
 */
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Purchases are confirmed by the payment provider, not by the app.' },
    { status: 410 },
  );
}
