import { and, desc, eq } from "drizzle-orm";
import type {
  BeliefKind,
  BeliefRevision,
  DinerFeedback,
  DinerProfile,
  FulfillmentStatus,
  GroupMealSummary,
  Recommendation,
  Restaurant,
} from "@/domain/contracts";
import { db } from "@/db/client";
import {
  checkoutSessions,
  dinerCharges,
  groupMembers,
  payments,
  recommendationChanges,
  recommendationSelections,
  recommendations,
  tableDiners,
  tableFeedback,
  tables,
} from "@/db/schema";
import { catalogGateway } from "@/features/catalog";
import { isMockMemorySelected, memoryGateway, resetStore } from "@/features/memory";
import { resetDemoGroupState } from "@/features/memory/reset-demo-group";
import { RuleBasedNegotiationEngine } from "@/features/negotiation/engine";
import type { Phase } from "@/lib/phase";
import { getOrCreateGroupForDiner } from "@/server/identity";
import type { CheckoutResult, CheckoutSession } from "@/features/checkout/contract";
import { createCheckoutSession, simulatePayment } from "@/features/checkout/simulator";
import {
  buildStripeLineItems,
  buildStripeMetadata,
  getAppUrl,
  getStripe,
  isStripeConfigured,
} from "@/features/checkout/stripe";
import type { FeedbackMemoryUpdate, FulfillmentStep } from "@/features/fulfillment/contract";
import {
  buildMealOutcome,
  confirmFeedbackMemoryUpdate,
  createFulfillmentTimeline,
} from "@/features/fulfillment/simulator";
import type { PendingAction } from "@/server/elapsed";
import { deriveDisplayPhase, deriveFulfillmentStatus, derivePaymentDisplayStatus } from "@/server/elapsed";

/**
 * Server-side table orchestration, DB-backed (Phase 4 of
 * PRODUCTION_REBUILD_PLAN.md) — the in-memory Map and setTimeout-driven
 * phase/fulfillment progression are both gone; see src/server/elapsed.ts
 * for the elapsed-time derivation that replaced them.
 *
 * Every action handler below does its real work (recall, rebalance, belief
 * revision, payment) *immediately*, writing the true outcome to the DB in
 * the same request — nothing is scheduled. `getTable` (and every guard
 * check in this file) then derives what to *display* as a pure function of
 * "how much time has passed," which is what still gives a fresh table its
 * few seconds of "recalling... negotiating..." before settling — a serverless
 * function returning early can never leave the data in a half-finished state.
 *
 * Every table recalls against its creator's own recurring group (Phase 5),
 * not the table's own (per-link, freshly random) id — see
 * src/server/identity.ts's getOrCreateGroupForDiner.
 */

const negotiationEngine = new RuleBasedNegotiationEngine();

export interface TableState {
  id: string;
  intent: string;
  seatedDinerIds: string[];
  phase: Phase;
  recommendation: Recommendation | null;
  previousRecommendation: Recommendation | null;
  revision: BeliefRevision | null;
  errorMessage: string | null;
  approved: boolean;
  approvedVersion: number | null;
  checkout: CheckoutSession | null;
  lastPaymentResult: CheckoutResult | null;
  fulfillmentStatus: FulfillmentStatus | null;
  feedback: DinerFeedback[];
  memoryUpdate: FeedbackMemoryUpdate | null;
  updatedAt: number;
}

export interface TableSnapshot extends TableState {
  diners: DinerProfile[];
  fulfillmentTimeline: FulfillmentStep[] | null;
  /**
   * The current and (if any) alternative recommendation's restaurants,
   * each with its full menu — resolved here server-side against the DB
   * catalog gateway so the client never imports the static fixture (or
   * talks to the DB) itself.
   */
  restaurants: Restaurant[];
  /** Lets the client decide: a real Stripe Checkout redirect, or the in-memory simulatePayment fallback. */
  stripeConfigured: boolean;
}

type TableRow = typeof tables.$inferSelect;

function makeTableId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function loadSeatedDinerIds(tableId: string): Promise<string[]> {
  const rows = await db
    .select({ dinerId: tableDiners.dinerId })
    .from(tableDiners)
    .where(eq(tableDiners.tableId, tableId))
    .orderBy(tableDiners.joinedAt);
  return rows.map((r) => r.dinerId);
}

