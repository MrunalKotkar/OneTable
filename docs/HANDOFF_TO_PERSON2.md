# Handoff: Memory → Negotiation (Person 1 → Person 2)

This is everything the negotiation engine needs to consume memory. You build
against the `MemoryGateway` contract only — never against provider internals.

## What you import

```ts
import { mockMemoryGateway } from "@/features/memory";
import type { MemoryGateway } from "@/features/memory";
```

`mockMemoryGateway` is the deterministic demo provider and the offline-safe
fallback. **Your engine imports and calls it exactly the same way no matter
which provider backs it** — everything below is unaffected by the provider work.

### Provider status (as of 2026-07-25)

We are adding a real XTrace-backed gateway behind this same `MemoryGateway`
interface, selected by env (`MEMORY_PROVIDER=xtrace` + key present); the mock is
the default/fallback. Findings from the live XTrace probe that justify the design:

- XTrace does **not** retire contradicted beliefs natively — a correction leaves
  both the old and new fact `status: "active"`. So supersession is handled
  **app-side**, not by trusting XTrace's status.
- XTrace stores LLM-normalized prose ("User is allergic to shellfish."), not our
  structured `{kind, value}`, and drops custom metadata. So the app owns the
  structured belief model; XTrace is the durable write/recall/delete substrate.
- On revision the adapter writes the correction **and deletes the superseded
  memory** from XTrace, so recall is active-only at both layers. Retired beliefs
  live in an app-side history overlay for the audit UI.

None of this reaches you: `recallGroupContext` still returns **only active
beliefs**, same shape, same guarantees, whichever provider is live. The XTrace
adapter is not yet implemented/committed — keep building against the mock.

## The one method you call

```ts
recallGroupContext(
  groupId: string,
  dinerIds: string[],
  intent: string,
): Promise<GroupContext>
```

**Guarantee: the returned `GroupContext` contains ONLY active beliefs.** Every
`diner.beliefs[]` entry has `status: "active"`. Superseded beliefs are filtered
out before you ever see them — you never need to check `status` yourself, and a
retired belief can never reach your feasibility logic.

**Same method before and after revision.** You call `recallGroupContext` the
exact same way for all three recommendation versions. Nothing about revision
leaks into your call site.

`GroupContext` shape (from `@/domain/contracts`):

```ts
interface GroupContext {
  groupId: string;
  intent: string;                 // e.g. "quick lunch, around $20 each"
  diners: DinerProfile[];         // active beliefs only
  history: GroupMealSummary[];    // past group meals (for your history score)
}
```

Each `DinerProfile` has `id`, `name`, `initials`, `beliefs: Belief[]`,
`pastOrders: PastOrder[]`. Each `Belief` has `kind`, `value: string | number`,
`status`, `updatedAt`, `supersedes`.

## Belief kinds you must honour

| Diner  | kind        | value                      | Constraint type |
|--------|-------------|----------------------------|-----------------|
| Alex   | `diet`      | `"vegetarian"`             | hard            |
| Sam    | `goal`      | `"high protein"`           | scoring         |
| Sam    | `budget`    | `20` (number)              | hard            |
| Jordan | `diet`      | `"no dietary restrictions"`| none (initially)|
| Priya  | `allergy`   | `"peanuts"`                | hard            |
| Jordan | `allergy`   | `"shellfish"` (after revision) | hard        |

`kind` is one of: `allergy | diet | budget | goal | preference | dislike`.
Treat `allergy` and `diet` restrictions as **hard** filters; `budget` is a hard
cap (number); `goal`/`preference`/`dislike` feed scoring. Per the shared safety
rules, `allergenStatus: "unknown"` on a dish is unsafe for a diner with a
matching allergy — filter it out rather than guess.

## Driving the three recommendation versions

There is one rebalance path. Both events are just "recall fresh context, re-run":

