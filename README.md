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

Needs a real Postgres database — this isn't a zero-config single-file setup
(it originally was, on SQLite; see the note in `prisma/schema.prisma` for
why that changed). Point `DATABASE_URL` at any Postgres instance you can
create/drop tables in — a local one, a Docker container, or a hosted free
tier (this project's own deployed copy uses a free Render Postgres
instance).

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL
npm run db:push        # applies the schema to that database
npm run db:seed        # seeds two verified, pre-matched demo users
npm run dev             # http://localhost:3000
```

Open `http://localhost:3000` for a step-by-step demo UI that walks the full
flow: create users → run the (stand-in) voice interview → verify → find a
match → approve → schedule/attend a date → file a Closure Guarantee event.
It also has a button that deliberately tries to skip the closure reason, to
show the API rejecting it.

Run the test suite:

```bash
npm test
```

Most of it is pure domain-logic unit tests with no DB involved. The
integration tests (matching, silence enforcement, accountability reset,
no-shows, escrow) need a reachable Postgres — set `TEST_DATABASE_URL` (or
just reuse `DATABASE_URL`) to one you're fine with tests creating and
dropping schemas in. Each test file gets its own uniquely-named schema via
`test/helpers/setupTestDatabase` (`?schema=test_xxx` on the connection
string), so they never collide with your dev data or each other, even
running concurrently.

## Deploying

