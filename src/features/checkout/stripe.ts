import Stripe from "stripe";
import type { Recommendation, Restaurant } from "@/domain/contracts";
import { centsFromDollars } from "@/lib/money";
import type { SharedCheckoutItem } from "./contract";

interface StripeLineItemInput {
  recommendation: Recommendation;
  restaurant: Restaurant;
  sharedItems: SharedCheckoutItem[];
}

export const isStripeConfigured = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.APP_URL);

/**
 * Test-mode-only, enforced: this app never handles real money, so a
 * `sk_live_` key is always a mistake (a leaked/misconfigured production
 * key pasted into the wrong place) rather than something to honor.
 */
export const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  if (secretKey.startsWith("sk_live_")) {
    throw new Error(
      "STRIPE_SECRET_KEY is a live-mode key (sk_live_...). This app only ever runs against Stripe test mode — use an sk_test_ key.",
    );
  }

  return new Stripe(secretKey);
};

/**
 * Server-only — this is the app's own base URL, used to build Stripe's
 * success_url/cancel_url. It never runs in the browser, so it's plain
 * `APP_URL`, not `NEXT_PUBLIC_APP_URL`: the NEXT_PUBLIC_ prefix tells
 * Next.js to inline the value into the client JS bundle, which this value
 * never needs and Vercel rightly flags as an unnecessary exposure.
 */
export const getAppUrl = () => {
  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    throw new Error("APP_URL is not configured.");
  }

  return appUrl.replace(/\/$/, "");
};

export const buildStripeLineItems = ({
  recommendation,
  restaurant,
  sharedItems,
}: StripeLineItemInput): Stripe.Checkout.SessionCreateParams.LineItem[] => {
  const dishNameById = new Map(
    restaurant.menu.map((dish) => [dish.id, dish.name]),
  );

  const dinerLineItems = recommendation.selections.map((selection) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: dishNameById.get(selection.dishId) ?? selection.dishId,
        description: selection.reason,
      },
      unit_amount: centsFromDollars(selection.price),
    },
    quantity: 1,
  }));

  const sharedLineItems = sharedItems.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: item.name,
        description: `Shared by ${item.participantIds.length} diners`,
      },
      unit_amount: centsFromDollars(item.price),
    },
    quantity: item.quantity,
  }));

  return [...dinerLineItems, ...sharedLineItems];
};

export const buildStripeMetadata = ({
  checkoutSessionId,
  recommendationVersion,
  groupId,
  tableId,
}: {
  checkoutSessionId: string;
  recommendationVersion: number;
  groupId: string;
  tableId: string;
}): Stripe.MetadataParam => ({
  checkoutSessionId,
  recommendationVersion: String(recommendationVersion),
  groupId,
  tableId,
  source: "onetable",
});
