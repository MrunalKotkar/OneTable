import type { AdapterAccountType } from "next-auth/adapters";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  BeliefKind,
  BeliefStatus,
  FulfillmentStatus,
  PaymentStatus,
} from "@/domain/contracts";
import type { Phase } from "@/lib/phase";
import type { RecommendationChange } from "@/domain/contracts";
import type { CheckoutLineItem } from "@/features/checkout/contract";

/**
 * Phase 1 groundwork only (PRODUCTION_REBUILD_PLAN.md) — nothing reads from
 * this schema yet. Table/column choices anticipate Phase 2-6 gateways
 * without committing to their exact query shape; expect follow-up
 * migrations as those phases land.
 *
 * Naming: snake_case in Postgres (Drizzle's default column-name inference
 * from camelCase JS identifiers), so `db:generate` output reads like normal
 * SQL. Ids are `text` primary keys throughout — either a natural id already
 * used in the domain layer ("alex", "green-ladle", a table's shareable
 * link id) or an app-generated random string — rather than serial/uuid,
 * so seed data and existing fixture ids can be carried over verbatim.
 */

// ---------------------------------------------------------------------------
// Auth.js (next-auth v5) — Credentials provider, DrizzleAdapter.
// Column shapes follow the adapter's documented Postgres schema. `accounts`
// and `verification_tokens` stay mostly unused with email+password sign-in
// (no OAuth, no magic links) but are required by the adapter's types and
// cost nothing to keep — a future OAuth provider or magic-link flow would
// need them anyway.
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  /** Credentials provider only — never set for an OAuth-only account. */
  passwordHash: text("password_hash"),
  /** Phase 2's admin-gated /admin/restaurants. */
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

// ---------------------------------------------------------------------------
// Diners, groups — the "who" of a table, generalized past the fixed
// Alex/Sam/Jordan/Priya cast (Phase 5).
// ---------------------------------------------------------------------------

export const diners = pgTable("diners", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  /** One diner per signed-in user, lazily created on first sign-in. Null for pre-Phase-5 seed diners. */
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/** A table-creator's recurring circle — the minimal-scope answer to "what is a group" (Phase 5). */
export const groups = pgTable("groups", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  ownerDinerId: text("owner_diner_id").references(() => diners.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    dinerId: text("diner_id")
      .notNull()
      .references(() => diners.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.dinerId] })],
);

/** Full belief history per diner (active + superseded) — recall filters to active; history reads superseded. */
export const beliefs = pgTable("beliefs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  dinerId: text("diner_id")
    .notNull()
    .references(() => diners.id, { onDelete: "cascade" }),
  kind: text("kind").$type<BeliefKind>().notNull(),
  /** Domain `Belief.value` is `string | number`; stored as text, parsed back by kind at the gateway boundary. */
  value: text("value").notNull(),
  status: text("status").$type<BeliefStatus>().notNull().default("active"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  /** Self-reference: the belief this one supersedes, if any. */
  supersedes: text("supersedes"),
});

// ---------------------------------------------------------------------------
// Restaurant catalog — admin-managed (Phase 2), seeded from demoRestaurants.
// ---------------------------------------------------------------------------

export const restaurants = pgTable("restaurants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  cuisine: text("cuisine").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const dishes = pgTable("dishes", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }).notNull(),
  tags: text("tags").array().notNull().default([]),
  allergens: text("allergens").array().notNull().default([]),
  allergenStatus: text("allergen_status")
    .$type<"verified" | "unknown">()
    .notNull(),
  preparationMinutes: integer("preparation_minutes").notNull(),
  available: boolean("available").notNull().default(true),
});

// ---------------------------------------------------------------------------
// Tables — a shareable link with seated diners, phase, checkout,
// fulfillment, feedback (Phase 4 moves table-store.ts's Map here).
// ---------------------------------------------------------------------------