`render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec):
it declares the web service and its Postgres database together, and wires
`DATABASE_URL` between them by reference (`fromDatabase`) — Render resolves
the actual connection string itself, server-side, on every deploy. Nobody
ever needs to read, copy, or paste it by hand.

To apply it: in the Render dashboard, **New → Blueprint**, point it at this
repo. This project's own deployed copy (`closure-app` + `closure-db`) was
originally created before this file existed, as two separate standalone
resources with the database's connection string set manually — if Render's
Blueprint sync detects them and offers to adopt them under blueprint
management, accept that; if it creates fresh ones instead, the old
standalone pair can be deleted once the new ones are confirmed working.

## How the spec maps to the code

| Spec mechanic | Where it lives |
| --- | --- |
| Voice interview → structured profile | `src/adapters/mock.ts` (`MockProfileExtractor`), `POST /api/users/:id/interview` |
| Agent-to-agent negotiation, "one match, not a feed" | `src/domain/matching.ts` (`findBestMatch`, dealbreaker veto, cosine similarity), `POST /api/matches/find/:userId` |
| **Closure Guarantee** (the differentiator) | `src/domain/closure.ts` — reason taxonomy, SLA, escrow resolution, accountability score; `POST /api/matches/:id/closure` |
| Silence enforcement (scheduled) | `src/domain/silenceEnforcement.ts`, `src/jobs/scheduler.ts`, `scripts/enforce-silence-sweep.ts` |
| Escrow deposit / commitment device | `src/domain/escrow.ts`, `EscrowLedgerEntry` model |
| Pay-per-date, success fee, unit economics | `src/domain/payments.ts`, `POST /api/dates/:id/attend`, `POST /api/matches/:id/report-success` (also resolves escrow — see below) |
| Cancellation ladder (free → fee → suspension), rolling window + score reset | `src/domain/dates.ts`, `src/domain/accountabilityReset.ts`, `POST /api/dates/:id/cancel` |
| No-show handling (full escrow forfeiture, harsher than the ladder) | `src/domain/noShow.ts`, `POST /api/dates/:id/no-show` |
| Mandatory ID + liveness verification | `src/adapters/mock.ts` (`MockVerificationProvider`), `POST /api/users/:id/verify` |
| Intent locked 30 days, separate matching pools | `src/domain/intent.ts` |
| Vouching web | `src/routes/vouches.ts`, `Vouch` model |
| **Real multiplayer leveling** — trust built between two real matched users, XP, perks, guaranteed connections | `src/domain/leveling.ts`, `src/domain/trustPrompts.ts`, `src/domain/promptPool.ts`, `POST /api/matches/:id/trust/respond` |

## Real multiplayer leveling

Validated first as a standalone playable prototype (scripted NPCs, browser
`localStorage` only — no backend), then built into the real app: real
accounts, real persisted state in Postgres, trust that only moves when two
actual matched users both participate.

- **The mechanic**: `src/domain/promptPool.ts` holds a fixed pool of real
  trust-building prompts, shared across every match. Each prompt offers
  three ways to engage — `DIRECT`, `GUARDED`, `DEFLECT` — mirroring the
  same honesty/follow-through axis the rest of the app is built around,
  not generic dialogue flavor.
- **XP is yours alone.** `src/domain/leveling.ts`'s `XP_FOR_STYLE` awards
  xp to whichever user responds, the moment they respond — independent of
  whether or how their match answers. Leveling reflects your own proven
  behavior, not time spent in the app; `User.xp` only ever goes up, kept
  deliberately separate from `accountabilityScore` (a penalty ledger that
  can fall).
- **Trust is mutual — one person can't move it alone.**
  `src/domain/trustPrompts.ts`'s `respondToPrompt` only resolves a trust
  delta onto the `Match` once *both* sides have answered the same prompt
  (`trustDeltaForPair` in `leveling.ts` — mutual directness earns the
  most, one-sided honesty earns some credit, mutual deflection actively
  costs trust). Crossing `GUARANTEE_TRUST` (80/100) sets `Match.guaranteedAt`
  once, permanently — the real, database-backed version of "a certain
  point guarantees a connection."
- **Perks are honestly labeled real vs. not yet.** Each entry in `PERKS`
  (`src/domain/leveling.ts`) carries `implemented: true` or `false`. Level
  2's "Read the room" is real: it surfaces the counterpart's top declared
  value (`PreferenceProfile.values[0]`) as a hint before you answer their
  next prompt — actual profile data already in the database, not a
  scripted line. The rest (faster matching, a lower bar to guarantee a
  connection, a vouch counting double, ...) are `implemented: false` —
  stated design intent, returned by the API and shown in the demo UI, but
  not yet wired to change any real behavior. Same honesty this README
  tries to hold itself to everywhere else about what's built vs. planned.

## Architecture notes

- **Database**: Postgres via Prisma (`prisma/schema.prisma`). This started
  as a SQLite scaffold for zero-config local dev; it moved to Postgres
  specifically so the deployed copy's data survives a restart or redeploy
  (SQLite on a normal web host's ephemeral filesystem doesn't). Status/
  category fields are still plain `String` columns constrained by the
  TypeScript union types documented next to each field, not real Postgres
  `enum` types — that was originally a SQLite limitation, kept as-is
  deliberately so this migration only changed the connector, not every
  route/domain function's types. Converting to real enums is a separate,
  optional refactor. If you're running this project's own deployed copy:
  its database is a free-tier Render Postgres instance, which Render
  deletes 30 days after creation unless upgraded to a paid plan — that's a
  hosting-tier limit, not something this codebase controls.
- **Preference vectors**: stored as JSON-encoded float arrays and compared
  with cosine similarity in `src/domain/matching.ts`. The mock extractor
  (`hashEmbed` in `src/adapters/mock.ts`) is a deterministic bag-of-words
  hash standing in for a real embedding model — swap it for an actual
  embeddings call and move the column to a real `pgvector` type (now that
  the datasource is Postgres) if you want DB-level similarity search; the
  matching code only depends on "fixed-length vector + cosine similarity,"
  so nothing else changes.
- **Most domain logic is pure**: `src/domain/matching.ts`,
  `src/domain/payments.ts`, `src/domain/intent.ts`, and the standalone
  calculation functions in `closure.ts`/`dates.ts` take plain data in and
  return plain data out — no Prisma, no Express. That's what makes them
  unit-testable with zero external dependencies (`test/closure.test.ts`,
  `test/dates.test.ts`, `test/matching.test.ts`, `test/intent.test.ts`,
  `test/payments.test.ts`), and it's the part of the codebase that encodes
  the actual product decisions (dealbreaker vetoes, the closure SLA, the
  cancellation ladder, the 3x unit-economics guardrail). The rest of
  `src/domain/*.ts` — anything that's a cross-row query or a multi-step
  ledger operation (silence enforcement, escrow resolution, no-shows,
  accountability reset) — takes a `PrismaClient` and is exercised against
  a real, isolated Postgres schema instead (`test/silenceEnforcement.test.ts`,
  `test/escrow.test.ts`, `test/noShow.test.ts`,
  `test/accountabilityReset.test.ts`; see `test/helpers/testDb.ts`).
- **The Closure Guarantee is enforced, not just documented**: there is no
  API path that ends a match without a valid taxonomy reason —
  `fileClosure` throws on a missing or invalid reason, and the route layer
  validates the reason before ever touching the database. Filing itself is
  always accepted (a late explanation beats none), but the consequence
  depends on whether it actually beat the SLA:
  `isMatchOverdueForClosure` (`src/domain/silenceEnforcement.ts`) checks
  the same cutoff the automatic sweep uses, so a manual filing and the
  sweep never disagree about what counts as late. Filing on time releases
  the deposit as normal; filing after an attended date's 48-hour window
  has lapsed routes through `enforceSilenceForUser` — the exact
  consequence the automatic sweep would have applied, safely idempotent
  against a sweep that already got there first.
- **Silence is enforced automatically, on a schedule.** The closure SLA
  clock (`CLOSURE_SLA_HOURS` in `src/domain/closure.ts`) starts once a date
  is marked attended (`DateProposal.attendedAt`). `findSilenceObligations`
  in `src/domain/silenceEnforcement.ts` finds every (match, user) pair past
  that SLA with an outstanding escrow deposit and no `ClosureEvent` filed;
  `runEnforceSilenceSweep` forfeits each one's deposit to the counterparty,
  dents their accountability score, and closes the match. It's idempotent,
  so running it repeatedly or concurrently never double-penalizes anyone.
  Two ways to run it, and you only need one:
  - **In-process interval** (default): `src/jobs/scheduler.ts` runs the
    sweep every `ENFORCE_SILENCE_INTERVAL_MINUTES` minutes (default 15,
    runs once immediately on startup too). Fine for a single server
    instance or local dev — no extra infra needed.
  - **External scheduler**: `npm run job:enforce-silence`
    (`scripts/enforce-silence-sweep.ts`) runs one sweep and exits. Point a
    cron job / Kubernetes CronJob / scheduled function at this instead if
    you're running multiple API instances, and set
    `ENFORCE_SILENCE_DISABLED=true` so they don't also run the in-process
    interval redundantly.

  `POST /api/matches/:id/enforce-silence` still exists as a manual/admin
  trigger for the same consequence — both paths call the same
  `enforceSilenceForUser` function, so there's exactly one code path for
  "what happens when someone goes silent."
- **The cancellation ladder resets on a rolling window, both for the tier
  and for the score it docks.** `CANCELLATION_WINDOW_DAYS` in
  `src/domain/dates.ts` (90 days by default) is the single window that
  governs both halves:
  - `countCancellationsInWindow` only counts a user's cancellations from
    the last `CANCELLATION_WINDOW_DAYS` days (via `DateProposal.cancelledAt`)
    when deciding their ladder tier for the *next* cancellation — an old
    cancellation stops counting once it ages out, rather than accumulating
    against you forever.
  - A SUSPENSION-tier cancellation also dents `accountabilityScore` and
    records an `AccountabilityLedgerEntry` with an `expiresAt` set to the
    same window out. `src/domain/accountabilityReset.ts`'s
    `runAccountabilityResetSweep` finds every such entry whose window has
    elapsed with no reversal on file yet and credits the score back —
    idempotent for the same reason the silence sweep is (a reversed entry
    is excluded from the next sweep).

  Same two ways to run it as the silence sweep, controlled independently:
  in-process via `src/jobs/scheduler.ts`
  (`ACCOUNTABILITY_RESET_INTERVAL_MINUTES`, default 60,
  `ACCOUNTABILITY_RESET_DISABLED` to turn it off), or one-shot via
  `npm run job:accountability-reset`
  (`scripts/accountability-reset-sweep.ts`) from an external scheduler.
- **Reporting success also resolves escrow — it's a third way a match ends,
  besides an explicit closure filing or silence enforcement.** A held
  closure deposit only ever gets resolved along one of those three paths;
  without this, a match that succeeded would leave its depositors' escrow
  stuck unresolved forever, since nobody files a `ClosureEvent` when things
  work out. `POST /api/matches/:id/report-success`
  (`src/routes/success.ts`) charges the success fee for both users, then
  calls `releaseClosureDepositOnSuccess` (`src/domain/escrow.ts`) for each
  side — releasing a held deposit back if one exists, and a no-op for a
  side with no deposit (never approved) or one already resolved some other
  way (an explicit closure filing, or a silence forfeit if it raced with
  the success report). The route also rejects a second report on an
  already-`CLOSED` match with 409, so neither the fee nor the escrow
  release can double-fire.
- **A no-show forfeits the full deposit outright — no ladder, no fee
  tiers, no reset window.** `POST /api/dates/:id/no-show`
  (`src/routes/dates.ts`) lets whichever side showed up report that the
  other didn't, once the date's scheduled time has passed and it's still
  sitting in `SCHEDULED` (`canMarkNoShow` in `src/domain/noShow.ts`) — not
  eligible once it's already `CANCELLED`, `CONFIRMED_ATTENDED`, or already
  `NO_SHOW`, so a repeat report 409s. `recordNoShow` transitions the date,
  calls `forfeitClosureDepositForNoShow` (`src/domain/escrow.ts`) to take
  the no-show user's whole deposit and credit it to the counterparty, and
  applies `applyNoShowForfeit` (`src/domain/closure.ts`) — a permanent
  -30 accountability hit, harsher and non-recoverable unlike the
  cancellation ladder's SUSPENSION penalty, since a no-show is a one-off
  breach rather than a ladder tier meant to allow redemption.

  This is the fourth path that can resolve a held deposit (alongside an
  explicit closure filing, silence enforcement, and a success report), so
  every one of those checks against the same exported
  `TERMINAL_DEPOSIT_REASONS` (`src/domain/escrow.ts`) before acting —
  including `findSilenceObligations`, which used to check only for a prior
  silence forfeit and could otherwise have re-forfeited a deposit a
  no-show had already claimed, if a later date under the same match later
  lapsed its own closure SLA.

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
- Auth/sessions — every endpoint trusts the `userId` in the request body,
  which means a no-show report is also unauthenticated: nothing stops the
  reporter from lying about who showed up. Real dispute resolution (both
  sides can report, mismatches get flagged for review, etc.) isn't
  modeled. `PaymentProvider.refund` (`src/adapters/types.ts`) is
  implemented in the mock but has no caller — nothing currently reverses a
  charge (e.g. a disputed cancellation fee), which is the same gap.
- A `DECLINED` `Match` status is documented in the schema comment but
  nothing ever sets it — there's no "decline this match outright, before
  any date" endpoint, only `/approve`. Declining today means either never
  approving (the match just sits at `PROPOSED`/`PENDING_APPROVAL`
  indefinitely) or, once a date's been scheduled, cancelling or filing
  closure instead.
- Cancelling a date or recording a no-show doesn't update `Match.status`
  (it stays at whatever it was, e.g. `DATE_SCHEDULED`) — a new date can
  still be proposed on that match regardless, so nothing is functionally
  blocked, but the status field can read as stale until the match reaches
  an explicit terminal action (closure, success, or silence enforcement).
  Whether a no-show or cancellation should end the match automatically or
  leave it open for a reschedule is a product decision, not just a wiring
  gap, so it's left as-is rather than guessed at.
- "Multiplayer" (see above) means real accounts and real persisted trust
  between two real matched users, resolved turn-by-turn through
  `POST /api/matches/:id/trust/respond` — not a live, real-time shared
  world. There's no WebSocket layer, no presence, no players seeing each
  other move; each side calls the API on their own schedule and the
  server resolves trust once both have answered. A real-time version
  (live position, a rendered map) is a separate, much larger build this
  doesn't attempt.
- Most `PERKS` (`src/domain/leveling.ts`) are informational — returned by
  the API and shown in the demo UI, but not wired to change any actual
  behavior yet. Each one is explicitly marked `implemented: true` or
  `false` so this stays honest rather than silently overclaiming; only
  level 1 (one match at a time) and level 2 ("Read the room") do
  anything real today.

## Project layout

```
prisma/schema.prisma   data model
prisma/seed.ts          demo seed data
src/adapters/           external-service interfaces + mocks
src/domain/             business logic (matching, closure, dates, payments, intent, escrow, silence enforcement, accountability reset, no-shows, leveling)
src/routes/             Express route handlers
src/jobs/scheduler.ts   in-process interval runner for both scheduled sweeps
scripts/                one-shot entry points for external schedulers (cron, k8s CronJob, ...)
src/server.ts           app entrypoint
public/index.html       demo UI
test/                   Vitest tests (pure unit tests + Postgres integration tests, isolated per-schema)
test/helpers/testDb.ts  per-test-file isolated Postgres schema setup/teardown
```
