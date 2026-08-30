import Link from "next/link";

export default async function CheckoutCancel({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table } = await searchParams;

  return (
    <main className="resultPage">
      <section className="resultPanel">
        <p className="eyebrow">Stripe checkout</p>
        <h1>Payment canceled</h1>
        <p>No payment was completed — the table is still waiting to be paid.</p>
        <Link href={table ? `/table/${table}` : "/"}>
          {table ? "Back to your table" : "Back to OneTable"}
        </Link>
      </section>
    </main>
  );
}
