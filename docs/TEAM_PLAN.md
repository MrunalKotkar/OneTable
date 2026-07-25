# OneTable - Four-Teammate Implementation Plan

## Goal

Build one reliable four-minute story:

1. Alex, Sam, and Jordan form a table.
2. OneTable recalls their existing profiles and proposes a restaurant plus one dish each.
3. Priya joins and the same negotiation engine rebalances for four diners.
4. Jordan corrects an old belief from "no dietary restrictions" to "shellfish allergy."
5. The old belief is retired, the new belief becomes current, and the order rebalances again.
6. The group approves, pays, and sees fulfillment.
7. Feedback is saved.
8. A fresh session proves Jordan's correction and meal history persisted.

Priya is not part of the initial three-person table. This avoids the contradictory sequence in the source plan that added all four diners and then added Priya again.

## Product boundaries

### Required

- Four persistent diner identities.
- Active constraints recalled before negotiation.
- One restaurant and one dish per active diner.
- Hard allergy and dietary filtering.
- Rebalance after adding Priya.
- Belief revision followed by another rebalance.
- Visible old-to-new belief history.
- Simulated checkout and fulfillment.
- Feedback write-back.
- Fresh-session proof.

### Not required

- Real MenuSifu private APIs.
- Production payments.
- Real delivery dispatch.
- Arbitrary restaurant discovery.
- Production allergen guarantees.
- A second agent architecture.

## Frozen shared contracts

The shared TypeScript contracts are maintained in `src/domain/contracts.ts`. All teammates build against those types and fixtures before real integrations exist.

The contracts define:

- Belief: a typed fact with current or superseded status and timestamps.
- Diner profile: identity plus beliefs and past meal feedback.
- Group context: active diners, active beliefs, shared history, and dining intent.
- Restaurant and dish: structured safety, dietary, pricing, and preparation data.
- Recommendation: versioned restaurant, diner selections, explanations, totals, and changes.
- Belief revision: previous belief and replacement belief.
- Checkout and fulfillment state.
- Meal outcome for memory write-back.

Contract changes require all four teammates to agree. Once frozen, feature branches should not edit the shared contract file casually.

## Architecture decision: native revision behind an adapter

The attachments disagree about how belief revision is implemented:

- One version models status and supersession in the application.
- The feature note says XTrace performs supersession and returns revision history natively.

Do not spread that uncertainty through the codebase. Person 1 owns a `MemoryGateway` boundary with the following capabilities:

- Recall current group context.
- Revise one belief.
- Read one belief's revision history.
- Save a completed meal outcome.

Two interchangeable providers should satisfy the boundary:

- XTrace provider, used only after the live write-recall-revision spike succeeds.
- Mock provider, deterministic and available immediately.

Everyone else consumes the gateway contract and remains unaware of provider details.

## Shared safety rules

- Allergies and dietary restrictions are hard constraints.
- Unknown allergen status is unsafe for automatic selection.
- Superseded beliefs never influence negotiation.
- Current-session explicit corrections outrank stored preferences.
- A belief revision must finish before fresh context is recalled.
- The engine must return "no feasible result" rather than fabricate safety.
- The demo is a product prototype, not a real-world allergen guarantee.

---

## Person 1 - Memory and belief revision

### Independent objective

Deliver a memory provider that can be developed and tested without the UI, negotiation engine, or checkout.

### Folder ownership

- `src/features/memory`
- Memory-specific fixtures or tests
- Environment variables related to XTrace

### First 30 minutes

1. Keep the mock provider working immediately.
2. Perform one XTrace write and recall round-trip.
3. Test one explicit contradiction.
4. Verify whether recall returns only the current belief.
5. Verify whether revision history is accessible.
6. Announce one decision: XTrace provider is demo-ready, or mock remains the demo provider.

Do not spend more than 20-30 minutes fighting an undocumented endpoint during the critical build.

### Required behavior

- Seed four profiles.
- Recall only active beliefs for negotiation.
- Revise Jordan's restriction belief.
- Return both previous and replacement beliefs for the audit UI.
- Wait for revision completion before returning updated context.
- Save per-diner feedback and group outcome.
- Preserve the correction into a fresh session.

### Seed profiles

- Alex: vegetarian.
- Priya: peanut allergy.
- Sam: high-protein meal under $20.
- Jordan: no dietary restrictions, later revised to shellfish allergy.

### Handoff to Person 2

Provide a `GroupContext` containing active beliefs only. The same method must work before and after revision.

### Handoff to Person 3

Provide a `BeliefRevision` with the previous value, replacement value, and timestamps.

### Acceptance checks

- Initial recall returns Jordan as unrestricted.
- Revision returns the old and new beliefs.
- New recall returns shellfish allergy.
- The old unrestricted belief does not appear as active.
- A fresh session still returns shellfish allergy.
- Failed writes are reported as pending or failed, never as saved.

---

## Person 2 - Negotiation and rebalance

### Independent objective

Deliver a deterministic function that converts a `GroupContext` and restaurant catalog into a safe, explainable `Recommendation`.

### Folder ownership

- `src/features/negotiation`
- Restaurant catalog and scoring tests

### Build against fixtures

Use the shared demo context; do not wait for XTrace. Person 1 can replace the context source later without changing the engine.

### Required behavior

1. Remove dishes that violate active allergies, diets, availability, or hard budgets.
2. Remove a restaurant when any active diner has no valid main dish.
3. Score feasible restaurants using budget, protein goals, preferences, variety, and group history.
4. Select one dish per diner.
5. Return one alternative restaurant.
6. Explain each selection using the active evidence.
7. Version every recommendation.
8. Return a change summary when rebalancing.

### One reusable rebalance path

The engine must not have separate logic for "Priya joined" and "Jordan changed a belief." Both events mean:

