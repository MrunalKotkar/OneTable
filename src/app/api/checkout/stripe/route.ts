import { NextResponse } from "next/server";
import { NoFeasibleRestaurantError } from "@/features/negotiation/contract";
import {
  finalRecommendationFixture,
  finalRestaurantFixture,
  sharedCheckoutItemsFixture,
} from "@/features/checkout/demo-fixtures";
import { createStripePaymentRecord } from "@/features/checkout/payment-store";
import { prepareCheckoutFromRebalance } from "@/features/checkout/simulator";
import {
  buildStripeLineItems,
  buildStripeMetadata,
  getAppUrl,
  getStripe,
  isStripeConfigured,
} from "@/features/checkout/stripe";

const GROUP_ID = "lunch-table-001";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message:
          "Stripe test keys are not configured. Simulated checkout remains available.",
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const scenario = typeof body?.scenario === "string" ? body.scenario : "ready";
  const preparation = await prepareCheckoutFromRebalance({
    rebalance: () => {
      if (scenario === "no_feasible") {
        throw new NoFeasibleRestaurantError(
          "No safe restaurant works for every active diner.",
        );
      }

      if (scenario === "stale") {
        return {
          ...finalRecommendationFixture,
          version: finalRecommendationFixture.version - 1,
        };
      }

      return finalRecommendationFixture;
    },
    latestApprovedVersion: finalRecommendationFixture.version,
    sharedItems: sharedCheckoutItemsFixture,
    now: new Date().toISOString(),
  });

  if (preparation.status === "blocked") {
    return NextResponse.json(
      {
        error: preparation.reason,
        message: preparation.message,
      },
      { status: 409 },
    );
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();
  const stripeSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: buildStripeLineItems({
      recommendation: preparation.recommendation,
      restaurant: finalRestaurantFixture,
      sharedItems: sharedCheckoutItemsFixture,
    }),
    metadata: buildStripeMetadata({
      checkoutSession: preparation.session,
      groupId: GROUP_ID,
    }),
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout/cancel?checkout_id=${preparation.session.id}`,
  });

  if (!stripeSession.url) {
    return NextResponse.json(
      {
        error: "stripe_session_missing_url",
        message: "Stripe did not return a checkout URL.",
      },
      { status: 502 },
    );
  }

  createStripePaymentRecord({
    checkoutSessionId: preparation.session.id,
    stripeSessionId: stripeSession.id,
    recommendationVersion: preparation.session.recommendationVersion,
    groupId: GROUP_ID,
    amountTotalCents: preparation.session.groupTotalCents,
  });

  return NextResponse.json({
    url: stripeSession.url,
    stripeSessionId: stripeSession.id,
    checkoutSessionId: preparation.session.id,
  });
}
