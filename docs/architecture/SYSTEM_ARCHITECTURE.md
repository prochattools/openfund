# Yeshua Academy Finance — System Architecture

Status: APPROVED  
Owner: engineering architecture owner  
Canonical for: long-term system context, major boundaries, and high-level data and event flow  
Last reviewed: 2026-07-18  
Depends on: `docs/PHILOSOPHY.md`, `docs/STRATEGY.md`, `docs/DOMAIN_MODEL.md`, `docs/architecture/ARCHITECTURAL_INVARIANTS.md`  
Related documents: `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`, `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`, `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md`

## Implementation status

Implemented behavior includes immutable bank imports, deterministic rules, review suggestions, human confirmation, audited bookings, locked periods, reconciliation, and reporting as documented by the existing canonical files. Merchant knowledge, generalized confirmed-history retrieval, Bedrock inference, calibration, and unified Decision Engine orchestration are approved target architecture for future phases and are not yet complete.

## System context

```text
Bank export
  → immutable source file and transaction facts
  → canonicalization
  → merchant knowledge (target)
  → deterministic rules
  → confirmed-history retrieval (target)
  → restricted candidate generation (target)
  → Decision Engine
       ├─ deterministic contributors
       ├─ optional Bedrock inference
       ├─ confidence calibration
       └─ evidence assembly
  → review queue
  → human-authorized confirmation
  → transactional audited booking
  → reconciliation, close, reporting
  → trusted confirmed-learning dataset
```

Observability and audit span every boundary. Workspace identity scopes the entire flow.

## Major ownership boundaries

- **Import and source boundary:** owns original files, statement controls, raw transaction facts, hashes, and duplicate protection.
- **Canonicalization boundary:** derives normalized fields without mutating source facts.
- **Merchant knowledge boundary:** owns workspace-scoped merchant identities, aliases, fingerprints, resolution evidence, and merge/split history.
- **Rules boundary:** evaluates approved deterministic conditions and produces versioned evidence.
- **Retrieval boundary:** reads only eligible confirmed history and returns ranked supporting and conflicting examples.
- **Candidate boundary:** restricts valid project, transaction-type, and category IDs.
- **Decision Engine boundary:** orchestrates contributors, abstention, escalation, confidence, alternatives, and provenance without creating bookings.
- **Review boundary:** presents decisions and evidence, allows authorized edits, and submits one explicit decision.
- **Accounting boundary:** validates authorization, completeness, locks, transactional integrity, audit, and booking creation.
- **Observability boundary:** records latency, failures, correction rates, confidence outcomes, model costs, and version identities without exposing secrets or unnecessary financial data.

## Data flow

1. Import stores immutable facts.
2. Canonicalization extracts reusable normalized signals.
3. Merchant resolution proposes a workspace-scoped identity and evidence.
4. Rules and retrieval independently contribute evidence.
5. Candidate generation supplies only valid IDs.
6. The Decision Engine may invoke AI only after deterministic work.
7. Calibration converts engine outputs into evidence-backed confidence bands.
8. Evidence is assembled into a side-effect-free review decision.
9. An administrator confirms or corrects one transaction.
10. The accounting service creates the audited booking transactionally.
11. Only the confirmed outcome becomes eligible retrieval history.

## Event flow

Conceptual domain events include:

- `TransactionImported`
- `TransactionCanonicalized`
- `MerchantResolutionProposed`
- `RuleEvaluationCompleted`
- `ConfirmedHistoryRetrieved`
- `CandidatesGenerated`
- `InferenceCompleted`
- `DecisionGenerated`
- `ReviewConfirmed`
- `BookingCreated`
- `CalibrationProfileUpdated`

Current flows may remain synchronous. Future asynchronous processing may handle expensive retrieval, benchmark evaluation, shadow inference, statistics refresh, and observability aggregation. Any asynchronous design must preserve idempotency, workspace scope, ordering requirements, immutable evidence, and safe retry behavior.

## Workspace isolation

Workspace identity is established server-side and must be present at every boundary. Cross-workspace aliases, history, candidates, model context, cache entries, decisions, and audit records are prohibited. Cache keys and background jobs must include workspace identity.

## Failure behavior

- Import failures preserve source evidence and create no partial accepted statement.
- Missing or conflicting merchant evidence yields unresolved resolution.
- Rule or retrieval failures degrade to review, not guessing.
- Model timeout, invalid schema, unavailable provider, or budget exhaustion yields abstention or deterministic-only output.
- Calibration or evidence failure prevents a high-confidence presentation.
- Booking failures roll back transactionally and preserve the review item.

## Security and privacy

Model providers receive only the minimum approved transaction context and restricted candidates from trusted server-side code. Secrets, session tokens, unrelated workspace data, raw files, and unnecessary personal data are excluded. Requests and responses carry safe provenance identifiers and retention follows approved privacy and audit policies.