1. Receive a fresh `GroupContext`.
2. Re-run feasibility.
3. Re-run selection.
4. Compare with the previous recommendation.
5. Return the next recommendation version and visible changes.

### Deterministic demo outcomes

Prepare restaurant fixtures so:

- The first three-person recommendation is valid.
- Priya's arrival changes at least one visible selection.
- The four-person recommendation initially gives Jordan a shellfish dish or chooses a shellfish-oriented restaurant.
- Jordan's revision invalidates that choice.
- A safe fallback restaurant supports all four diners.

### Acceptance checks

- No superseded belief is consumed.
- Alex always receives a vegetarian dish.
- Priya never receives a peanut or unknown-peanut dish.
- Sam remains under $20 with a high-protein option.
- Jordan's shellfish dish disappears after revision.
- No feasible result is explicit and safe.
- Identical inputs produce identical results.

---

## Person 3 - Session and live-change experience

### Independent objective

Build the judged interaction using fixed recommendation and revision fixtures first. Replace fixtures with live feature outputs during integration.

### Folder ownership

- `src/app`
- `src/components`
- Presentation-only state and styles

### Required screens

#### Create table

- Show Alex, Sam, Jordan, and Priya.
- Start with Alex, Sam, and Jordan selected.
- Capture one intent such as "quick lunch, around $20 each."

#### Recommendation

- Show restaurant, one dish per diner, total, ETA, and concise reasons.
- Make hard-constraint compatibility visible.
- Keep Priya available as the obvious fourth-diner action.

#### Live changes

- Adding Priya shows a short recall state and recommendation version change.
- Jordan's correction triggers another version change.
- Display the belief revision inline:
  - Previous belief crossed out.
  - Current belief highlighted.
  - Timestamp and "updated now."
- Highlight changed restaurant and dish rows instead of replacing the whole screen without explanation.

#### Fresh-session proof

- Show that no onboarding is repeated.
- Show Jordan's shellfish allergy as current.
- Show the previous meal in group history.

### UI state contract

Support:

- Idle.
- Recalling.
- Negotiating.
- Recommendation ready.
- Revising belief.
- Rebalancing.
- No feasible result.
- External service failure with retry.

### Acceptance checks

- A viewer understands each diner's constraint quickly.
- Priya is not accidentally selected at the beginning.
- Both rebalances are visibly different.
- The revision panel reads as history, not two simultaneous beliefs.
- No sensitive detail is exposed beyond the demo's consented scenario.
- The complete visible journey fits the four-minute script.

---

## Person 4 - Checkout, fulfillment, QA, and demo

### Independent objective

Build the transactional ending against a fixed `Recommendation`, own end-to-end validation, and keep the demo reliable.

### Folder ownership

- `src/features/checkout`
- `src/features/fulfillment`
- End-to-end demo fixtures and checklist

### Required behavior

#### Checkout

- Accept only the latest approved recommendation version.
- Assign each main dish to its diner.
- Divide shared items among participants.
- Reconcile individual totals with the group total.
- Simulate payment with processing, paid, and failed states.
- Invalidate checkout when a new recommendation version appears.

#### Fulfillment

- Show submitted, accepted, preparing, ready or out-for-delivery, and completed.
- Derive a simple ETA from the slowest dish plus a fixed buffer.
- Open feedback only after completion.

#### Feedback

- Capture one quick response per diner.
- Send one `MealOutcome` to Person 1.
- Wait for confirmed save before showing "memory updated."

#### QA and demo

- Maintain deterministic fallback data for every external call.
- Test both rebalance triggers.
- Test stale checkout invalidation.
- Test revision persistence in a fresh session.
- Write and time the four-minute script.
- Assign one presenter and one operator.
- Run two full rehearsals and one fallback rehearsal.

### Acceptance checks

- Per-person amounts sum exactly to the group total.
- A stale recommendation cannot be paid.
- Payment cannot complete twice.
- Fulfillment cannot start before payment.
- Feedback maps to the correct diner and dish.
- The whole demo runs without manual data repair.

---

## Integration sequence

### Checkpoint 1 - Contracts and fixtures

Deadline: 30 minutes after start.

- Shared types frozen.
- Mock memory returns all four profiles.
- Negotiation has sample input and output.
- Frontend renders fixed recommendation data.
- Checkout renders a fixed order.

### Checkpoint 2 - Memory to negotiation

Deadline: 90 minutes after start.

- Initial context produces recommendation version one.
- Priya context produces version two.
- Revised Jordan context produces version three.
- Superseded belief never reaches the engine.

### Checkpoint 3 - Full UI path

Deadline: 3 hours after start.

- All three recommendation versions render.
- Audit trail renders.
- Checkout accepts version three.
- Fulfillment and feedback complete.

### Checkpoint 4 - Persistence and fallback

Deadline: 45 minutes before demo.

- Fresh session shows the correction.
- Mock fallback can run the complete story.
- Demo is rehearsed twice.

## Merge discipline

- Each teammate works only in their owned folders.
- Shared contracts are frozen after Checkpoint 1.
- Integrate through typed fixtures before connecting live services.
- Keep commits small and ownership-specific.
- Do not merge visual polish while the core three-version story is broken.

## Four-minute demo outline

1. Introduce the initial three diners and their remembered constraints.
2. Produce recommendation version one.
3. Add Priya and show recommendation version two.
4. Revise Jordan's belief to shellfish allergy.
5. Show the old belief retired and recommendation version three.
6. Approve, split, and pay.
7. Show fulfillment and record feedback.
8. Open a fresh session and prove the correction persisted.

The strongest line:

> OneTable does not just remember more. It knows when an old memory is no longer true, keeps the history, and prevents that outdated belief from affecting what happens next.

