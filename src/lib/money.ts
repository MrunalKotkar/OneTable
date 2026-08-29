/**
 * Single shared cents↔dollars conversion. Money is stored/transmitted in
 * cents everywhere (Stripe's native unit, and the only representation that
 * avoids floating-point drift), but the domain layer (`Recommendation`,
 * `Dish`, etc.) still expresses prices as dollar amounts — this is the one
 * place that bridges the two, replacing the ad hoc `Math.round(x * 100)`
 * that used to be duplicated across `simulator.ts` and `stripe.ts`.
 */
export const centsFromDollars = (amountDollars: number): number =>
  Math.round(amountDollars * 100);

export const dollarsFromCents = (amountCents: number): number => amountCents / 100;

export const formatCents = (amountCents: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollarsFromCents(amountCents));
