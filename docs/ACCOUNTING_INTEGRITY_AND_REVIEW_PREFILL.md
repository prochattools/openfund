# Accounting integrity and review-prefill architecture

Status: implemented and validated locally; production execution remains owner-gated  
Date: 2026-07-12  
Depends on: `docs/PHILOSOPHY.md`, `docs/STRATEGY.md`, `docs/DOMAIN_MODEL.md`, `docs/MODEL_003_CLASSIFICATION_RECORDS_PROPOSAL.md`  
Roadmap: Phase 18 and Phase 19  
External AI: explicitly deferred

## Access control

Production access is Clerk-only. The server verifies the Clerk session and
maps the verified identity to an active local user and workspace membership
before exposing review, accounting, or evaluation data. API requests without a
valid session return `401` JSON; authenticated users without membership return
`403`; browser pages redirect unauthenticated users to `/sign-in`. Client
identity headers are not trusted. Read endpoints remain side-effect free, and
review, booking, close, import, report, and email mutations remain
administrator-only.

## What this capability is

This capability adds two related safeguards to Yeshua Academy Finance:

1. **Accounting integrity control** — a read-only, cent-exact audit of opening balances, monthly movement, yearly movement, category totals, continuity, duplicates, unresolved transactions, and expected historical controls.
2. **Review prefill** — a local history-based recommendation engine that proposes a complete `Klant` / `Type` / `Category` triple for every unresolved transaction while preserving mandatory human approval.

It is not autonomous bookkeeping, a generic machine-learning platform, or a replacement for the existing deterministic rule engine. Suggestions remain evidence-backed proposals. Only an administrator can turn a non-deterministic proposal into a final `TransactionBooking`.

## Why this is needed

The imported 2024–2026 transaction facts reconcile to the approved historical controls, but the live reporting path exposed two gaps:

- the initial opening balance of EUR 1,721.86 was validated during import but was not guaranteed to be persisted as an `OpeningBalance` record;
- 221 unresolved 2026 transactions have no final booking and therefore need administrator review, but the review experience should start with the best complete historical proposal instead of blank dimensions.

Both gaps must be solved without weakening the application philosophy:

- money remains integer minor units;
- source bank facts remain immutable;
- uncertain predictions never auto-book;
- every write is explicit, auditable, and owner-gated;
- production mutation is never the default behavior.

## Reuse and sustainability assessment

The existing codebase contains suitable foundations and should be extended rather than replaced:

- `monthlyReconciliationService.ts` already performs cent-exact monthly controls using `BigInt`-compatible minor units;
- `monthlyReconciliationAuditService.ts` already verifies coverage, continuity, duplicate fingerprints, running balances, unresolved counts, category differences, and yearly baseline controls;
- `OpeningBalance` has a unique `(accountId, effectiveDate)` key and locking metadata;
- `CategorizationSuggestion` already stores ranked complete dimensions, matcher, confidence, integer `scoreBasisPoints`, evidence JSON, and immutable evidence hashes;
- `reviewQueueService.ts` already exposes ranked alternatives and explicitly reports no booking side effect;
- `TransactionBooking` and `ReviewDecision` already separate suggestions from final accounting decisions;
- the philosophy already permits review prefill while prohibiting heuristic auto-booking.

The main architectural gaps are orchestration and production-safe APIs, not missing domain concepts. New generic frameworks, external vector databases, and external AI providers would increase complexity without first proving that the existing 681 approved historical bookings are insufficient.

## Phase 18 — Accounting integrity control

### Read-only accounting audit

A dedicated service and endpoint must calculate all controls from canonical database records and return integer minor-unit strings.

Required endpoint:

```text
GET /api/accounting/audit
```

Required controls:

- transaction count per month and year;
- opening balance;
- income;
- expense;
- net movement;
- closing balance;
- `opening + income - expense = closing`;
- categorized income equals total income;
- categorized expense equals total expense;
- previous month closing equals current month opening;
- duplicate import-fingerprint count equals zero;
- running-balance error count equals zero;
- unresolved transaction count is visible and blocks close, but does not invalidate a partial/open-period movement audit;
- approved yearly baseline controls for 2024, 2025, and the supplied 2026 partial period.

A control is represented as an integer difference. Success means every required difference equals the string `"0"`; floating-point euro arithmetic is forbidden.

The endpoint is read-only and must not create balances, bookings, closes, snapshots, audit events, or other records.

### Opening-balance repair

The approved initial control is:

