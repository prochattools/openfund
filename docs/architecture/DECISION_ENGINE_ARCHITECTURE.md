# Yeshua Academy Finance — Decision Engine Architecture

Status: APPROVED  
Owner: decision-intelligence owner  
Canonical for: decision orchestration, contributors, conceptual Decision contract, provenance, abstention, calibration, and evidence  
Last reviewed: 2026-07-18  
Depends on: `docs/architecture/ARCHITECTURAL_INVARIANTS.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md`, `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`, `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`  
Related documents: `docs/ROADMAP.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/DOMAIN_MODEL.md`

## Implementation status

Current review suggestions and bookings remain governed by the existing canonical accounting/review architecture. Unified Decision Engine orchestration, generalized retrieval, Bedrock Haiku, Sonnet fallback, and calibrated confidence are approved target architecture for future Phase 4–7 work and are not implemented by this document.

## Purpose

The Decision Engine is a side-effect-free orchestrator. It combines deterministic rules, merchant resolution, confirmed-history retrieval, restricted candidates, optional model inference, confidence calibration, and evidence into one auditable recommendation. It never creates accounting truth.

## Contributors and responsibilities

- **Rule contributor:** returns matched approved rules, deterministic candidates, conflicts, and rule versions.
- **Merchant contributor:** returns resolved or candidate merchant identity, signals, conflicts, and merchant-engine version.
- **Retrieval contributor:** returns bounded workspace-scoped confirmed examples, statistics, conflicts, and retrieval version.
- **Candidate contributor:** returns only currently valid project, transaction-type, and category IDs plus candidate-generation version.
- **Haiku contributor:** performs the default constrained high-volume classification when deterministic evidence is insufficient.
- **Sonnet contributor:** runs only for explicit ambiguity, conflict, novelty, or materiality escalation conditions.
- **Confidence contributor:** calibrates each dimension and the combined recommendation using benchmark evidence and a calibration-profile version.
- **Evidence contributor:** assembles deterministic, retrieval, model, supporting, and conflicting evidence with an evidence-schema version.

## Orchestration order

```text
validate workspace and immutable transaction facts
→ canonicalize approved derived fields
→ resolve merchant or record conflict/abstention
→ evaluate deterministic rules
→ retrieve eligible confirmed history
→ generate restricted valid candidates
→ decide whether deterministic evidence is sufficient
→ invoke Haiku when needed
→ invoke Sonnet only when escalation policy permits
→ validate structured output and candidate membership
→ calibrate per-dimension and combined confidence
→ assemble evidence, alternatives, provenance, and versions
→ persist or return a side-effect-free Decision for review
```

Any contributor may fail closed. Missing evidence, invalid output, provider failure, budget limits, or conflicts produce deterministic-only output, lower confidence, or abstention.

## Conceptual Decision object

A Decision conceptually contains:

- workspace identity;
- transaction identity and immutable source fingerprint;
- proposed project ID;
- proposed transaction-type ID;
- proposed category ID;
- project confidence;
- transaction-type confidence;
- category confidence;
- combined recommendation confidence;
- abstention state and reason codes;
- valid alternative candidates per dimension;
- deterministic rule evidence;
- merchant-resolution evidence;
- retrieved confirmed examples;
- supporting evidence;
- conflicting evidence;
- model and prompt provenance when inference occurred;
- rule version;
- merchant-engine version;
- retrieval version;
- candidate-engine version;
- Decision Engine version;
- model version;
- prompt version;
- calibration-profile version;
- evidence-schema version;
- generation timestamp;
- expiry or staleness information where applicable.

This is a conceptual architecture contract, not an exact database or API schema.

## Candidate restrictions

Models and deterministic contributors may select only supplied valid IDs. Candidate sets are workspace-scoped, direction-compatible, active where required, and versioned. Missing candidates require abstention or human selection. Stale or invisible IDs may not be submitted as valid recommendations.

## Dimension independence

Project, transaction type, and category are predicted, evidenced, calibrated, accepted, and corrected independently. Combined confidence cannot conceal a weak or missing dimension. The engine may abstain on one dimension while providing bounded evidence for another.

## Abstention and escalation

Abstention is required for insufficient candidates, unresolved merchant conflict, contradictory deterministic rules, invalid model output, missing provenance, unsupported dimensions, or confidence below approved thresholds.

Sonnet escalation is policy-driven, bounded, versioned, and observable. Potential triggers include conflicting high-quality history, novel merchants, near-tied candidates, materially significant amounts, or explicit reviewer-risk rules. Sonnet may not bypass candidate restrictions or human confirmation.

## Side effects and accounting separation

Decision generation does not create bookings, modify raw facts, close periods, merge merchants, or update trusted history. Human confirmation passes through the existing administrator-only transactional booking path, including completeness, authorization, locked-period, audit, and workspace checks.

Only the resulting confirmed booking and review decision become trusted retrieval data.

## Reproducibility and auditability

A historical decision must be explainable from its transaction fingerprint, candidate set, contributor evidence, version identifiers, configuration identifiers, model provenance, calibration profile, and timestamps. Secrets and hidden chain-of-thought are never stored. Safe structured reasons and evidence are retained instead.

## Performance and cost boundaries

- Deterministic rules, exact merchant lookup, and cached statistics should complete before model invocation.
- Retrieval is bounded by candidates, examples, payload size, and latency.
- Haiku is the default model for eligible volume.
- Sonnet use is limited by explicit escalation and budget policy.
- Provider timeouts and retries are bounded and idempotent.
- Cacheable inputs include versioned merchant statistics and confirmed-history summaries; model responses are not reused across changed evidence or versions.
- Latency, token usage, cost, escalation rate, failures, and correction outcomes are observable by workspace-safe aggregates.

## Failure behavior

- Invalid or out-of-set model IDs are rejected.
- Malformed structured output is not partially trusted.
- Retrieval or provider outages degrade to review, not automatic guesses.
- Missing calibration prevents a calibrated green classification.
- Evidence assembly failure blocks high-confidence presentation.
- Version mismatch marks a decision stale and requires regeneration or human review.

## Future rollout boundary

Target rollout proceeds through deterministic evaluation, shadow inference, benchmark calibration, reviewer-visible suggestions, and controlled confidence exposure. Automatic booking is outside this architecture unless separately approved under the invariants and explicit precision, safety, audit, monitoring, and rollback gates.