async function loadRecommendationRow(
  row: typeof recommendations.$inferSelect,
): Promise<Recommendation> {
  const [selectionRows, changeRows] = await Promise.all([
    db
      .select()
      .from(recommendationSelections)
      .where(eq(recommendationSelections.recommendationId, row.id)),
    db.select().from(recommendationChanges).where(eq(recommendationChanges.recommendationId, row.id)),
  ]);

  return {
    version: row.version,
    restaurantId: row.restaurantId,
    selections: selectionRows.map((s) => ({
      dinerId: s.dinerId,
      dishId: s.dishId,
      price: s.price,
      reason: s.reason,
    })),
    total: row.total,
    etaMinutes: row.etaMinutes,
    explanation: row.explanation,
    alternativeRestaurantId: row.alternativeRestaurantId,
    changes: changeRows.map((c) => ({ kind: c.kind, summary: c.summary })),
  };
}

/** The latest two recommendation versions for a table — "current" and "previous," same as the old in-memory fields. */
async function loadRecommendations(
  tableId: string,
): Promise<{ current: Recommendation | null; previous: Recommendation | null }> {
  const rows = await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.tableId, tableId))
    .orderBy(desc(recommendations.version))
    .limit(2);
  const [currentRow, previousRow] = rows;
  return {
    current: currentRow ? await loadRecommendationRow(currentRow) : null,
    previous: previousRow ? await loadRecommendationRow(previousRow) : null,
  };
}

async function persistRecommendation(tableId: string, recommendation: Recommendation): Promise<void> {
  const [row] = await db
    .insert(recommendations)
    .values({
      tableId,
      version: recommendation.version,
      restaurantId: recommendation.restaurantId,
      total: recommendation.total,
      etaMinutes: recommendation.etaMinutes,
      explanation: recommendation.explanation,
      alternativeRestaurantId: recommendation.alternativeRestaurantId,
    })
    .returning();

  if (recommendation.selections.length > 0) {
    await db.insert(recommendationSelections).values(
      recommendation.selections.map((s) => ({
        recommendationId: row.id,
        dinerId: s.dinerId,
        dishId: s.dishId,
        price: s.price,
        reason: s.reason,
      })),
    );
  }
  if (recommendation.changes.length > 0) {
    await db.insert(recommendationChanges).values(
      recommendation.changes.map((c) => ({
        recommendationId: row.id,
        kind: c.kind,
        summary: c.summary,
      })),
    );
  }
}

/**
 * The one rebalance path, per docs/TEAM_PLAN.md: both "a diner joined" and
 * "a belief was revised" just mean "recall fresh context, re-run
 * negotiation, diff against the previous version." Recalls only active
 * beliefs (the gateway's guarantee) and lets the negotiation engine's own
 * NoFeasibleRestaurantError (checked by name, not `instanceof` — see note
 * below) become the explicit "no feasible result" phase rather than
 * fabricating a recommendation.
 */
