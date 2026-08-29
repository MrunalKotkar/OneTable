import Link from "next/link";
import { formatCents } from "@/lib/money";
import { getStripePaymentBySessionId } from "@/features/checkout/payment-store";

export default async function CheckoutSuccess({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: stripeSessionId } = await searchParams;
  const paymentRecord = stripeSessionId
    ? getStripePaymentBySessionId(stripeSessionId)
    : null;
  const isPaid = paymentRecord?.status === "paid";

  return (
    <main className="resultPage">
      <section className="resultPanel">
        <p className="eyebrow">Stripe checkout</p>
        <h1>{isPaid ? "Payment confirmed" : "Payment processing"}</h1>
        <p>
          {isPaid
            ? "Stripe confirmed the payment webhook, so fulfillment can begin."
            : "Stripe redirected back successfully. If the webhook listener is running, this will flip to paid after confirmation."}
        </p>
        {paymentRecord ? (
          <dl className="resultDetails">
            <div>
              <dt>Checkout</dt>
              <dd>{paymentRecord.checkoutSessionId}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{paymentRecord.recommendationVersion}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatCents(paymentRecord.amountTotalCents)}</dd>
            </div>
          </dl>
        ) : null}
        <Link href="/">Back to OneTable</Link>
      </section>
    </main>
  );
}
