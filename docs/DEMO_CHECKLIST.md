# OneTable Person 4 Demo Checklist

## Transaction acceptance

- Latest approved recommendation is version 3.
- Version 2 checkout is rejected as stale.
- `NoFeasibleRestaurantError` blocks checkout without reading a recommendation.
- Version 3 checkout opens with one main dish per diner.
- Shared table items are split across participants.
- Per-person amounts sum exactly to the group total.
- Payment reaches processing, then paid.
- A second payment attempt is rejected.
- Forced payment failure shows a recoverable failed state.
- Stripe Checkout creates a test-mode session only after the checkout guard passes.
- Missing Stripe keys leave the simulator fallback visible.
- Stripe webhook confirmation is required before fulfillment is treated as paid.

## Fulfillment acceptance

- Fulfillment is blocked until payment is paid.
- ETA uses the slowest selected dish plus the fixed buffer.
- Timeline shows submitted, accepted, preparing, ready, out for delivery, and completed.
- Feedback stays closed before completed.
- Feedback includes exactly one response per diner.
- Feedback maps to each diner's selected dish.
- One `MealOutcome` is produced for the memory gateway.
- "Memory updated" appears only after the save confirms.

## Rehearsal script

1. Operator starts on the initial table with Alex, Sam, and Jordan.
2. Presenter says OneTable recalls current dining beliefs before choosing food.
3. Operator adds Priya and shows recommendation version 2.
4. Operator revises Jordan from no restrictions to shellfish allergy.
5. Presenter calls out that the old belief is history, not an active rule.
6. Operator approves version 3 and opens checkout.
7. Operator shows split totals, payment confirmation, and fulfillment.
8. Operator records feedback and opens a fresh session proof.

## Fallback mode

- Use deterministic fixtures if XTrace recall or MenuSifu-like data is unavailable.
- Keep the same visible story: version 1, version 2, version 3, checkout, fulfillment, feedback, fresh session.
- If no safe restaurant exists, show the blocked checkout state and do not continue to payment.
- Do not claim a real payment, real delivery, or real allergen certification in the fallback demo.
- Use Stripe test mode for demos; live payments incur Stripe processing fees.
