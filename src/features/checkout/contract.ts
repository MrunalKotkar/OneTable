import type { PaymentStatus, Recommendation } from "@/domain/contracts";

export interface CheckoutResult {
  recommendationVersion: number;
  status: PaymentStatus;
  confirmationId?: string;
}

export interface CheckoutGateway {
  pay(recommendation: Recommendation): Promise<CheckoutResult>;
}

