import Link from "next/link";
import { getStripePaymentByCheckoutSessionId } from "@/features/checkout/payment-store";

export default async function CheckoutCancel({
  searchParams,
}: {
  searchParams: Promise<{ checkout_id?: string }>;
}) {
  const { checkout_id: checkoutSessionId } = await searchParams;
  const paymentRecord = checkoutSessionId
    ? getStripePaymentByCheckoutSessionId(checkoutSessionId)
    : null;

  return (
    <main className="resultPage">
      <section className="resultPanel">
        <p className="eyebrow">Stripe checkout</p>
        <h1>Payment canceled</h1>
        <p>
          No payment was completed, so fulfillment stays locked and the group can
          return to checkout.
        </p>
        {paymentRecord ? (
          <p className="guardrail">
            Checkout {paymentRecord.checkoutSessionId} is still marked{" "}
            {paymentRecord.status}.
          </p>
        ) : null}
        <Link href="/">Back to OneTable</Link>
      </section>
    </main>
  );
}