async function computeAndPersistRecommendation(
  tableId: string,
  groupId: string,
  seatedDinerIds: string[],
  intent: string,
): Promise<{ phase: Phase; errorMessage: string | null }> {
  try {
    const [context, restaurants, { current: previousRecommendation }] = await Promise.all([
      memoryGateway.recallGroupContext(groupId, seatedDinerIds, intent),
      catalogGateway.listRestaurants(),
      loadRecommendations(tableId),
    ]);
    const recommendation = await negotiationEngine.rebalance({
      context,
      restaurants,
      previousRecommendation: previousRecommendation ?? undefined,
    });
    await persistRecommendation(tableId, recommendation);
    return { phase: "ready", errorMessage: null };
  } catch (error) {
    // Person 2's engine (src/features/negotiation/engine.ts) throws its own
    // NoFeasibleRestaurantError, a *different class* than the same-named one
    // Person 4 added to negotiation/contract.ts. Checking by `.name` instead
    // of `instanceof` works no matter which of the two ever ends up thrown.
    if (error instanceof Error && error.name === "NoFeasibleRestaurantError") {
      return { phase: "no_feasible_result", errorMessage: error.message };
    }
    return {
      phase: "error",
      errorMessage: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

/** Starts a pending action's reveal window, does the real work, then writes the true settled phase. */
async function runAction(
  tableId: string,
  groupId: string,
  actionKind: PendingAction,
  intent: string,
  seatedDinerIds: string[],
): Promise<void> {
  const startedAt = new Date();
  await db
    .update(tables)
    .set({ pendingAction: actionKind, actionStartedAt: startedAt, updatedAt: startedAt })
    .where(eq(tables.id, tableId));

  const { phase, errorMessage } = await computeAndPersistRecommendation(
    tableId,
    groupId,
    seatedDinerIds,
    intent,
  );

  await db
    .update(tables)
    .set({ phase, errorMessage, updatedAt: new Date() })
    .where(eq(tables.id, tableId));
}

/**
 * A signed-in diner creates a table, seating only themselves — whoever
 * else joins does so via the shared link (joinTable below). Every table a
 * diner creates reuses their own recurring group (Phase 5's minimal-scope
 * "what is a group": one per table-creator, lazily created).
 */
export async function createTable(creatorDinerId: string, intent: string): Promise<{ id: string }> {
  const id = makeTableId();
  const groupId = await getOrCreateGroupForDiner(creatorDinerId);

  await db.insert(tables).values({ id, groupId, intent, phase: "recalling" });
  await db.insert(tableDiners).values({ tableId: id, dinerId: creatorDinerId });
  await db
    .insert(groupMembers)
    .values({ groupId, dinerId: creatorDinerId })
    .onConflictDoNothing({ target: [groupMembers.groupId, groupMembers.dinerId] });

  await runAction(id, groupId, "create", intent, [creatorDinerId]);

  return { id };
}

/**
 * A diner opens the shared link and claims their seat. Idempotent for
 * diners already seated. Any join that happens after a recommendation
 * already exists triggers the same rebalance path used for a belief
 * revision. Also records them as a member of the table's group — whoever
 * joins one of your tables becomes part of your recurring circle.
 */
export async function joinTable(
  id: string,
  dinerId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [row] = await db.select().from(tables).where(eq(tables.id, id));
  if (!row) return { ok: false, reason: "Table not found." };
  if (row.approved) return { ok: true };

  const [existing] = await db
    .select()
    .from(tableDiners)
    .where(and(eq(tableDiners.tableId, id), eq(tableDiners.dinerId, dinerId)));
  if (existing) return { ok: true };

  const { current: existingRecommendation } = await loadRecommendations(id);
  await db.insert(tableDiners).values({ tableId: id, dinerId });
  await db
    .insert(groupMembers)
    .values({ groupId: row.groupId, dinerId })
    .onConflictDoNothing({ target: [groupMembers.groupId, groupMembers.dinerId] });

  if (existingRecommendation) {
    const seatedDinerIds = await loadSeatedDinerIds(id);
    await runAction(id, row.groupId, "join", row.intent, seatedDinerIds);
  }

  return { ok: true };
}

/**
 * A signed-in diner corrects one of their own beliefs from their own
 * device (Phase 5 generalizes this past the demo's hardcoded "Jordan
 * corrects to shellfish allergy" script — any seated diner, any kind,
 * any value). The revision is written through the real MemoryGateway (so
 * it persists independent of this table, and the previous/current pair
 * for the audit UI comes straight from the gateway's own supersession
 * logic), then the same rebalance path re-runs.
 *
 * Only one correction is shown per table at a time (`tables.lastRevision`
 * is a single slot, matching what BeliefRevisionPanel renders) — a second
 * attempt at the same table is a no-op, same as the original single-shot
 * demo script.
 */
export async function reviseBelief(
  id: string,
  dinerId: string,
  kind: BeliefKind,
  value: string | number,
  correctionText: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [row] = await db.select().from(tables).where(eq(tables.id, id));
  if (!row) return { ok: false, reason: "Table not found." };
  if (row.approved) return { ok: false, reason: "This table is already approved." };
  if (row.lastRevision) return { ok: false, reason: "This table already has a correction on file." };

  const seatedDinerIds = await loadSeatedDinerIds(id);
  if (!seatedDinerIds.includes(dinerId)) {
    return { ok: false, reason: "You need to join this table before correcting a belief." };
  }

  const startedAt = new Date();
  await db
    .update(tables)
    .set({ phase: "revising_belief", pendingAction: "revise", actionStartedAt: startedAt, updatedAt: startedAt })
    .where(eq(tables.id, id));

  const revision = await memoryGateway.reviseBelief({
    dinerId,
    sessionId: id,
    kind,
    value,
    correctionText,
  });
  await db.update(tables).set({ lastRevision: revision, updatedAt: new Date() }).where(eq(tables.id, id));

  const { phase, errorMessage } = await computeAndPersistRecommendation(
    id,
    row.groupId,
    seatedDinerIds,
    row.intent,
  );
  await db.update(tables).set({ phase, errorMessage, updatedAt: new Date() }).where(eq(tables.id, id));

  return { ok: true };
}

/**
 * Approving locks the table: no further joins or belief revisions, and
 * the recommendation version at this moment becomes the only one
 * checkout will accept. Gates on the DISPLAYED phase (elapsed-time
 * derived), not the raw stored one, so a client can never approve a
 * recommendation it hasn't actually been shown yet — same guarantee the
 * old setTimeout version gave for free by construction.
 */
export async function approveTable(
  id: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [row] = await db.select().from(tables).where(eq(tables.id, id));
  if (!row) return { ok: false, reason: "Table not found." };

  const displayPhase = deriveDisplayPhase(row.phase, row.pendingAction, row.actionStartedAt, new Date());
  const { current: recommendation } = await loadRecommendations(id);
  if (displayPhase !== "ready" || !recommendation) {
    return { ok: false, reason: "No ready recommendation to approve yet." };
  }

  await db
    .update(tables)
    .set({ approved: true, approvedVersion: recommendation.version, updatedAt: new Date() })
    .where(eq(tables.id, id));
  return { ok: true };
}

async function loadRawCheckoutSessionRow(tableId: string): Promise<typeof checkoutSessions.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.tableId, tableId))
    .orderBy(desc(checkoutSessions.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Creates the checkout session from the table's approved recommendation
 * — never from a hardcoded fixture — so the split always matches what
 * this specific group actually negotiated.
 */
export async function startCheckout(
  id: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [row] = await db.select().from(tables).where(eq(tables.id, id));
  if (!row) return { ok: false, reason: "Table not found." };
  if (!row.approved || row.approvedVersion === null) {
    return { ok: false, reason: "Approve a recommendation before checkout." };
  }

  const existing = await loadRawCheckoutSessionRow(id);
  if (existing) return { ok: true };

  const { current: recommendation } = await loadRecommendations(id);
  if (!recommendation) {
    return { ok: false, reason: "Approve a recommendation before checkout." };
  }

  const session = createCheckoutSession({
    recommendation,
    latestApprovedVersion: row.approvedVersion,
  });

  // Person 4's simulator labels "main" line items with the raw dishId
  // (it has no restaurant to resolve names against). Relabel with the
  // actual dish name here, since we do have the restaurant.
  const restaurant = await catalogGateway.getRestaurant(recommendation.restaurantId);
  if (restaurant) {
    const dishNameById = new Map(restaurant.menu.map((dish) => [dish.id, dish.name]));
    session.dinerCharges = session.dinerCharges.map((charge) => ({
      ...charge,
      lineItems: charge.lineItems.map((item) =>
        item.kind === "main" && dishNameById.has(item.label)
          ? { ...item, label: dishNameById.get(item.label)! }
          : item,
      ),
    }));
  }

  await db.insert(checkoutSessions).values({
    id: session.id,
    tableId: id,
    recommendationVersion: session.recommendationVersion,
    latestApprovedVersion: session.latestApprovedVersion,
    status: session.status,
    groupTotalCents: session.groupTotalCents,
    invalidatedReason: session.invalidatedReason,
  });
  if (session.dinerCharges.length > 0) {
    await db.insert(dinerCharges).values(
      session.dinerCharges.map((charge) => ({
        checkoutSessionId: session.id,
        dinerId: charge.dinerId,
        totalCents: charge.totalCents,
        lineItems: charge.lineItems,
      })),
    );
  }

  return { ok: true };
}

/**
 * Builds a real Stripe Checkout Session from the table's actual approved
 * recommendation (Phase 6 of PRODUCTION_REBUILD_PLAN.md) — the real
 * tableId (and checkoutSessionId, groupId) go into Stripe's metadata so
 * the webhook can resolve exactly which table to mark paid. Requires
 * startCheckout() to have already run (same DB checkout_sessions row
 * either payment method settles).
 */
export async function startStripeCheckout(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  if (!isStripeConfigured()) {
    return { ok: false, reason: "Stripe is not configured." };
  }

  const [row] = await db.select().from(tables).where(eq(tables.id, id));
  if (!row) return { ok: false, reason: "Table not found." };

  const checkoutRow = await loadRawCheckoutSessionRow(id);
  if (!checkoutRow) return { ok: false, reason: "Start checkout before paying." };
  if (checkoutRow.status === "paid") return { ok: false, reason: "This table has already been paid." };

  const { current: recommendation } = await loadRecommendations(id);
  if (!recommendation) return { ok: false, reason: "No recommendation on file." };

  const restaurant = await catalogGateway.getRestaurant(recommendation.restaurantId);
  if (!restaurant) return { ok: false, reason: "Restaurant not found." };

  const stripe = getStripe();
  const appUrl = getAppUrl();
  const stripeSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: buildStripeLineItems({ recommendation, restaurant, sharedItems: [] }),
    metadata: buildStripeMetadata({
      checkoutSessionId: checkoutRow.id,
      recommendationVersion: checkoutRow.recommendationVersion,
      groupId: row.groupId,
      tableId: id,
    }),
    success_url: `${appUrl}/checkout/success?table=${id}`,
    cancel_url: `${appUrl}/checkout/cancel?table=${id}`,
  });

  if (!stripeSession.url) {
    return { ok: false, reason: "Stripe did not return a checkout URL." };
  }

  return { ok: true, url: stripeSession.url };
}

/**
 * Simulates payment. The row is written with its real, final status
 * immediately (see src/server/elapsed.ts's derivePaymentDisplayStatus for
 * the brief "processing" reveal delay this produces on read).
 *
 * Every attempt becomes its own `payments` row — including a duplicate
 * Pay click against an already-paid session, recorded as a rejected
 * attempt rather than silently ignored or (worse) flipping a genuinely
 * completed payment back to "failed" the way a naive re-run of the
 * simulator would.
 */
export async function payForTable(
  id: string,
  options?: { forceFailure?: boolean },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (isStripeConfigured()) {
    return { ok: false, reason: "Stripe is configured — pay through Stripe checkout instead." };
  }

  const [row] = await db.select().from(tables).where(eq(tables.id, id));
  if (!row) return { ok: false, reason: "Table not found." };

  const checkoutRow = await loadRawCheckoutSessionRow(id);
  if (!checkoutRow) return { ok: false, reason: "Start checkout before paying." };

  if (checkoutRow.status === "paid") {
    await db.insert(payments).values({
      checkoutSessionId: checkoutRow.id,
      amountTotalCents: checkoutRow.groupTotalCents,
      status: "failed",
      failureReason: "Payment already completed.",
    });
    return { ok: true };
  }

  const chargeRows = await db
    .select()
    .from(dinerCharges)
    .where(eq(dinerCharges.checkoutSessionId, checkoutRow.id));
  const session: CheckoutSession = {
    id: checkoutRow.id,
    recommendationVersion: checkoutRow.recommendationVersion,
    latestApprovedVersion: checkoutRow.latestApprovedVersion,
    status: checkoutRow.status,
    dinerCharges: chargeRows.map((c) => ({
      dinerId: c.dinerId,
      lineItems: c.lineItems,
      totalCents: c.totalCents,
    })),
    groupTotalCents: checkoutRow.groupTotalCents,
    createdAt: checkoutRow.createdAt.toISOString(),
    invalidatedReason: checkoutRow.invalidatedReason,
  };

  const transition = simulatePayment({ session, forceFailure: options?.forceFailure });

  await db.insert(payments).values({
    checkoutSessionId: checkoutRow.id,
    amountTotalCents: checkoutRow.groupTotalCents,
    status: transition.result.status,
    confirmationId: transition.result.confirmationId ?? null,
    failureReason: transition.result.failureReason ?? null,
  });
  await db
    .update(checkoutSessions)
    .set({ status: transition.completedSession.status })
    .where(eq(checkoutSessions.id, checkoutRow.id));

  if (transition.result.status === "paid") {
    await db.update(tables).set({ paidAt: new Date(), updatedAt: new Date() }).where(eq(tables.id, id));
  }

  return { ok: true };
}

/**
 * Records a real Stripe payment outcome — called only from the Stripe
 * webhook handler (src/app/api/webhooks/stripe/route.ts), never directly
 * from a client request. Idempotent against Stripe's own webhook retries:
 * a stripeSessionId already on file (checked via the unique constraint on
 * payments.stripe_session_id) or a checkout session already marked paid
 * is a silent no-op rather than a duplicate row or a double-set paidAt.
 */
export async function confirmStripePayment(
  checkoutSessionId: string,
  outcome:
    | { status: "paid"; stripeSessionId: string; confirmationId: string | null }
    | { status: "failed"; stripeSessionId: string; failureReason: string },
): Promise<void> {
  const [checkoutRow] = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, checkoutSessionId));
  if (!checkoutRow) return;
  if (checkoutRow.status === "paid") return;

  const [existingPayment] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.stripeSessionId, outcome.stripeSessionId));
  if (existingPayment) return;

  await db.insert(payments).values({
    checkoutSessionId,
    stripeSessionId: outcome.stripeSessionId,
    amountTotalCents: checkoutRow.groupTotalCents,
    status: outcome.status,
    confirmationId: outcome.status === "paid" ? outcome.confirmationId : null,
    failureReason: outcome.status === "failed" ? outcome.failureReason : null,
  });
  await db.update(checkoutSessions).set({ status: outcome.status }).where(eq(checkoutSessions.id, checkoutSessionId));

  if (outcome.status === "paid") {
    await db
      .update(tables)
      .set({ paidAt: new Date(), updatedAt: new Date() })
      .where(eq(tables.id, checkoutRow.tableId));
  }
}

