import Link from "next/link";

/**
 * Stripe's success_url lands here (Phase 6) with our own tableId, not a
 * Stripe session id — the live table page (already polling, already
 * showing the "processing" reveal delay from src/server/elapsed.ts) is
 * the single source of truth for whether the payment actually landed, so
 * this page's only job is to hand the diner back to it. The webhook that
 * marks the table paid can arrive slightly before or after this redirect;
 * either way the table page reflects it correctly once it does.
 */
export default async function CheckoutSuccess({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table } = await searchParams;

  return (
    <main className="resultPage">
      <section className="resultPanel">
        <p className="eyebrow">Stripe checkout</p>
        <h1>Payment submitted</h1>
        <p>
          Stripe confirmed your card. We&apos;re waiting on the payment webhook
          to mark the table paid — this is usually instant.
        </p>
        <Link href={table ? `/table/${table}` : "/"}>
          {table ? "Back to your table" : "Back to OneTable"}
        </Link>
      </section>
    </main>
  );
}