```ts
const gw: MemoryGateway = mockMemoryGateway;

// v1 — initial three-person table
const ctxV1 = await gw.recallGroupContext(
  "demo-group",
  ["alex", "sam", "jordan"],
  "quick lunch, around $20 each",
);

// v2 — Priya joins (same call, one more diner id)
const ctxV2 = await gw.recallGroupContext(
  "demo-group",
  ["alex", "sam", "jordan", "priya"],
  "quick lunch, around $20 each",
);

// v3 — Jordan corrects his belief, THEN you recall again
await gw.reviseBelief({
  dinerId: "jordan",
  sessionId: "demo",
  kind: "allergy",
  value: "shellfish",
  correctionText: "Actually I'm allergic to shellfish",
});
const ctxV3 = await gw.recallGroupContext(
  "demo-group",
  ["alex", "sam", "jordan", "priya"],
  "quick lunch, around $20 each",
);
// In ctxV3, Jordan's "no dietary restrictions" belief is GONE (superseded)
// and an active allergy:"shellfish" belief is present.
```

`reviseBelief` is owned by the revision flow (Person 3 will trigger it in the
UI). You only ever consume the resulting `GroupContext`. The revision fully
completes before `recallGroupContext` returns updated context — no race.

## Restaurant catalog (starter fixture)

There is now a shared, deterministic restaurant catalog you can feed straight
into `RebalanceInput.restaurants`:

```ts
import { demoRestaurants, getRestaurant } from "@/data/restaurant-catalog";
```

`demoRestaurants: Restaurant[]` is three restaurants with full menus, built so
the three-version story falls out of the **hard safety filters** rather than
scoring, so it reproduces run to run:

| Version | Feasible pick | What the filters do |
|---------|---------------|---------------------|
| v1 (Alex, Sam, Jordan) | **Noodle Republic** | Cheap/fast; its peanut and `allergenStatus: "unknown"` dishes are fine because no one at the table has an allergy. |
| v2 (Priya joins) | **Harbor & Vine** | Noodle Republic is **hard-removed** — every main is peanut or unknown-status, so Priya has no safe dish. Harbor & Vine is shellfish-forward, so an unrestricted Jordan is handed the signature Shrimp Scampi. |
| v3 (Jordan → shellfish) | **Green Fork Kitchen** | Harbor & Vine's whole draw is now off-limits to Jordan; Green Fork is fully verified and safe for all four in every belief state. |

Notes for your engine:

- Allergen strings match the belief `value`s exactly (`"peanuts"`,
  `"shellfish"`), so you can string-match a diner's allergy against
  `dish.allergens` with no normalisation.
- `allergenStatus: "unknown"` should be treated as unsafe for any diner with
  any allergy (that is what triggers the v2 hard removal).
- Green Fork Kitchen is a universal safety net — every belief combination has a
  feasible answer there, so you never need a "no feasible result" for the demo
  path. Harbor & Vine also stays *technically* feasible for a shellfish-allergic
  Jordan (he can fall back to the veg orzo / chicken skewers), so the v2 → v3
  move is a scoring decision, not a dead end — tune scoring so the shellfish
  restaurant loses its appeal once Jordan can't eat shellfish.
- Deliberate traps to exercise your filters: Harbor & Vine's Crunchy Peanut
  Grain Bowl is vegetarian **and** high-protein but peanut (never give it to
  Priya); Cedar Seared Salmon is $21, just over Sam's $20 cap.

This catalog technically lives in Person 2 territory — it is a starter fixture,
so own it from here and adjust scoring-facing details (tags, prices) as you
tune. The header comment in `src/data/restaurant-catalog.ts` documents the full
intended trajectory.

## Not your concern

- Provider details (mock vs XTrace), persistence, timestamps generation.
- `getBeliefHistory` / `saveMealOutcome` — those belong to Person 3 (audit UI)
  and Person 4 (feedback write-back).

## Verify the source of truth

`npm run verify:memory` exercises the full v1 → revise → v3 flow and asserts the
active-beliefs-only guarantee. Run it if you want to see exactly what context
your engine will receive.
