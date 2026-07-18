# Yeshua Academy Finance — Merchant Knowledge Architecture

Status: APPROVED  
Owner: merchant-domain owner  
Canonical for: merchant identity, aliases, fingerprints, deterministic resolution, audit, and retrieval anchoring  
Last reviewed: 2026-07-18  
Depends on: `docs/architecture/ARCHITECTURAL_INVARIANTS.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md`, `docs/DOMAIN_MODEL.md`  
Related documents: `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`, `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md`, `docs/ROADMAP.md`

## Implementation status

Merchant normalization is approved target architecture for future Phase 3 work. It is not implemented by this document. Current raw transaction fields, review suggestions, bookings, and accounting behavior remain unchanged.

## Domain boundary

A merchant is a workspace-scoped knowledge entity, not a rewritten counterparty string. One merchant may be represented by many observed aliases and fingerprints. Original bank facts remain immutable and independently auditable.

Conceptual relationships:

```text
Workspace
  → Merchant
      → aliases
      → fingerprints
      → resolution evidence
      → approved deterministic knowledge
      → confirmed transaction history
```

This document intentionally does not define an exact Prisma schema.

## Identity and isolation

- Every merchant, alias, fingerprint, correction, merge, split, and audit record belongs to exactly one workspace.
- Raw counterparty names, IBANs, creditor identifiers, card descriptors, payment purposes, and recurring patterns remain transaction facts or derived observations; they are not silently overwritten.
- Merchant identities are stable across changing aliases but never shared across workspaces by default.
- Cross-workspace matching, cache reuse, statistics, and inference context are prohibited.

## Deterministic matching signals and precedence

Resolution evaluates strong identifiers before weaker textual or behavioral evidence:

1. exact workspace-scoped IBAN or account identifier;
2. exact creditor identifier;
3. exact stable card or payment descriptor identifier where available;
4. administrator-approved alias or fingerprint rule;
5. normalized counterparty descriptor;
6. normalized payment-purpose evidence;
7. recurring-payment pattern using direction, cadence, and bounded amount behavior.

A lower-precedence signal may support but must not silently override conflicting stronger evidence. Amount alone, popularity, or fuzzy text alone cannot create a trusted merchant identity.

## Alias and fingerprint lifecycle

Suggested lifecycle:

```text
observed → proposed → approved → trusted → deprecated
```

- Observed values preserve their source transaction and extraction version.
- Proposed aliases remain suggestions until deterministic evidence or an authorized correction approves them.
- Trusted aliases may support future deterministic resolution.
- Deprecated aliases remain auditable and may not be silently reused.
- Manual corrections may create reusable deterministic knowledge only through an explicit audited action.

## Conflict handling

When evidence points to multiple merchants, resolution abstains and presents:

- candidate merchant identities;
- supporting and conflicting signals;
- signal strengths and source records;
- previous manual corrections;
- a clear merge, split, or alias decision path.

Conflict resolution must never silently merge identities.

## Merge and split safety

- Merge and split are administrator-authorized, audited operations.
- Original transactions and prior resolution evidence remain unchanged.
- A merge records source merchants, destination merchant, actor, reason, timestamp, and affected aliases/fingerprints.
- A split records the previous merchant, resulting identities, redistributed evidence, actor, reason, and timestamp.
- Confirmed bookings are not rewritten automatically by merchant maintenance.
- Rollback restores knowledge links and status while preserving the audit chain.

## Audit requirements

Every knowledge change records workspace, actor or system source, timestamp, source transaction/evidence, prior state, new state, reason, engine version, and evidence hash where applicable. Resolution results identify the signals used and whether the result was deterministic, suggested, conflicted, or abstained.

## Retrieval anchor

A resolved merchant is a primary anchor for confirmed-history retrieval, but retrieval remains constrained by workspace, direction, valid dimensions, time, description, amount behavior, and conflicting history. Only confirmed bookings are eligible trusted examples.

Merchant statistics are derived, versioned, rebuildable views; they are not accounting truth.

