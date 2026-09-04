# OneTable — Production Rebuild

## Context

OneTable is currently a hackathon demo: a working end-to-end flow (recall beliefs → negotiate → belief revision → checkout → fulfillment → feedback) but built entirely on process-local, in-memory state (`Map`s and `setTimeout` chains), a hardcoded 4-name diner roster, a fixed 3-restaurant catalog, no real accounts, and a Stripe integration that exists in code but is fully disconnected from the live table flow (it only ever pays a hardcoded fixture, never a real table).

The goal is to turn this into an actually deployed, real product:
- **Restaurant data**: move from the hardcoded fixture into the database as admin-editable records (not a live third-party menu API — that requires business partnerships this project doesn't have).
- **Memory backend**: drop the unverified XTrace SDK; beliefs/revisions/history move into the same production database.
- **Payments**: wire Stripe into the *actual* per-table checkout flow, in test mode only (no real money).
- **Infra**: Vercel + Postgres + Auth.js, using sensible defaults, with email+password sign-in (no extra email-service account needed).

This is a multi-day engineering project, not a deploy script. The plan below sequences it into milestones that each leave the app working and deployable, ordered safe-and-incremental first, riskiest/hardest-to-reverse last. Treat each phase as a checkpoint — confirm the app still behaves correctly before moving to the next one, especially phases 5–6, which make user-visible, hard-to-reverse changes (deleting the current "tap a name" identity picker; going through a real Stripe checkout).

**A note on accounts and secrets**: none of this can be done without external accounts and keys. At a few points you'll need to create an account and generate a key. Put secrets directly into `.env.local` (already gitignored) or the hosting provider's dashboard — never commit them.

Accounts needed, gathered up front so there are no surprises:
- A GitHub repo for this project (a fork/copy, per the decision to build this separately from the hackathon team's repo) + a Vercel account, for hosting.
- A Postgres database — Vercel Postgres (one click from the Vercel dashboard, simplest) is the default; swap for Neon or another provider if preferred.
- A Stripe account in **test mode** (no business verification needed for test mode) — for the checkout keys and webhook secret.

## Decisions locked in

| Area | Decision |
|---|---|
| Restaurant data | Admin-managed catalog in Postgres, seeded from the existing `demoRestaurants` fixture |
| Memory backend | Drop XTrace; DB-backed `MemoryGateway`, same contract, same active-beliefs-only guarantee |
| Payments | Real Stripe Checkout wired into the live table flow, test-mode keys only |
| Hosting / DB / Auth | Vercel + Postgres (Vercel Postgres by default) + Auth.js |
| Sign-in method | Email + password (Auth.js Credentials provider) — no extra email-service account |
| ORM | Drizzle — SQL-first migrations, first-class Auth.js adapter, fits this codebase's existing "thin function behind an interface" style better than Prisma's generated-client approach |

## Key existing abstractions to preserve (swap the backing store, not the interface)

- `MemoryGateway` ([src/features/memory/contract.ts](../src/features/memory/contract.ts)) — `recallGroupContext`, `reviseBelief`, `getBeliefHistory`, `saveMealOutcome`. New `dbMemoryGateway` implements this; `mockMemoryGateway` stays for local dev without a DB.
- `NegotiationEngine` ([src/features/negotiation/contract.ts](../src/features/negotiation/contract.ts)) — pure function of `{context, restaurants, previousRecommendation}`. Untouched; just needs a DB-backed `restaurants` array fed in.
- Pure functions in [src/features/checkout/simulator.ts](../src/features/checkout/simulator.ts) and [src/features/fulfillment/simulator.ts](../src/features/fulfillment/simulator.ts) — no state of their own, kept as-is; only their *callers* change from Map-mutation to DB reads/writes.
- [src/server/table-store.ts](../src/server/table-store.ts)'s exported function names stay the same wherever possible (`createTable`, `joinTable`, `approveTable`, `startCheckout`, `payForTable`, `submitFeedback`, `getTable`, …) so the API routes under `src/app/api/tables/**` and `src/lib/api.ts` need minimal changes — only the implementation swaps from `Map` to Postgres.

## Known bugs to fix along the way (found during review, not new work items)

- Two separate `NoFeasibleRestaurantError` classes exist ([src/features/negotiation/engine.ts](../src/features/negotiation/engine.ts) and [src/features/negotiation/contract.ts](../src/features/negotiation/contract.ts)); `checkout/simulator.ts`'s `instanceof` check against the `contract.ts` class can silently miscategorize an error thrown by the `engine.ts` class. Fix: delete the `engine.ts` copy, import the one in `contract.ts`.
- `resetAll()` never clears `src/features/checkout/payment-store.ts`'s in-memory map — moot once that file is deleted in Phase 6, but noted in case any interim state needs it sooner.

## Phased plan

### Phase 0 — Test harness + small cleanups (safe, no behavior change)
- Add Vitest; port the hand-rolled `src/features/checkout/acceptance.ts` checks into real `describe/it` tests, so later phases have a regression net for money/supersession logic before we touch it.
- Fix the dual `NoFeasibleRestaurantError` classes.
- Add `src/lib/money.ts` for one shared cents↔dollars conversion (replacing the ad hoc `Math.round(x*100)` scattered in `simulator.ts`/`stripe.ts`).

### Phase 1 — Postgres + Drizzle groundwork (safe, reversible, nothing reads from it yet)
- Add `src/db/schema.ts`, `drizzle.config.ts`, `src/db/client.ts`; provision a dev Postgres DB; get `db:generate`/`db:migrate` scripts working locally.
- Schema covers: Auth.js tables (`users`, `accounts`, `sessions`, `verification_tokens` via `@auth/drizzle-adapter`) plus app tables `diners`, `beliefs`, `groups`/`group_members`, `restaurants`/`dishes`, `tables`/`table_diners`, `recommendations`/`recommendation_selections`/`recommendation_changes`, `checkout_sessions`/`diner_charges`/`payments`, `feedback`/`meal_outcomes`.

### Phase 2 — Restaurant catalog → DB + admin UI (safe, incremental, demoable on its own)
- `src/features/catalog/contract.ts` + `db-gateway.ts`; seed script migrates `demoRestaurants` verbatim into the DB so behavior doesn't regress.
- `/admin/restaurants` (admin-gated via a `users.is_admin` flag): list/create/edit restaurants and dishes.
- Switch `table-store.ts` and `table/[id]/page.tsx`'s restaurant lookups from the static import to the DB gateway (the client page stops importing `demoRestaurants` directly — `getTable` resolves restaurant/dish info server-side instead).

### Phase 3 — Memory gateway → DB, drop XTrace (safe, incremental)
- `src/features/memory/db-gateway.ts` implementing `MemoryGateway` against `beliefs`/`groups`/`meal_outcomes`/`feedback`, one transaction per `reviseBelief` call (supersede + insert).
- Extract the duplicated `pickSupersededBelief` logic into one shared `src/features/memory/supersession.ts`.
- Delete `xtrace-gateway.ts`, `verify-xtrace.ts`, the `@xtraceai/memory` dependency, and `XTRACE_API_KEY`. Keep `mockMemoryGateway` for local dev without `DATABASE_URL`.

### Phase 4 — Table orchestration → DB, fix serverless-unsafe timers (higher risk — a real control-flow change)
- Migrate `table-store.ts`'s in-memory `Map` to DB reads/writes.
- Replace the `setTimeout`-driven phase/fulfillment progression (which cannot survive a serverless function returning on Vercel) with **elapsed-time derivation**: store `paid_at` and `phase_target_at` timestamps, compute the current phase/fulfillment step as a pure function of "how much time has passed" on every `getTable` read, rather than scheduling mutations.
- This phase must land before Phase 6, since Stripe's webhook needs a durable, DB-backed table to write payment confirmation into.
- **Checkpoint**: confirm the app still behaves correctly end-to-end (create → join → recommend → revise → checkout → simulated pay → fulfillment → feedback) before touching auth or real payments.

### Phase 5 — Auth.js + real diner identity (highest UX risk — deletes the current identity picker)
- Add Auth.js with the Credentials (email+password) provider, `src/middleware.ts` protecting table actions and `/admin`.
- One `diners` row per user, lazily created on first sign-in; a `groups` row per table-creator, reused for tables they create (their recurring circle) — the minimal-scope answer to "what is a group" now that diners aren't a fixed cast of 4.
- Delete `src/lib/table-claim.ts` and `IdentityPicker.tsx`'s "pick who you are" screen — a signed-in user simply *is* their diner; what remains is a one-button "Join this table."
- Generalize `reviseJordanBelief` into a real `reviseBelief(tableId, dinerId, kind, value, correctionText)` usable by whichever diner is signed in, with a small new `BeliefCorrectionForm` replacing the hardcoded "correct to shellfish allergy" button. `FreshSessionPanel.tsx`'s Jordan-only special case generalizes the same way.
- **Checkpoint**: this changes what a first-time visitor sees (sign-up required before joining a table link) — confirm this is still wanted before it's live, since it's the one change that's genuinely awkward to reverse once people start signing up.

### Phase 6 — Real Stripe wiring (test mode only)
- `table-store.ts` gets `startStripeCheckout(tableId)`: builds a real Stripe Checkout Session from the table's *actual* recommendation (using the already-correct `buildStripeLineItems`/`buildStripeMetadata` in [src/features/checkout/stripe.ts](../src/features/checkout/stripe.ts)), with the real `tableId` carried in Stripe metadata.
- Rewrite [src/app/api/webhooks/stripe/route.ts](../src/app/api/webhooks/stripe/route.ts) to resolve `tableId` from metadata and mark that specific table's payment paid/failed and start fulfillment — instead of updating the disconnected `payment-store.ts` map.
- Delete the fixture-based `src/app/api/checkout/stripe/route.ts`, `src/features/checkout/demo-fixtures.ts`, and `payment-store.ts` — they only existed to demo Stripe against fake data.
- Keep the in-memory `simulatePayment` path alive but only reachable when `isStripeConfigured()` is false (local dev without Stripe keys).
- Add a startup guard that refuses to run with an `sk_live_` key, enforcing test-mode-only.
- **You'll need**: a Stripe test-mode secret key and (after the webhook endpoint exists on a deployed URL) the webhook signing secret from the Stripe dashboard.

### Phase 7 — Deploy to Vercel + smoke test
- Connect the repo to Vercel, provision Postgres, set all env vars (`DATABASE_URL`, `AUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` — server-only, deliberately not `NEXT_PUBLIC_APP_URL`), run migrations + catalog seed against the production DB.
- Register the Stripe webhook against the real deployed URL.
- Gate or remove `POST /api/reset` in production (currently wipes all state with no auth check).
- Full smoke test on the live URL: sign up → create table → join → approve → pay with Stripe's `4242 4242 4242 4242` test card → confirm the webhook fires and fulfillment starts → leave feedback → confirm a fresh session shows persisted history.

## Verification approach (per phase)

- Phases 0–3: `npm run typecheck`, `npm run lint`, the new Vitest suite, and `npm run verify:memory` (retargeted at whichever gateway is active) all passing; manually click through the existing demo flow locally to confirm no regression.
- Phase 4: same, plus manually verify phase/fulfillment transitions still render correctly under polling with the new elapsed-time derivation (no more instant `setTimeout` — confirm timing feels right).
- Phase 5: manually sign up two accounts, confirm both can join the same table, confirm belief correction now works for whichever diner is signed in (not just a hardcoded name), confirm a fresh incognito session with a re-login shows persisted beliefs/history.
- Phase 6: full Stripe test-mode checkout using Stripe's documented test cards, confirmed via Vercel function logs that the webhook fires and updates the correct table.
- Phase 7: the live-URL smoke test listed above, run as the final sign-off before calling this "live."

## Critical files

- [src/server/table-store.ts](../src/server/table-store.ts) — central orchestrator, rewritten in Phase 4
- [src/features/memory/mock-gateway.ts](../src/features/memory/mock-gateway.ts) / new `db-gateway.ts` — Phase 3
- [src/features/checkout/stripe.ts](../src/features/checkout/stripe.ts), [src/app/api/webhooks/stripe/route.ts](../src/app/api/webhooks/stripe/route.ts) — Phase 6
- [src/domain/contracts.ts](../src/domain/contracts.ts) — shapes stay frozen throughout
- [src/app/table/[id]/page.tsx](../src/app/table/[id]/page.tsx), [src/lib/table-claim.ts](../src/lib/table-claim.ts) — Phase 5 (identity picker removed)
- [src/data/restaurant-catalog.ts](../src/data/restaurant-catalog.ts) — becomes seed data only, Phase 2