export const tables = pgTable("tables", {
  /** The shareable link id (table-store.ts's `makeTableId()`), not a surrogate key. */
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  intent: text("intent").notNull(),
  phase: text("phase").$type<Phase>().notNull().default("idle"),
  errorMessage: text("error_message"),
  approved: boolean("approved").notNull().default(false),
  approvedVersion: integer("approved_version"),
  fulfillmentStatus: text("fulfillment_status").$type<FulfillmentStatus>(),
  /**
   * Phase 4 elapsed-time derivation, replacing setTimeout chains: the
   * current phase/fulfillment step is computed as a pure function of "how
   * much time has passed" since these timestamps on every read, rather
   * than a scheduled mutation (which cannot survive a serverless function
   * returning on Vercel).
   */
  paidAt: timestamp("paid_at", { mode: "date" }),
  phaseTargetAt: timestamp("phase_target_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const tableDiners = pgTable(
  "table_diners",
  {
    tableId: text("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    dinerId: text("diner_id")
      .notNull()
      .references(() => diners.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tableId, table.dinerId] })],
);

// ---------------------------------------------------------------------------
// Recommendations — one row per negotiation-engine run, versioned per table.
// ---------------------------------------------------------------------------

export const recommendations = pgTable("recommendations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tableId: text("table_id")
    .notNull()
    .references(() => tables.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  total: numeric("total", { precision: 10, scale: 2, mode: "number" }).notNull(),
  etaMinutes: integer("eta_minutes").notNull(),
  explanation: text("explanation").notNull(),
  alternativeRestaurantId: text("alternative_restaurant_id"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const recommendationSelections = pgTable("recommendation_selections", {
  id: uuid("id").primaryKey().defaultRandom(),
  recommendationId: text("recommendation_id")
    .notNull()
    .references(() => recommendations.id, { onDelete: "cascade" }),
  dinerId: text("diner_id")
    .notNull()
    .references(() => diners.id),
  dishId: text("dish_id")
    .notNull()
    .references(() => dishes.id),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }).notNull(),
  reason: text("reason").notNull(),
});

export const recommendationChanges = pgTable("recommendation_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  recommendationId: text("recommendation_id")
    .notNull()
    .references(() => recommendations.id, { onDelete: "cascade" }),
  kind: text("kind").$type<RecommendationChange["kind"]>().notNull(),
  summary: text("summary").notNull(),
});

// ---------------------------------------------------------------------------
// Checkout / payments (Phase 6 wires real Stripe on top of this).
// ---------------------------------------------------------------------------

export const checkoutSessions = pgTable("checkout_sessions", {
  /** `checkout-v{version}` per table-store.ts's existing id scheme. */
  id: text("id").primaryKey(),
  tableId: text("table_id")
    .notNull()
    .references(() => tables.id, { onDelete: "cascade" }),
  recommendationVersion: integer("recommendation_version").notNull(),
  latestApprovedVersion: integer("latest_approved_version").notNull(),
  status: text("status").$type<PaymentStatus>().notNull().default("idle"),
  groupTotalCents: integer("group_total_cents").notNull(),
  invalidatedReason: text("invalidated_reason"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const dinerCharges = pgTable("diner_charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  checkoutSessionId: text("checkout_session_id")
    .notNull()
    .references(() => checkoutSessions.id, { onDelete: "cascade" }),
  dinerId: text("diner_id")
    .notNull()
    .references(() => diners.id),
  totalCents: integer("total_cents").notNull(),
  /** `CheckoutLineItem[]` stored as one JSON blob per charge — line items have no independent lifecycle of their own. */
  lineItems: jsonb("line_items")
    .$type<CheckoutLineItem[]>()
    .notNull()
    .default([]),
});

/** Real Stripe payment attempts (Phase 6) — replaces the disconnected payment-store.ts map. */
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  checkoutSessionId: text("checkout_session_id")
    .notNull()
    .references(() => checkoutSessions.id, { onDelete: "cascade" }),
  stripeSessionId: text("stripe_session_id").unique(),
  amountTotalCents: integer("amount_total_cents").notNull(),
  status: text("status").$type<PaymentStatus>().notNull().default("idle"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { mode: "date" }),
});

// ---------------------------------------------------------------------------
// Feedback / meal outcomes — feeds group history back into recall.
// ---------------------------------------------------------------------------

export const mealOutcomes = pgTable("meal_outcomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  tableId: text("table_id")
    .notNull()
    .references(() => tables.id, { onDelete: "cascade" }),
  recommendationVersion: integer("recommendation_version").notNull(),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  completedAt: timestamp("completed_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  mealOutcomeId: uuid("meal_outcome_id")
    .notNull()
    .references(() => mealOutcomes.id, { onDelete: "cascade" }),
  dinerId: text("diner_id")
    .notNull()
    .references(() => diners.id),
  dishId: text("dish_id")
    .notNull()
    .references(() => dishes.id),
  liked: boolean("liked").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
