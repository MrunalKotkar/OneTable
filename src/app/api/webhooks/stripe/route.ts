import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/features/checkout/stripe";
import { confirmStripePayment } from "@/server/table-store";

/**
 * Resolves tableId/checkoutSessionId from Stripe metadata and marks that
 * specific table's payment paid/failed (Phase 6 of
 * PRODUCTION_REBUILD_PLAN.md) — replaces the old handler, which updated
 * the now-deleted payment-store.ts map, entirely disconnected from any
 * real table.
 *
 * Not behind the auth proxy (see src/auth.config.ts's publicPaths) —
 * Stripe calls this directly, with no session cookie, only its own
 * signature.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const checkoutSessionId = session.metadata?.checkoutSessionId;
    if (checkoutSessionId) {
      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
      await confirmStripePayment(checkoutSessionId, {
        status: "paid",
        stripeSessionId: session.id,
        confirmationId: paymentIntentId,
      });
    }
  }

  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object;
    const checkoutSessionId = session.metadata?.checkoutSessionId;
    if (checkoutSessionId) {
      await confirmStripePayment(checkoutSessionId, {
        status: "failed",
        stripeSessionId: session.id,
        failureReason:
          event.type === "checkout.session.expired"
            ? "Stripe Checkout session expired."
            : "Stripe payment failed.",
      });
    }
  }

  return NextResponse.json({ received: true });
}
