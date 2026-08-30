# OneTable

OneTable is a memory-powered group dining agent for the MenuSifu Track 1 challenge. It recalls each diner's current constraints, negotiates a group order, reacts to membership and belief changes, completes a checkout flow, and writes the outcome back to memory.

This repository is intentionally a minimal boilerplate. It contains shared contracts, demo fixtures, isolated feature boundaries, and a runnable app shell. It does not contain the completed negotiation, XTrace, payment, or fulfillment implementations.

## Start locally

1. Install dependencies with `npm install`.
2. Start a local Postgres with `docker compose up -d` (see `docker-compose.yml`), then duplicate `.env.example` as `.env.local` and set `DATABASE_URL` — required from Phase 4 on, since table orchestration itself is DB-backed now, not just memory/catalog.
3. `npm run db:migrate && npm run db:seed`.
4. `npm run dev`, then open `http://localhost:3000`.

Set `MEMORY_PROVIDER=mock` to run belief/history recall against the in-memory mock instead of Postgres (handy for comparing behavior) — tables/checkout/fulfillment always use the DB regardless.

## Team ownership

| Teammate | Area | Primary folder |
| --- | --- | --- |
| Person 1 | Memory and belief revision | `src/features/memory` |
| Person 2 | Negotiation and rebalance | `src/features/negotiation` |
| Person 3 | Session and live-change UI | `src/app`, `src/components` |
| Person 4 | Checkout, fulfillment, QA, demo | `src/features/checkout`, `src/features/fulfillment` |

The shared domain contracts live in `src/domain/contracts.ts`. Freeze them before parallel work starts.

## Documentation

The complete independent work plan is in [`docs/TEAM_PLAN.md`](docs/TEAM_PLAN.md).

