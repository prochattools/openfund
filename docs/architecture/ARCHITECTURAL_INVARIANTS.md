# Yeshua Academy Finance — Architectural Invariants

Status: APPROVED  
Owner: accounting and engineering owners  
Canonical for: durable invariants that implementation must never silently violate  
Last reviewed: 2026-07-18  
Depends on: `docs/PHILOSOPHY.md`, `docs/STRATEGY.md`, `docs/DOMAIN_MODEL.md`, `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`  
Related documents: `docs/architecture/SYSTEM_ARCHITECTURE.md`, `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`, `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md`

## Implementation status

Current implemented accounting and review behavior remains governed by `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`. This document records approved durable constraints for current and future work. Phase 3–7 target capabilities are not implemented merely because they are described here.

## Invariants

1. **Human-authorized confirmation creates accounting truth.** A suggestion, model response, retrieval result, or rule candidate is not a booking.
2. **Only confirmed outcomes become trusted learning examples.** Generated, rejected, shadow, or unconfirmed suggestions never reinforce later suggestions.
3. **Raw imported bank facts remain immutable.** Canonicalization, merchant knowledge, decisions, and bookings are separate records.
4. **Suggestions remain separate from bookings.** Read-side suggestion generation is side-effect free.
5. **Every booking is transactional and audited.** Actor, workspace, timestamp, source decision, and resulting accounting state remain traceable.
6. **Locked-period protections remain authoritative.** No decision engine, model, rule, or administrative shortcut may bypass them.
7. **Workspace isolation is universal.** Every query, identity, alias, rule, retrieval, candidate, model request, decision, booking, and audit record is scoped to one workspace.
8. **Merchant knowledge is separate from raw bank data.** Aliases and fingerprints may evolve; original transaction fields do not.
9. **Deterministic evidence and confirmed-history retrieval precede AI inference.** AI is optional and bounded, never the first source of truth.
10. **Models select only supplied valid IDs.** They may not invent projects, transaction types, categories, merchants, rules, or workspace identifiers.
11. **Models may abstain.** Ambiguity, conflict, novelty, missing candidates, or insufficient evidence must permit no recommendation.
12. **Dimensions remain independent.** Project, transaction type, and category are proposed, evidenced, scored, and corrected separately.
13. **Every recommendation carries provenance and versions.** Rule, merchant, retrieval, engine, model, prompt, calibration, and evidence versions must be identifiable where applicable.
14. **Confidence is calibrated evidence.** Raw model self-report is never presented as a validated probability.
15. **No automatic booking without separate approval.** Automation requires explicitly approved precision, safety, authorization, audit, monitoring, rollback, and locked-period gates.
16. **Conflicting evidence is preserved.** Supporting evidence may not erase contradictory confirmed history or deterministic conflicts.
17. **Financial integrity outranks convenience, latency, and model cost.** Failure must degrade to review or abstention, never silent guessing.

## Change control

Changing an invariant requires explicit architecture review, accounting review where relevant, an approved decision record, roadmap and implementation-plan reconciliation, rollback analysis, and validation evidence. Implementation alone may not redefine these rules.
