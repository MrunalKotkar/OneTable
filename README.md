# OneTable

OneTable is a memory-powered group dining agent for the MenuSifu Track 1 challenge. It recalls each diner's current constraints, negotiates a group order, reacts to membership and belief changes, completes a checkout flow, and writes the outcome back to memory.

This repository is intentionally a minimal boilerplate. It contains shared contracts, demo fixtures, isolated feature boundaries, and a runnable app shell. It does not contain the completed negotiation, XTrace, payment, or fulfillment implementations.

## Start locally

1. Install dependencies with `npm install`.
2. Duplicate `.env.example` as `.env.local`.
3. Keep `MEMORY_PROVIDER=mock` until the XTrace round-trip is verified.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

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