```text
Account: ING Betaalrekening Yeshua Academy
Effective date: 2024-01-01 UTC
Amount: 172186 minor units (EUR 1,721.86)
```

The repair operation must be:

- administrator-only;
- dry-run by default;
- idempotent;
- account-identity verified;
- conflict-detecting;
- explicit about whether a write would occur;
- audited when execution is approved;
- unable to overwrite a locked or conflicting value;
- unable to run against production without an explicit execution flag and owner approval.

Dry-run may report `WOULD_CREATE`, `ALREADY_CORRECT`, `CONFLICT`, or `ACCOUNT_NOT_FOUND`. It must never silently update a different amount.

No production execution is part of the implementation task.

## Phase 19 — Local history-based review prefill

### Prediction boundary

The engine predicts exactly one complete triple:

```text
projectId + transactionTypeId + categoryId
```

Production review categories are a flat DTO containing only `id` and `name`; the production `Category` model has no parent relation. The review UI therefore uses one authoritative category selector. Any main/subcategory grouping retained by legacy ledger display helpers is presentation-only and is never part of the review approval payload. A partial proposal is not valid as rank one.

### Evidence sources

The first version uses approved local history only:

- transaction direction;
- counterparty IBAN;
- normalized counterparty name;
- normalized description and payment purpose tokens;
- account;
- recurring amount evidence;
- calendar recurrence;
- frequency and recency of previously approved complete triples.

Amount-only, popularity-only, and direction-only evidence may influence a low-confidence fallback but may never create a final booking.

### Candidate generation and ranking

For each unresolved transaction:

1. collect prior `TransactionBooking` records with their source transaction facts;
2. discard candidates with incompatible direction;
3. group evidence by complete dimension triple;
4. calculate deterministic integer feature scores;
5. rank candidates deterministically using score, evidence strength, recency, frequency, and stable IDs as tie-breakers;
6. persist up to three immutable `CategorizationSuggestion` records with `algorithmVersion`, rank, score, evidence, and evidence hash;
7. guarantee a complete rank-one proposal when at least one compatible historical booking exists;
8. label weak fallback proposals as low confidence.

The engine must be deterministic: identical inputs and algorithm version produce identical rankings and evidence hashes.

### Human review

The review queue preselects rank one but does not create a booking. The administrator may:

- approve the prefilled complete triple;
- select another ranked alternative;
- manually change one or more dimensions and approve.

Every approval or correction produces an explicit `ReviewDecision` and the existing final-booking workflow remains authoritative.

There is no bulk uncertain auto-approval.

### Backfill API

Required endpoint:

```text
POST /api/categorization/suggestions/backfill
```

Default request behavior is dry-run. Dry-run reports counts, matcher distribution, confidence distribution, completeness, and planned writes. It performs no writes.

Explicit execution may create or replace only pending suggestions for unresolved transactions. It must not create `TransactionBooking`, close a period, or change imported bank facts.

### Evaluation

Before production execution, the algorithm must be evaluated against the 681 approved historical bookings.

Required evaluation modes:

- chronological holdout: predict later bookings from earlier bookings only;
- leave-one-out for repeated historical patterns where chronology is not violated;
- top-one complete-triple accuracy;
- top-three complete-triple accuracy;
- coverage: percentage receiving a complete rank-one proposal;
- confidence calibration by observed accuracy band;
- breakdown by matcher and evidence strength.

The goal is complete prefill coverage, not fabricated certainty. Low-confidence suggestions remain visibly low confidence.

## Implemented local behavior and measured validation

The implemented algorithm version is `history-v1`.

For every unresolved transaction, the local engine:

1. loads approved historical `TransactionBooking` records only;
2. excludes direction-incompatible history and the target transaction itself;
3. normalizes counterparty, IBAN, description, payment-purpose, account, amount, recurrence, frequency, and recency evidence;
4. groups evidence by complete `projectId` / `transactionTypeId` / `categoryId` triples;
5. ranks up to three deterministic candidates with integer `scoreBasisPoints`, stable tie-breaking, immutable evidence JSON, and a SHA-256 evidence hash;
6. labels matcher and confidence explicitly;
7. writes nothing during dry-run;
8. never creates `TransactionBooking`, `ReviewDecision`, period-close, or bank-fact mutations from prediction alone.

The administrator workflow is implemented as follows:

- the client loads `/api/ledger` and `/api/review` together;
- rank one pre-fills project, transaction type, and the authoritative flat category without populating final booking fields;
- confidence, reason, evidence summary, and ranked alternatives remain visible;
- the administrator may approve rank one, select another alternative, or manually correct any dimension;
- approval is disabled until `projectId`, `transactionTypeId`, and `categoryId` are all present;
- approval delegates to the existing `updateTransactionCategory` / `assignManualBooking` path, so `ReviewDecision` and `TransactionBooking` remain authoritative.

`DEFAULT` suggestions are intentionally review-only. Their measured chronological top-one accuracy is 31.09%, so they remain visibly low-confidence and are never eligible for autonomous approval or booking.

Measured evaluation over the 681 approved 2024–2025 bookings:

| Evaluation mode | Samples | Covered | Coverage | Top-one | Top-three |
|---|---:|---:|---:|---:|---:|
| Chronological | 681 | 679 | 99.71% | 489 / 679 = 72.02% | 539 / 679 = 79.38% |
| Safe leave-one-out | 681 | 679 | 99.71% | 502 / 679 = 73.93% | 556 / 679 = 81.89% |

Chronological confidence calibration:

- `FUZZY`: 429 / 484 correct = 88.64%;
- `OVERALL`: 2 / 2 correct = 100.00%;
- `DEFAULT`: 60 / 193 correct = 31.09%.

These results justify the local-first, human-in-the-loop design: strong evidence reduces review effort, while weak evidence remains a transparent editable proposal rather than fabricated certainty.

Local validation passed for ranking, backfill, review queue, authoritative review decisions, client mapping, review helpers, direct Next routing, accounting audit, monthly reconciliation, the 681-booking owner evaluation, and the production build. No production backfill, suggestion persistence, opening-balance repair, migration, deployment, commit, or push occurred.

## Why local-first instead of external AI

Local-first is chosen because it:

- learns the organization’s exact historical labels and three-dimensional taxonomy;
- keeps financial descriptions inside existing infrastructure;
- is deterministic, testable, reproducible, and auditable;
- has no per-transaction provider cost;
- can be validated against 681 known decisions before use;
- preserves the current human-approval control.

An external AI provider may be reconsidered only after local evaluation demonstrates a material unresolved accuracy gap. Any later AI phase requires a separate owner decision, privacy assessment, provider contract, redaction design, structured-output contract, cost controls, and a guarantee that AI cannot create final bookings.

## Rejected approaches

- **Autonomous AI booking:** violates the approved philosophy and audit boundary.
- **Amount-only matching:** unsafe for recurring but semantically different transactions.
- **Most-popular-category default:** creates false confidence and loses project/type context.
- **Reusing mutable transaction category fields as predictions:** mixes proposals with final accounting decisions.
- **Floating-point report totals:** cannot guarantee cent-exact controls.
- **Direct production repair script without dry-run:** too risky for financial data.
- **New generic ML infrastructure before baseline evaluation:** unnecessary complexity and operational burden.

## Validation and rollout gates

Implementation is complete only when:

- accounting audit tests prove all differences use integer minor units;
- the approved 2024–2026 baselines pass in fixtures;
- conflict and locked-opening-balance tests pass;
- dry-run tests prove zero writes;
- suggestion generation is deterministic and complete for compatible history;
- tests prove suggestions cannot create bookings;
- temporal/leave-one-out metrics are produced;
- server and production builds pass;
- documentation and implementation-plan statuses are updated;
- no production mutation or deployment occurs without separate explicit approval.




---

## Transaction Review and Intelligence Program — approved architecture extension

Status: **approved; documentation complete; implementation not started**  
Approved: 2026-07-16  
Roadmap: `docs/ROADMAP.md`  
Executable plan: `docs/IMPLEMENTATION_PLAN.md`  
Persistent handoff: `docs/finance-rebuild-run.md`

### Durable source-of-truth rule

Repository documentation is the durable project memory. Chat history is not an authoritative or persistent source. Significant work in this program must be selected from the roadmap, executed from the implementation plan, and checkpointed in the persistent handoff. Every completed slice must persist changed paths, validation evidence, commits, blockers, and the exact next task before another slice begins.

### Current problem and immutable controls

The production dataset currently contains 221 unresolved transactions requiring human review. Existing project and category prefills are frequently incorrect, which demonstrates that the current history-only recommendation path is not sufficiently refined. The current `Te beoordelen` card layout is inefficient at this queue size and causes excessive vertical scrolling.

The approved solution must preserve these controls:

- imported bank facts remain immutable;
- suggestions remain separate from final `TransactionBooking` records;
- suggestion reads never create bookings;
- human confirmation remains the source of accounting truth;
- confirmation remains individual, administrator-only, transactional, audited, and subject to locked-period protections;
- bulk confirmation remains disabled;
- generated or unresolved suggestions never become trusted training history.

### Phase 2 target review experience

Phase 2 replaces the large review cards with a compact server-paginated table or table-like responsive list. One row represents one transaction and visibly includes date, counterparty, description or payment purpose, amount, project, transaction type, category, reliability, and an individual confirm action.

Project, transaction type, and category are editable inline. Searchable selectors should be used where the existing component system supports them. An unchanged proposal uses a clear `Confirm` action; after an edit the action must communicate `Confirm changes` or an equivalent Dutch label. Each row exposes expandable evidence showing proposal source, deterministic or historical evidence, alternatives, supporting and conflicting evidence, and dimension-level confidence when available.

The layout must remain usable on mobile and must never depend on color alone.

### Pagination, ordering, and filters

`GET /api/review` will support server-side pagination with a default page size of 25 and allowed sizes of 25, 50, and 100. The response will expose:

- `page`;
- `pageSize`;
- `totalItems`;
- `totalPages`;
- `hasPreviousPage`;
- `hasNextPage`.

Every unresolved transaction must remain reachable. Pagination controls should appear at both ends of a long result set where practical. Default ordering is:

1. lowest reliability;
2. highest financial materiality;
3. oldest unresolved transaction.

Phase 2 filters cover reliability band, transaction direction, project, category, and unresolved or incomplete state. New-merchant and conflicting-history filters belong to later phases once those signals exist.

### Reliability presentation

Reliability is shown with color, text, and a percentage or integer score where available:

- green — `Very reliable`, initially at least 95%;
- amber — `Review carefully`, initially 75% through 94%;
- red — `Uncertain`, initially below 75%;
- gray — `Insufficient evidence`.

These are provisional product bands, not scientifically calibrated probabilities. Thresholds remain configurable until benchmark calibration is complete. Future confidence is dimension-specific for project, transaction type, category, and the combined recommendation.

### Future hybrid categorization architecture

Later phases implement this ordered decision path:

1. deterministic accounting rules;
2. merchant normalization;
3. confirmed-history statistics;
4. similar confirmed-transaction retrieval;
5. restricted candidate generation;
6. Claude Haiku classification through Amazon Bedrock;
7. application-side confidence calibration;
8. Claude Sonnet fallback for ambiguous cases;
9. human confirmation;
10. persistent learning from confirmed outcomes only.

Only human-confirmed bookings may become trusted examples. Project, transaction type, and category are predicted and scored independently. Models may choose only supplied valid IDs and must be able to abstain. AI output remains a suggestion and never directly creates accounting truth. Bedrock calls are server-side only. Claude Haiku is the planned high-volume classifier; Claude Sonnet is the fallback for ambiguous, conflicting, novel, or materially important cases. Claude Opus is not planned for routine transaction classification. No Bedrock or AI inference work is part of Phase 2.

### Merchant normalization requirements

A later phase will normalize variable bank descriptors into stable workspace-scoped merchant identities while preserving raw facts unchanged. Matching may consider raw counterparty, IBAN, creditor identifier, card descriptor, payment purpose, and recurring-payment patterns. Manual corrections become reusable deterministic aliases. Merchant identity and alias records remain auditable and workspace-isolated.

### Human feedback contract

The system must preserve whether a reviewer accepted all dimensions, changed only project, changed only transaction type, changed only category, changed multiple dimensions, rejected the proposal, selected an alternative, supplied a reason, or requested a reusable rule. The original suggestion and final decision remain available together with actor, timestamps, provenance, evidence hash, confidence inputs, and version identifiers.

### Benchmark and rollout gates

After human fact-checking, the 221 unresolved transactions become a frozen benchmark. Required metrics are project accuracy, transaction-type accuracy, category accuracy, complete-classification accuracy, top-three accuracy, precision by confidence band, correction rate, average review time, known-merchant versus new-merchant accuracy, false high-confidence rate, Haiku-to-Sonnet escalation rate, and cost per transaction.

The primary metric is **precision among transactions classified as very reliable**. Proposed gates are at least 95% complete-classification accuracy in the green suggestion band before treating that band as highly reliable, and approximately 99% precision before considering automatic booking. Sensitive, unusual, locked-period, or materially significant transactions may always require human review.