async function loadCheckoutDisplay(
  tableId: string,
  now: Date,
): Promise<{ session: CheckoutSession | null; lastPaymentResult: CheckoutResult | null }> {
  const sessionRow = await loadRawCheckoutSessionRow(tableId);
  if (!sessionRow) return { session: null, lastPaymentResult: null };

  const [chargeRows, paymentRows] = await Promise.all([
    db.select().from(dinerCharges).where(eq(dinerCharges.checkoutSessionId, sessionRow.id)),
    db
      .select()
      .from(payments)
      .where(eq(payments.checkoutSessionId, sessionRow.id))
      .orderBy(desc(payments.createdAt)),
  ]);

  // Latest attempt overall — including a rejected duplicate Pay click —
  // drives `lastPaymentResult`, so the UI can tell the user *that* click
  // did nothing new. But the session's own displayed status must never
  // flicker because of a rejected duplicate: it's anchored to whichever
  // attempt actually produced the session's real, current status (a
  // duplicate-paid rejection is always "failed" and never touches
  // checkout_sessions.status — see payForTable).
  const latestPaymentRow = paymentRows[0] ?? null;
  const settlingPaymentRow = paymentRows.find((p) => p.status === sessionRow.status) ?? null;

  const sessionDisplayStatus = derivePaymentDisplayStatus(
    sessionRow.status,
    settlingPaymentRow?.createdAt ?? now,
    now,
  );
  const paymentDisplayStatus = latestPaymentRow
    ? derivePaymentDisplayStatus(latestPaymentRow.status, latestPaymentRow.createdAt, now)
    : null;

  const session: CheckoutSession = {
    id: sessionRow.id,
    recommendationVersion: sessionRow.recommendationVersion,
    latestApprovedVersion: sessionRow.latestApprovedVersion,
    status: sessionDisplayStatus,
    dinerCharges: chargeRows
      .map((c) => ({ dinerId: c.dinerId, lineItems: c.lineItems, totalCents: c.totalCents }))
      .sort((a, b) => a.dinerId.localeCompare(b.dinerId)),
    groupTotalCents: sessionRow.groupTotalCents,
    createdAt: sessionRow.createdAt.toISOString(),
    invalidatedReason: sessionRow.invalidatedReason,
  };

  const lastPaymentResult: CheckoutResult | null =
    latestPaymentRow && paymentDisplayStatus
      ? {
          recommendationVersion: sessionRow.recommendationVersion,
          status: paymentDisplayStatus,
          confirmationId:
            paymentDisplayStatus === "paid" ? (latestPaymentRow.confirmationId ?? undefined) : undefined,
          failureReason:
            paymentDisplayStatus === "failed" ? (latestPaymentRow.failureReason ?? undefined) : undefined,
        }
      : null;

  return { session, lastPaymentResult };
}