## Interaction with rules and AI

- Approved merchant rules may contribute deterministic candidates.
- Merchant resolution precedes model inference.
- AI may receive a resolved or candidate merchant plus evidence, but may not create or merge merchant identities directly.
- Unresolved or conflicting merchants must remain visible to the Decision Engine and may trigger abstention or Sonnet escalation later.

## Migration and backfill principles

Phase 3 migration is additive:

1. introduce knowledge records without altering raw transactions;
2. derive candidate fingerprints in a dry run;
3. report collisions, conflicts, and coverage;
4. obtain approval for material merges or alias rules;
5. backfill idempotently in bounded batches;
6. verify workspace isolation, audit completeness, and reproducibility;
7. enable read-side use before any trusted matching behavior.

## Performance boundaries

Exact identifiers require indexed workspace-scoped lookups. Normalized descriptors require bounded, indexed candidate retrieval rather than full transaction scans. Recurring-pattern analysis may be precomputed asynchronously. Resolution must have deterministic limits on candidates, history, latency, and memory.

## Failure modes and rollback

Key failures include false merges, duplicate merchants, alias explosion, stale normalized values, cross-workspace leakage, and overreliance on weak signals. Mitigations are abstention, precedence rules, explicit conflicts, bounded candidates, audit, merge/split tooling, and dry-run evaluation.

Rollback disables merchant-assisted resolution and restores prior knowledge links or statuses. Because raw facts and bookings remain unchanged, the accounting record continues to function without the Merchant Knowledge Layer.




## Program Phase 3.1 — Source-grounded domain and data contracts

This section is the approved implementation-ready contract for Phase 3.1. It is grounded in the current repository at HEAD `94e6cbe` and does not implement schema, migrations, services, APIs, UI, backfill, Bedrock, or AI.

### Current-source findings

- `prisma/schema.prisma` keeps imported transaction facts on `Transaction`, including `description`, `counterparty`, `reference`, `rawRow`, `accountId`, `amountMinor`, `direction`, `hash`, and `importFingerprint`.
- `TransactionBooking` is the current confirmed accounting truth and is explicitly workspace-scoped, complete across project/type/category, evidence-hashed, actor-confirmed, and separate from suggestions.
- `CategorizationSuggestion` is workspace-scoped, ranked, evidence-hashed, nullable by dimension, and explicitly pending/resolved rather than accounting truth.
- `ReviewDecision` preserves before/after dimensions, actor, reason, evidence, evidence hash, and links to both suggestion and resulting booking.
- `FinanceWorkspace` and `WorkspaceMembership` establish the current workspace and role boundary. The request actor is resolved server-side in `server/auth/requestContext.ts`.
- `server/services/historySuggestionService.ts` retrieves only `ApprovedHistoryBooking` inputs and already scores exact IBAN, counterparty, description, purpose, amount, account, recurrence, and token similarity.
- `server/services/transactionSuggestionFacts.ts` extracts counterparty IBAN and payment purpose from immutable `rawRow` without rewriting it.
- `server/services/deterministicCategorizationService.ts` already represents complete triples, explicit conflict/unmatched states, evidence hashes, and side-effect-free categorization.
- `server/services/suggestionBackfillService.ts` already models dry-run planning, idempotent ordering, coverage distributions, and explicit no-booking/no-bank-fact side effects.
- `server/services/reviewDecisionService.ts` enforces administrator authorization, complete dimensions, same-workspace dimensions, locked-period protection, transactional booking creation, and audit.
- `server/services/auditLogService.ts` provides generic before/after audit records, but its current persistence model is user-scoped rather than a dedicated workspace-scoped merchant audit domain.
- `server/services/transactionFingerprint.ts` creates an import deduplication fingerprint. Merchant fingerprints must be separate because import identity and merchant identity have different semantics and lifecycle.

### Contract 1 — Merchant identity

