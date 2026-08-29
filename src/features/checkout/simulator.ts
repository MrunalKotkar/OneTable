import type { Recommendation } from "@/domain/contracts";
import { centsFromDollars } from "@/lib/money";
import { NoFeasibleRestaurantError } from "@/features/negotiation/contract";
import type {
  CheckoutPaymentTransition,
  CheckoutLineItem,
  CheckoutPreparation,
  CheckoutResult,
  CheckoutSession,
  DinerCharge,
  SharedCheckoutItem,
} from "./contract";

interface CreateCheckoutSessionInput {
  recommendation: Recommendation;
  latestApprovedVersion: number;
  sharedItems?: SharedCheckoutItem[];
  now?: string;
}

interface PayCheckoutInput {
  session: CheckoutSession;
  forceFailure?: boolean;
}

interface PrepareCheckoutInput {
  rebalance: () => Promise<Recommendation> | Recommendation;
  latestApprovedVersion: number;
  sharedItems?: SharedCheckoutItem[];
  now?: string;
}

const splitEvenly = (totalCents: number, participantIds: string[]) => {
  const sortedIds = [...participantIds].sort();
  const base = Math.floor(totalCents / sortedIds.length);
  const remainder = totalCents % sortedIds.length;

  return sortedIds.map((dinerId, index) => ({
    dinerId,
    amountCents: base + (index < remainder ? 1 : 0),
  }));
};

const addLineItem = (
  charges: Map<string, DinerCharge>,
  dinerId: string,
  lineItem: CheckoutLineItem,
) => {
  const charge = charges.get(dinerId) ?? {
    dinerId,
    lineItems: [],
    totalCents: 0,
  };

  charge.lineItems.push(lineItem);
  charge.totalCents += lineItem.amountCents;
  charges.set(dinerId, charge);
};

export const createCheckoutSession = ({
  recommendation,
  latestApprovedVersion,
  sharedItems = [],
  now = new Date().toISOString(),
}: CreateCheckoutSessionInput): CheckoutSession => {
  const charges = new Map<string, DinerCharge>();
  const recommendationTotalCents = centsFromDollars(recommendation.total);

  for (const selection of recommendation.selections) {
    addLineItem(charges, selection.dinerId, {
      id: `main-${selection.dinerId}-${selection.dishId}`,
      kind: "main",
      label: selection.dishId,
      amountCents: centsFromDollars(selection.price),
      dinerId: selection.dinerId,
    });
  }

  for (const item of sharedItems) {
    const itemTotalCents = centsFromDollars(item.price) * item.quantity;
    for (const split of splitEvenly(itemTotalCents, item.participantIds)) {
      addLineItem(charges, split.dinerId, {
        id: `shared-${item.id}-${split.dinerId}`,
        kind: "shared",
        label: item.name,
        amountCents: split.amountCents,
        dinerId: split.dinerId,
      });
    }
  }

  const dinerCharges = [...charges.values()].sort((a, b) =>
    a.dinerId.localeCompare(b.dinerId),
  );
  const sharedTotalCents = sharedItems.reduce(
    (total, item) => total + centsFromDollars(item.price) * item.quantity,
    0,
  );
  const groupTotalCents = recommendationTotalCents + sharedTotalCents;
  const reconciledTotalCents = dinerCharges.reduce(
    (total, charge) => total + charge.totalCents,
    0,
  );
  const isStale = recommendation.version !== latestApprovedVersion;
  const isReconciled = groupTotalCents === reconciledTotalCents;

  return {
    id: `checkout-v${recommendation.version}`,
    recommendationVersion: recommendation.version,
    latestApprovedVersion,
    status: "idle",
    dinerCharges,
    groupTotalCents,
    createdAt: now,
    invalidatedReason: isStale
      ? "A newer recommendation exists."
      : isReconciled
        ? null
        : "Diner charges do not match the group total.",
  };
};

export const prepareCheckoutFromRebalance = async ({
  rebalance,
  latestApprovedVersion,
  sharedItems = [],
  now,
}: PrepareCheckoutInput): Promise<CheckoutPreparation> => {
  try {
    const recommendation = await rebalance();
    const session = createCheckoutSession({
      recommendation,
      latestApprovedVersion,
      sharedItems,
      now,
    });

    if (session.invalidatedReason) {
      return {
        status: "blocked",
        reason: "invalid_recommendation",
        message: session.invalidatedReason,
        recommendation: null,
        session: null,
      };
    }

    return {
      status: "ready",
      recommendation,
      session,
    };
  } catch (error) {
    if (error instanceof NoFeasibleRestaurantError) {
      return {
        status: "blocked",
        reason: "no_feasible_restaurant",
        message: error.message,
        recommendation: null,
        session: null,
      };
    }

    return {
      status: "blocked",
      reason: "rebalance_failed",
      message:
        error instanceof Error
          ? error.message
          : "Recommendation could not be prepared.",
      recommendation: null,
      session: null,
    };
  }
};

const failCheckout = (
  session: CheckoutSession,
  failureReason: string,
): CheckoutPaymentTransition => {
  const failedSession: CheckoutSession = {
    ...session,
    status: "failed",
  };

  return {
    processingSession: failedSession,
    completedSession: failedSession,
    result: {
      recommendationVersion: session.recommendationVersion,
      status: "failed",
      failureReason,
    },
  };
};

export const simulatePayment = ({
  session,
  forceFailure = false,
}: PayCheckoutInput): CheckoutPaymentTransition => {
  if (session.status === "paid") {
    return failCheckout(session, "Payment already completed.");
  }

  if (session.status === "processing") {
    return failCheckout(session, "Payment is already processing.");
  }

  if (session.invalidatedReason) {
    return failCheckout(session, session.invalidatedReason);
  }

  const processingSession: CheckoutSession = {
    ...session,
    status: "processing",
  };

  if (forceFailure) {
    const completedSession: CheckoutSession = {
      ...processingSession,
      status: "failed",
    };

    return {
      processingSession,
      completedSession,
      result: {
        recommendationVersion: session.recommendationVersion,
        status: "failed",
        failureReason: "Simulated card decline.",
      },
    };
  }

  const completedSession: CheckoutSession = {
    ...processingSession,
    status: "paid",
  };

  return {
    processingSession,
    completedSession,
    result: {
      recommendationVersion: session.recommendationVersion,
      status: "paid",
      confirmationId: `MSF-${session.recommendationVersion}-ONETABLE`,
    },
  };
};

export const payCheckout = (input: PayCheckoutInput): CheckoutResult => {
  return simulatePayment(input).result;
};
