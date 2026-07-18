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
