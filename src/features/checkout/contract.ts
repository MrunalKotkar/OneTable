import type { PaymentStatus, Recommendation } from "@/domain/contracts";

export interface SharedCheckoutItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  participantIds: string[];
}

export interface CheckoutLineItem {
  id: string;
  kind: "main" | "shared";
  label: string;
  amountCents: number;
  dinerId: string;
}

export interface DinerCharge {
  dinerId: string;
  lineItems: CheckoutLineItem[];
  totalCents: number;
}

export interface CheckoutSession {
  id: string;
  recommendationVersion: number;
  latestApprovedVersion: number;
  status: PaymentStatus;
  dinerCharges: DinerCharge[];
  groupTotalCents: number;
  createdAt: string;
  invalidatedReason: string | null;
}

export interface CheckoutReadyState {
  status: "ready";
  recommendation: Recommendation;
  session: CheckoutSession;
}

export interface CheckoutBlockedState {
  status: "blocked";
  reason:
    | "no_feasible_restaurant"
    | "rebalance_failed"
    | "invalid_recommendation";
  message: string;
  recommendation: null;
  session: null;
}

export type CheckoutPreparation = CheckoutReadyState | CheckoutBlockedState;

export interface CheckoutResult {
  recommendationVersion: number;
  status: PaymentStatus;
  confirmationId?: string;
  failureReason?: string;
}

export interface CheckoutPaymentTransition {
  processingSession: CheckoutSession;
  completedSession: CheckoutSession;
  result: CheckoutResult;
}

export interface CheckoutGateway {
  pay(recommendation: Recommendation): Promise<CheckoutResult>;
}
