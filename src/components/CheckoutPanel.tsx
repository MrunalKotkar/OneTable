import type { CheckoutResult, CheckoutSession } from "@/features/checkout/contract";
import { formatCents } from "@/features/checkout/simulator";
import type { DinerProfile } from "@/domain/contracts";

interface CheckoutPanelProps {
  session: CheckoutSession;
  lastResult: CheckoutResult | null;
  diners: DinerProfile[];
  canPay: boolean;
  paying: boolean;
  onPay: () => void;
}

export function CheckoutPanel({ session, lastResult, diners, canPay, paying, onPay }: CheckoutPanelProps) {
  const dinerName = (id: string) => diners.find((d) => d.id === id)?.name ?? id;

  return (
    <section className="panel checkoutPanel" aria-labelledby="checkout-title">
      <div className="panelHeading">
        <div>
          <p className="eyebrow">Checkout</p>
          <h2 id="checkout-title">Split the bill</h2>
        </div>
        <span>{formatCents(session.groupTotalCents)} total</span>
      </div>
      <div className="panelBody">
        <div className="dinerChargeList">
          {session.dinerCharges.map((charge) => (
            <div className="dinerCharge" key={charge.dinerId}>
              <div className="dinerChargeHeader">
                <strong>{dinerName(charge.dinerId)}</strong>
                <span>{formatCents(charge.totalCents)}</span>
              </div>
              <ul>
                {charge.lineItems.map((item) => (
                  <li key={item.id}>
                    <span>{item.label}</span>
                    <span>{formatCents(item.amountCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {session.status === "idle" && (
          <button type="button" className="primaryButton" onClick={onPay} disabled={!canPay || paying}>
            {paying ? "Processing…" : `Pay ${formatCents(session.groupTotalCents)} (simulated)`}
          </button>
        )}

        {session.status === "processing" && (
          <p className="inlineHint">Processing payment…</p>
        )}

        {session.status === "paid" && (
          <p className="checkoutPaid">
            Paid{lastResult?.confirmationId ? ` — confirmation ${lastResult.confirmationId}` : ""}.
          </p>
        )}

        {session.status === "failed" && (
          <>
            <p className="checkoutFailed">
              {lastResult?.failureReason ?? "Payment failed."}
            </p>
            <button type="button" className="secondaryButton" onClick={onPay} disabled={!canPay || paying}>
              Retry payment
            </button>
          </>
        )}
      </div>
    </section>
  );
}
