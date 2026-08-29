import Stripe from "stripe";
import type { Recommendation, Restaurant } from "@/domain/contracts";
import { centsFromDollars } from "@/lib/money";
import type { CheckoutSession, SharedCheckoutItem } from "./contract";

interface StripeLineItemInput {
  recommendation: Recommendation;
  restaurant: Restaurant;
  sharedItems: SharedCheckoutItem[];
}

export const isStripeConfigured = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_APP_URL);

export const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  return new Stripe(secretKey);
};

export const getAppUrl = () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not configured.");
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
  checkoutSession,
  groupId,
}: {
  checkoutSession: CheckoutSession;
  groupId: string;
}): Stripe.MetadataParam => ({
  checkoutSessionId: checkoutSession.id,
  recommendationVersion: String(checkoutSession.recommendationVersion),
  groupId,
  source: "onetable",
});