- **Purpose:** stable workspace-scoped identity that groups multiple bank representations of the same economic counterparty.
- **Ownership:** Merchant Knowledge domain.
- **Workspace scope:** exactly one `FinanceWorkspace`; never globally shared by default.
- **Source-of-truth status:** approved knowledge, not a raw bank fact and not accounting truth.
- **Conceptual fields:** identity ID, workspace ID, canonical display name, status, created/updated timestamps, created/updated actor or engine source, version, optional replacement/merge target, and audit reference.
- **Lifecycle:** `PROPOSED`, `ACTIVE`, `CONFLICTED`, `MERGED`, `DEPRECATED`.
- **Uniqueness:** identity ID globally unique; canonical name need not be globally unique; any convenience uniqueness is workspace-scoped and must not force false merges.
- **Relationships:** aliases, fingerprints, resolution results, conflicts, merge/split decisions, confirmed-booking retrieval anchors.
- **Audit:** every state/name/merge/split change records before, after, actor, reason, workspace, version, and evidence.
- **Versioning:** merchant-domain schema version plus record version or update sequence.
- **Failure/abstention:** uncertain evidence creates no active identity assignment.
- **Rollback:** disable or deprecate identity knowledge without changing raw transactions or bookings.

### Contract 2 — Merchant alias

- **Purpose:** reusable approved mapping from a normalized observed descriptor to a merchant identity.
- **Ownership:** Merchant Knowledge domain; human approval required before trusted reuse unless an explicitly approved deterministic rule creates it.
- **Workspace scope:** alias matching and uniqueness are workspace-scoped.
- **Source-of-truth status:** approved knowledge only; original descriptor remains on `Transaction`/`rawRow`.
- **Conceptual fields:** alias ID, workspace ID, merchant ID, alias type, normalized value, optional raw example, status, source, approval actor/time, algorithm version, evidence hash.
- **Lifecycle:** `OBSERVED`, `PROPOSED`, `APPROVED`, `TRUSTED`, `DEPRECATED`, `REJECTED`.
- **Uniqueness:** trusted active alias key must resolve to at most one active merchant inside a workspace; collisions become conflicts.
- **Relationships:** merchant identity, source transactions, manual corrections, conflict records.
- **Audit/versioning:** all approvals, reassignments, and deprecations are versioned and audited.
- **Failure/abstention:** collision or insufficient support yields conflict, not last-write-wins.
- **Rollback:** deactivate alias and restore prior resolution behavior.

### Contract 3 — Merchant fingerprint

- **Purpose:** versioned deterministic observation used to match a transaction to candidate merchants.
- **Ownership:** Merchant Knowledge domain; derived from immutable facts.
- **Workspace scope:** every lookup and uniqueness constraint includes workspace identity.
- **Source-of-truth status:** rebuildable derived evidence, never a replacement for source fields.
- **Conceptual fields:** fingerprint ID, workspace ID, signal type, normalized value/hash, extraction version, source transaction ID, optional merchant ID, strength, status, evidence hash, timestamps.
- **Lifecycle:** `OBSERVED`, `MATCHED`, `CONFLICTED`, `DEPRECATED`.
- **Uniqueness:** source observation can be idempotently regenerated; strong active fingerprint values may map to at most one merchant per workspace unless explicitly conflicted.
- **Relationships:** source transaction, merchant identity, resolution result, conflict.
- **Audit/versioning:** extraction algorithm and normalization version are mandatory.
- **Failure/abstention:** malformed or empty values produce no fingerprint.
- **Rollback:** delete/rebuild derived fingerprints or disable an extraction version without touching imports.

Import fingerprints from `server/services/transactionFingerprint.ts` remain dedicated to transaction deduplication and must not be reused as merchant fingerprints.

### Contract 4 — Merchant-resolution result