/**
 * One diner submits their own feedback. Only allowed once fulfillment has
 * completed. Once every seated diner has responded, builds the
 * MealOutcome and writes it back through the real MemoryGateway (scoped
 * to this table's own group, not the table's own id) — so a later
 * fresh-session lookup, or even a brand-new table created by the same
 * diner, genuinely reflects it.
 */
export async function submitFeedback(
  id: string,
  dinerId: string,
  liked: boolean,
  note?: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [row] = await db.select().from(tables).where(eq(tables.id, id));
  if (!row) return { ok: false, reason: "Table not found." };

  const fulfillmentStatus = deriveFulfillmentStatus(row.paidAt, new Date());
  if (fulfillmentStatus !== "completed") {
    return { ok: false, reason: "Feedback opens once fulfillment is completed." };
  }

  const seatedDinerIds = await loadSeatedDinerIds(id);
  if (!seatedDinerIds.includes(dinerId)) {
    return { ok: false, reason: "This diner is not at the table." };
  }

  const { current: recommendation } = await loadRecommendations(id);
  const selection = recommendation?.selections.find((s) => s.dinerId === dinerId);
  if (!selection) return { ok: false, reason: "No selection on file for this diner." };

  await db
    .insert(tableFeedback)
    .values({ tableId: id, dinerId, dishId: selection.dishId, liked, note: note ?? null })
    .onConflictDoUpdate({
      target: [tableFeedback.tableId, tableFeedback.dinerId],
      set: { dishId: selection.dishId, liked, note: note ?? null },
    });

  if (!row.memorySavedAt && recommendation) {
    const feedbackRows = await db.select().from(tableFeedback).where(eq(tableFeedback.tableId, id));
    const allResponded = seatedDinerIds.every((seatedId) =>
      feedbackRows.some((f) => f.dinerId === seatedId),
    );

    if (allResponded) {
      const completedAt = new Date().toISOString();
      const outcome = buildMealOutcome({
        groupId: row.groupId,
        recommendation,
        feedback: feedbackRows.map((f) => ({
          dinerId: f.dinerId,
          dishId: f.dishId,
          liked: f.liked,
          note: f.note ?? undefined,
        })),
        completedAt,
        currentStatus: fulfillmentStatus,
      });
      await memoryGateway.saveMealOutcome(outcome);
      await db
        .update(tables)
        .set({ memorySavedAt: new Date(completedAt), updatedAt: new Date() })
        .where(eq(tables.id, id));
    }
  }

  return { ok: true };
}

