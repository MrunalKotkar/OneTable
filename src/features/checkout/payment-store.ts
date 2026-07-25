export type StripePaymentStatus = "created" | "paid" | "failed";

export interface StripePaymentRecord {
  checkoutSessionId: string;
  stripeSessionId: string;
  recommendationVersion: number;
  groupId: string;
  amountTotalCents: number;
  status: StripePaymentStatus;
  createdAt: string;
  paidAt: string | null;
  failureReason: string | null;
}

declare global {
  // Demo-only persistence. Production should replace this with durable storage.
  var __onetableStripePayments:
    | Map<string, StripePaymentRecord>
    | undefined;
}

const stripePayments =
  globalThis.__onetableStripePayments ??
  new Map<string, StripePaymentRecord>();

globalThis.__onetableStripePayments = stripePayments;

export const createStripePaymentRecord = (
  record: Omit<StripePaymentRecord, "status" | "createdAt" | "paidAt" | "failureReason">,
) => {
  const paymentRecord: StripePaymentRecord = {
    ...record,
    status: "created",
    createdAt: new Date().toISOString(),
    paidAt: null,
    failureReason: null,
  };

  stripePayments.set(paymentRecord.stripeSessionId, paymentRecord);
  return paymentRecord;
};

export const markStripePaymentPaid = (stripeSessionId: string) => {
  const existing = stripePayments.get(stripeSessionId);

  if (!existing) {
    return null;
  }

  const updated: StripePaymentRecord = {
    ...existing,
    status: "paid",
    paidAt: new Date().toISOString(),
    failureReason: null,
  };

  stripePayments.set(stripeSessionId, updated);
  return updated;
};

export const markStripePaymentFailed = (
  stripeSessionId: string,
  failureReason: string,
) => {
  const existing = stripePayments.get(stripeSessionId);

  if (!existing) {
    return null;
  }

  const updated: StripePaymentRecord = {
    ...existing,
    status: "failed",
    failureReason,
  };

  stripePayments.set(stripeSessionId, updated);
  return updated;
};

export const getStripePaymentBySessionId = (stripeSessionId: string) => {
  return stripePayments.get(stripeSessionId) ?? null;
};

export const getStripePaymentByCheckoutSessionId = (
  checkoutSessionId: string,
) => {
  return (
    [...stripePayments.values()].find(
      (record) => record.checkoutSessionId === checkoutSessionId,
    ) ?? null
  );
};