- **Purpose:** side-effect-free outcome for one transaction and one resolution-engine version.
- **Ownership:** Merchant resolution service.
- **Workspace scope:** workspace ID is mandatory and validated against the transaction context.
- **Source-of-truth status:** recommendation/evidence only.
- **Conceptual fields:** transaction ID, workspace ID, resolved merchant ID or null, status, confidence/evidence band, supporting signals, conflicting signals, alternatives, resolution version, evidence hash, generated time, stale/expiry marker.
- **Lifecycle/status:** `RESOLVED_DETERMINISTIC`, `REVIEW_SUGGESTED`, `CONFLICT`, `UNMATCHED`, `STALE`.
- **Uniqueness:** at most one current result per transaction and resolution version; historical results remain auditable.
- **Relationships:** source transaction, fingerprints, aliases, merchant alternatives, later Decision retrieval anchor.
- **Audit/versioning:** exact signal and engine versions required.
- **Failure/abstention:** conflict, weak-only evidence, or missing workspace produces null merchant plus reason codes.
- **Rollback:** ignore or expire results and return to descriptor-based retrieval.

### Contract 5 — Merchant conflict

- **Purpose:** preserve ambiguity instead of silently choosing a merchant.
- **Ownership:** Merchant Knowledge domain.
- **Workspace scope:** one workspace only.
- **Source-of-truth status:** unresolved knowledge state.
- **Conceptual fields:** conflict ID, workspace ID, transaction/fingerprint/alias references, candidate merchants, supporting and opposing signals, status, created/resolved timestamps, resolver, resolution reason, version.
- **Lifecycle:** `OPEN`, `RESOLVED_TO_EXISTING`, `RESOLVED_TO_NEW`, `REJECTED_MATCH`, `SUPERSEDED`.
- **Uniqueness:** active conflict deduplicated by workspace, subject, and evidence hash.
- **Audit:** resolution is append-only evidence with actor and before/after candidates.
- **Failure/abstention:** open conflict forces merchant-resolution abstention and human review.
- **Rollback:** reopen or supersede resolution while retaining history.

### Contract 6 — Merge and split decision

- **Purpose:** safely maintain merchant identity boundaries without rewriting accounting facts.
- **Ownership:** administrator-authorized Merchant Knowledge maintenance.
- **Workspace scope:** all source and destination identities must share one workspace.
- **Source-of-truth status:** approved knowledge-maintenance decision.
- **Conceptual fields:** decision ID, action, workspace ID, source merchant IDs, destination/result merchant IDs, affected aliases/fingerprints, actor, reason, dry-run summary, before/after snapshots, evidence hash, decided time, version.
- **Lifecycle:** `PROPOSED`, `DRY_RUN_COMPLETE`, `APPROVED`, `APPLIED`, `ROLLED_BACK`, `REJECTED`.
- **Uniqueness:** idempotency key prevents duplicate application.
- **Audit:** mandatory full before/after and affected-count evidence.
- **Failure/abstention:** cross-workspace, cyclic, incomplete, or conflicting decisions are rejected.
- **Rollback:** restore prior knowledge links/statuses; never rewrite `TransactionBooking`.

### Contract 7 — Audit and provenance

Merchant Knowledge audit must include workspace ID even though the current generic `AuditLog` model is user-scoped. A later schema design must either extend the generic audit contract safely or introduce a dedicated workspace-scoped merchant audit record.

Required provenance: actor/system source, workspace, action, entity type/ID, before, after, reason, source transaction IDs, evidence hash, extraction/resolution/domain versions, timestamp, idempotency key, and correlation/operation ID where applicable.

Audit data is evidence, not a mechanism to mutate past records.

### Contract 8 — Workspace isolation

- Workspace identity is established server-side from active membership.
- Every merchant query, alias/fingerprint uniqueness check, cache key, backfill batch, conflict, merge/split decision, resolution result, and retrieval anchor includes workspace ID.
- User-scoped raw transactions may only enter Merchant Knowledge through a verified active workspace membership and the same workspace context used for dimensions and bookings.
- Client-supplied workspace or merchant identifiers are never trusted without server-side membership and ownership validation.
- Cross-workspace candidates, statistics, aliases, and retrieval examples are prohibited.

### Contract 9 — Retrieval-anchor contract

