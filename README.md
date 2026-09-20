# CLOSURE

> The dating app designed to be deleted. We win when you leave.

This is an MVP scaffold for CLOSURE: one match at a time (no feed, no
swiping), agent-to-agent negotiation over a voice-interview-derived
preference profile, a **Closure Guarantee** that makes silence structurally
impossible, pay-per-date economics instead of a subscription, and mandatory
verification.

It runs standalone with zero API keys. Every external dependency named in
the product spec (Twilio, Deepgram, GPT-4o, an eID/liveness vendor, Stripe)
sits behind an adapter interface in `src/adapters/types.ts`, with a
deterministic mock implementation in `src/adapters/mock.ts` wired up by
default in `src/adapters/index.ts`. Swap a `Mock*` class for a `Real*` one
implementing the same interface to go live with a provider — nothing above
that layer changes.

## Quickstart

```bash
npm install
cp .env.example .env
npm run db:push      # creates prisma/dev.db and applies the schema
npm run db:seed      # seeds two verified, pre-matched demo users
npm run dev           # http://localhost:3000
```

Open `http://localhost:3000` for a step-by-step demo UI that walks the full
flow: create users → run the (stand-in) voice interview → verify → find a
match → approve → schedule/attend a date → file a Closure Guarantee event.
It also has a button that deliberately tries to skip the closure reason, to
show the API rejecting it.

Run the test suite (pure domain-logic unit tests, no DB required):

```bash
npm test
```

## How the spec maps to the code

| Spec mechanic | Where it lives |
| --- | --- |
| Voice interview → structured profile | `src/adapters/mock.ts` (`MockProfileExtractor`), `POST /api/users/:id/interview` |
| Agent-to-agent negotiation, "one match, not a feed" | `src/domain/matching.ts` (`findBestMatch`, dealbreaker veto, cosine similarity), `POST /api/matches/find/:userId` |
| **Closure Guarantee** (the differentiator) | `src/domain/closure.ts` — reason taxonomy, SLA, escrow resolution, accountability score; `POST /api/matches/:id/closure` |
| Escrow deposit / commitment device | `src/domain/escrow.ts`, `EscrowLedgerEntry` model |
| Pay-per-date, success fee, unit economics | `src/domain/payments.ts`, `POST /api/dates/:id/attend`, `POST /api/matches/:id/report-success` |
| Cancellation ladder (free → fee → suspension) | `src/domain/dates.ts`, `POST /api/dates/:id/cancel` |
| Mandatory ID + liveness verification | `src/adapters/mock.ts` (`MockVerificationProvider`), `POST /api/users/:id/verify` |
| Intent locked 30 days, separate matching pools | `src/domain/intent.ts` |
| Vouching web | `src/routes/vouches.ts`, `Vouch` model |

## Architecture notes

- **Database**: SQLite via Prisma for zero-config local dev
  (`prisma/schema.prisma`). SQLite's Prisma connector doesn't support native
  enums, so status/category fields are `String` columns constrained by the
  TypeScript union types documented next to each field — switch the
  datasource `provider` to `"postgresql"` for production and those can
  become real Prisma `enum` blocks if you want the extra DB-level
  constraint.
- **Preference vectors**: stored as JSON-encoded float arrays and compared
  with cosine similarity in `src/domain/matching.ts`. The mock extractor
  (`hashEmbed` in `src/adapters/mock.ts`) is a deterministic bag-of-words
  hash standing in for a real embedding model — swap it for an actual
  embeddings call and move the column to `pgvector` when moving off SQLite;
  the matching code only depends on "fixed-length vector + cosine
  similarity," so nothing else changes.
- **Domain logic is pure**: everything in `src/domain/*.ts` takes plain
  data in and returns plain data out — no Prisma, no Express. That's what
  makes it fully unit-testable without a database (see `test/*.test.ts`),
  and it's the part of the codebase that encodes the actual product
  decisions (dealbreaker vetoes, the closure SLA, the cancellation ladder,
  the 3x unit-economics guardrail).
- **The Closure Guarantee is enforced, not just documented**: there is no
  API path that ends a match without a valid taxonomy reason —
  `fileClosure` throws on a missing or invalid reason, and the route layer
  validates the reason before ever touching the database. Silence is
  handled by `POST /api/matches/:id/enforce-silence`, intended to be called
  by a scheduled job once `isWithinClosureSla` reports a match's SLA has
  expired with no `ClosureEvent` on file — it forfeits the silent party's
  escrow deposit to the counterparty and dents their accountability score.

## What's intentionally not built yet

This is a backend + demo-UI scaffold, not the full 7-day MVP from the spec.
Not implemented:

- Real Twilio/Deepgram call handling (interview endpoint takes a transcript
  directly, as if STT already ran).
- Real GPT-4o structured extraction (mock keyword extraction + hashing
  embedding instead — deterministic and dependency-free, but not
  semantically rich).
- Real Stripe checkout (mock provider always succeeds).
- Real eID/liveness verification vendor integration.
- A scheduled job to call `enforce-silence` automatically once the closure
  SLA lapses (the endpoint exists; nothing calls it on a timer yet).
- Auth/sessions — every endpoint trusts the `userId` in the request body.

## Project layout

```
prisma/schema.prisma   data model
prisma/seed.ts          demo seed data
src/adapters/           external-service interfaces + mocks
src/domain/             pure business logic (matching, closure, dates, payments, intent, escrow)
src/routes/             Express route handlers
src/server.ts           app entrypoint
public/index.html       demo UI
test/                   Vitest unit tests for src/domain
```