interface SnapshotParts {
  seatedDinerIds: string[];
  displayPhase: Phase;
  recommendation: Recommendation | null;
  previousRecommendation: Recommendation | null;
  fulfillmentStatus: FulfillmentStatus | null;
  checkout: CheckoutSession | null;
  lastPaymentResult: CheckoutResult | null;
  feedback: DinerFeedback[];
  memoryUpdate: FeedbackMemoryUpdate | null;
}

function toTableSnapshotBase(
  row: TableRow,
  parts: SnapshotParts,
): Omit<TableState, "diners" | "restaurants" | "fulfillmentTimeline"> {
  return {
    id: row.id,
    intent: row.intent,
    seatedDinerIds: parts.seatedDinerIds,
    phase: parts.displayPhase,
    recommendation: parts.recommendation,
    previousRecommendation: parts.previousRecommendation,
    revision: row.lastRevision ?? null,
    errorMessage: row.errorMessage,
    approved: row.approved,
    approvedVersion: row.approvedVersion,
    checkout: parts.checkout,
    lastPaymentResult: parts.lastPaymentResult,
    fulfillmentStatus: parts.fulfillmentStatus,
    feedback: parts.feedback,
    memoryUpdate: parts.memoryUpdate,
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function getTable(id: string): Promise<TableSnapshot | null> {
  const [row] = await db.select().from(tables).where(eq(tables.id, id));
  if (!row) return null;

  const now = new Date();
  const seatedDinerIds = await loadSeatedDinerIds(id);
  const { current: recommendation, previous: previousRecommendation } = await loadRecommendations(id);

  const relevantRestaurantIds = [
    recommendation?.restaurantId,
    recommendation?.alternativeRestaurantId,
  ].filter((rid): rid is string => rid !== null && rid !== undefined);

  const [context, restaurants, checkoutDisplay, feedbackRows] = await Promise.all([
    memoryGateway.recallGroupContext(row.groupId, seatedDinerIds, row.intent),
    catalogGateway.getRestaurants(relevantRestaurantIds),
    loadCheckoutDisplay(id, now),
    db.select().from(tableFeedback).where(eq(tableFeedback.tableId, id)),
  ]);

  const displayPhase = deriveDisplayPhase(row.phase, row.pendingAction, row.actionStartedAt, now);
  const fulfillmentStatus = deriveFulfillmentStatus(row.paidAt, now);

  const restaurant = recommendation
    ? (restaurants.find((r) => r.id === recommendation.restaurantId) ?? null)
    : null;
  const fulfillmentTimeline =
    recommendation && restaurant && fulfillmentStatus
      ? createFulfillmentTimeline(recommendation, restaurant, fulfillmentStatus)
      : null;

  const feedback: DinerFeedback[] = feedbackRows.map((f) => ({
    dinerId: f.dinerId,
    dishId: f.dishId,
    liked: f.liked,
    note: f.note ?? undefined,
  }));

  const memoryUpdate: FeedbackMemoryUpdate | null =
    row.memorySavedAt && recommendation
      ? confirmFeedbackMemoryUpdate({
          outcome: buildMealOutcome({
            groupId: row.groupId,
            recommendation,
            feedback,
            completedAt: row.memorySavedAt.toISOString(),
            currentStatus: fulfillmentStatus ?? undefined,
          }),
          savedAt: row.memorySavedAt.toISOString(),
        })
      : null;

  return {
    ...toTableSnapshotBase(row, {
      seatedDinerIds,
      displayPhase,
      recommendation,
      previousRecommendation,
      fulfillmentStatus,
      checkout: checkoutDisplay.session,
      lastPaymentResult: checkoutDisplay.lastPaymentResult,
      feedback,
      memoryUpdate,
    }),
    diners: context.diners,
    fulfillmentTimeline,
    restaurants,
    stripeConfigured: isStripeConfigured(),
  };
}

export async function getDinerProfile(id: string): Promise<DinerProfile | null> {
  // groupId only affects the returned `history` field (discarded below by
  // taking just `.diners[0]`), so any value is fine here.
  const context = await memoryGateway.recallGroupContext("", [id], "");
  return context.diners[0] ?? null;
}

/**
 * The mock gateway's recall stores each meal's restaurant as its id (see
 * mock-gateway.ts's `restaurant: o.restaurantId`), not a display name.
 * Resolved here against the catalog for anything rendering this list.
 */
export async function getGroupHistory(groupId: string): Promise<GroupMealSummary[]> {
  // dinerIds only affects the returned `diners` field, which this function
  // doesn't use — history is purely a function of groupId.
  const context = await memoryGateway.recallGroupContext(groupId, [], "");
  const restaurantIds = context.history.map((meal) => meal.restaurant);
  const restaurants = await catalogGateway.getRestaurants(restaurantIds);
  const nameById = new Map(restaurants.map((r) => [r.id, r.name]));
  return context.history.map((meal) => ({
    ...meal,
    restaurant: nameById.get(meal.restaurant) ?? meal.restaurant,
  }));
}

/**
 * Demo-rehearsal reset: clears every table (cascades to its diners,
 * recommendations, checkout/payments, and feedback) and restores the demo
 * group's seed beliefs/history — in Postgres when the DB gateway backs
 * memory, or the mock's own module state when MEMORY_PROVIDER=mock.
 */
export async function resetAll(): Promise<void> {
  if (isMockMemorySelected()) {
    resetStore();
  } else {
    await resetDemoGroupState();
  }
  await db.delete(tables);
}