A retrieval anchor contains workspace ID, transaction ID, optional resolved merchant ID, resolution status, resolution/evidence versions, supporting fingerprints, conflict state, and evidence hash.

Rules:

- only `RESOLVED_DETERMINISTIC` or separately approved trusted manual resolution may be a strong merchant anchor;
- `REVIEW_SUGGESTED` may be supporting evidence but cannot suppress conflicts;
- `CONFLICT` and `UNMATCHED` force non-merchant retrieval or abstention;
- retrieval examples remain restricted to confirmed `TransactionBooking` outcomes;
- merchant identity does not itself imply project, type, or category;
- supporting and conflicting confirmed history remain visible.

### Contract 10 — Dry-run backfill result

- **Purpose:** measure merchant coverage and risk before writes.
- **Ownership:** Merchant Knowledge backfill planner.
- **Workspace scope:** exactly one workspace per run.
- **Source-of-truth status:** derived planning evidence only.
- **Conceptual fields:** run ID, workspace ID, algorithm versions, input counts, known/new coverage, proposed merchants, proposed aliases/fingerprints, collisions, conflicts, unresolved count, affected transaction IDs or bounded references, evidence hash, generated time, side-effect declaration.
- **Lifecycle/status:** `PLANNED`, `DRY_RUN_COMPLETE`, `APPROVAL_REQUIRED`, `REJECTED`, `SUPERSEDED`.
- **Uniqueness/idempotency:** deterministic run key from workspace, input boundary, and algorithm versions.
- **Audit/versioning:** input boundary and versions required.
- **Failure/abstention:** incomplete source coverage or collisions prevent executable approval.
- **Rollback:** delete or supersede planning output; no transaction or booking mutation exists to reverse.

Mandatory side-effect declaration:

```text
writesMerchantKnowledge: false
createsTransactionBooking: false
mutatesBankFacts: false
changesTrustedHistory: false
```

## Deterministic matching contract

Matching precedence is:

1. exact IBAN/account identifier;
2. exact creditor identifier;
3. stable card/payment descriptor identifier;
4. approved alias or fingerprint rule;
5. normalized counterparty;
6. payment-purpose evidence;
7. recurring-payment pattern.

Signals are represented individually with type, normalized value/hash, source transaction, strength, version, support target, conflict target, and evidence hash. Stronger conflicting evidence prevents a weaker match.

Resolution must abstain when:

- strong signals identify different merchants;
- an active alias/fingerprint collision exists;
- only weak text or amount similarity is available;
- workspace ownership cannot be proven;
- source fields are malformed or absent;
- the extraction/resolution version is unsupported or stale.

Human review is required for conflicts, proposed merges/splits, creation of trusted aliases from weak observations, and any correction that would change future deterministic resolution.

A manual correction becomes reusable knowledge only through an explicit administrator action that records the original proposal, final merchant decision, reason, actor, source transactions, evidence, and version. Correcting project/type/category alone must not implicitly create merchant knowledge.

Weak normalized text or amount similarity alone cannot create a trusted merchant because common descriptors, payment processors, variable amounts, and shared accounts can cause false merges. These signals may rank candidates but require stronger corroboration or human approval.

## Anticipated later source interactions

| Current source | Current responsibility | Future Merchant Knowledge interaction | Change likelihood | Protecting tests |
|---|---|---|---|---|
| `prisma/schema.prisma` | Transactions, workspace dimensions, suggestions, bookings, reviews, audit | Additive merchant-domain persistence only after Phase 3.2 approval | Likely | schema additive/no-drop, workspace uniqueness, migration replay |
| `server/auth/requestContext.ts` | Resolves authenticated user and workspace role | Supply verified workspace/actor context | Likely reuse; modification optional | active membership, viewer/admin, forged workspace rejection |
| `server/services/transactionSuggestionFacts.ts` | Extracts IBAN and payment purpose from raw rows | Reusable fact extraction input; should not own merchant state | Likely extension or shared extractor | raw-row variants, immutable input, null handling |
| `server/services/transactionFingerprint.ts` | Import deduplication identity | Explicitly separate from merchant fingerprints | Unnecessary for merchant semantics | existing fingerprint regression plus separation guard |
| `server/services/historySuggestionService.ts` | Scores confirmed-history triples | Consume optional merchant retrieval anchor and preserve conflicts | Likely in Phase 4, not Phase 3.1 | confirmed-only, known/new merchant, conflict, deterministic ranking |
| `server/services/deterministicCategorizationService.ts` | Combines rules/history with conflict and no-write behavior | Consume merchant evidence as a contributor later | Optional Phase 4 integration | conflict, abstention, evidence hash, no booking |
| `server/services/suggestionBackfillService.ts` | Dry-run and optional suggestion backfill | Pattern for merchant dry-run result and idempotent ordering | Reuse pattern; separate service likely | dry-run/no-write, bounded batches, workspace, reproducibility |
| `server/services/reviewQueueService.ts` | Presents raw facts, alternatives, evidence, no-write metadata | Later expose merchant identity/conflict evidence | Likely later | DTO, mobile/UI evidence, filters, no side effects |
| `server/services/reviewDecisionService.ts` | Admin-only transactional booking and audit | Must remain booking authority; merchant corrections use separate action | Booking modification unnecessary | admin, workspace, locks, transactionality, audit |
| `server/services/auditLogService.ts` | Generic user-scoped audit write | Possible extension or dedicated merchant audit adapter | Design decision unresolved | workspace scope, before/after, actor, idempotency |
| `tests/services/model002DomainSchema.test.ts` | Guards additive workspace-domain schema | Model for future merchant schema/migration guards | Likely extension/new focused test | no drop/delete/rewrite, indexes, replay |

## Additive schema and migration constraints for Phase 3.2

- no destructive table or column operations;
- no update of raw `Transaction` facts or `rawRow`;
- no rewrite of `TransactionBooking` or `ReviewDecision` history;
- all merchant-domain uniqueness is workspace-scoped;
- aliases/fingerprints preserve source and extraction version;
- merges/splits are audited and reversible at the knowledge-link level;
- dry runs and backfills are idempotent, bounded, resumable, and deterministically rebuildable;
- safe disable returns categorization to current raw/history behavior;
- unconfirmed suggestions never seed trusted merchant mappings or retrieval history;
- migrations include disposable-database replay and rollback/safe-disable evidence.

## Connection to the corrected 221-transaction benchmark

The Phase 3 contract improves the benchmark by measuring and enabling:

- **known merchant coverage:** how many items resolve deterministically to an approved merchant;
- **alias consolidation:** how many variable descriptors collapse into the same audited identity;
- **reduced false history matches:** merchant conflicts and stronger identifiers prevent weak-text contamination;
- **better retrieval anchoring:** Phase 4 can retrieve confirmed outcomes for the correct merchant rather than broad descriptor similarity;
- **conflict visibility:** ambiguous processor/shared-account cases are counted and reviewed rather than hidden in high confidence;
- **known-versus-new evaluation:** accuracy and correction rate can be segmented by resolved merchant status;
- **correction reuse:** explicit merchant corrections become approved aliases/fingerprints without learning from incorrect category suggestions.

Phase 3 success is not the number of merchants created. It is improved, measurable categorization precision and safer retrieval for the 221 transactions while preserving abstention where evidence is insufficient.

## Phase 3.1 unresolved design decisions

The following remain intentionally deferred to Phase 3.2 exact schema design:

- whether merchant audit extends `AuditLog` with workspace ownership or uses a dedicated model;
- whether resolution results are persisted or initially computed/read-through;
- retention policy for raw alias examples and privacy minimization;
- which source-bank fields provide stable creditor/card identifiers across supported imports;
- exact inactive/merged uniqueness strategy in PostgreSQL;
- whether administrator merchant-maintenance UI belongs in Phase 3 or a later separately approved slice.
