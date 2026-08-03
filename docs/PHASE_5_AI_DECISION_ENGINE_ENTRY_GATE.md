# Phase 5 Entry Gate — AI Decision Engine

Status: GATE C POLICY APPROVED — METADATA VALUES PENDING — PHASE 5.4A NOT STARTED — SYNTHETIC SMOKE BLOCKED ON PHASE 5.4A — REAL SHADOW RUN BLOCKED  
Date: 2026-08-01  
Revised: 2026-08-01 — Tiered gates introduced; circular dependency removed  
Updated: 2026-08-01 — Gate A approved by owner; Phase 5.1 implemented and validated locally  
Updated: 2026-08-01 — Gate B approved by owner; Phase 5.2 and Phase 5.3 implemented and validated locally  
Updated: 2026-08-01 — Gate B contract layering corrected: four distinct contracts defined; raw provider response separated from internal context; abstention taxonomy split; non-throwing parser specified; direction values corrected to repository domain; grouped candidate arrays; label enrichment deferred; B9 bounds corrected  
Updated: 2026-08-02 — Gate C C1–C14 owner-decision package prepared; live verification, labeling strategy, and owner approval remain pending  
Updated: 2026-08-02 — Gate C policy decisions C1–C14 and labeling strategy (Option 2) approved by owner; C2, C3, C4, and C9 monetary caps remain unresolved; exact Option 2 cohort size remains pending owner selection; metadata-only verification plan and synthetic-invocation plan separated; C4 evidence split into metadata (C4a) and invocation proof (C4b); monetary-cap section now presents scenarios rather than automatic multiples of all 221 rows  
Updated: 2026-08-02 — Gate C sequencing corrected: non-circular Gate C-P/C-M/Phase-5.4A/Gate-C-S/Phase-5.4B progression defined; G.3 role corrected to post-Phase-5.4A validation gate; C4b blocks Phase 5.4B only; Phase 5.4A does not require invocation proof; exact cohort size and labels block Phase 5.4B only  
Depends on: `docs/ROADMAP.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/architecture/ARCHITECTURAL_INVARIANTS.md`, `docs/architecture/DECISION_ENGINE_ARCHITECTURE.md`  
Governed by: `docs/PHILOSOPHY.md`, `docs/STRATEGY.md`

## CURRENT STATUS (2026-08-03)

This document records decisions and implementation boundaries for Phase 5. **Phase 5 implementation and roadmap are explicitly deferred indefinitely.** The core finance application is live, production-ready, and does not require Phase 5 work or LLM/Bedrock functionality for ongoing use.

**What is committed to the repository:**
- Phase 5.1–5.3 code is committed as isolated disabled foundation work only
- No deployment integration exists
- No AWS access, credentials, or model configuration is present
- No Bedrock invocation path is active
- Phase 5.4 and Phase 5.4B remain unstarted
- Labeling strategy and metadata values remain undefined
- No production deployment is authorized or necessary

**What is NOT authorized:**
- AWS account access or credential creation
- Bedrock model invocation or testing
- Phase 5.4 implementation or execution
- Owner-history-v2 proposal changes (Phase 20 deployment is complete and separate from Phase 5)
- Database schema for shadow output or other Phase 5 persistence
- Any change to runtime behavior or production configuration

This document is archived as a deferred planning artifact. Owner and infrastructure decisions for Phase 5 remain pending indefinitely. The existing Phase 4 deterministic review workflow supports manual administrator confirmation and accounting close without Phase 5 features.

Gate summary (archived; Phase 5 deferred):

| Gate | Status as of 2026-08-02 | Current status (2026-08-03) |
|---|---|---|
| **Gate A** — Phase 5.1 disabled provider boundary | APPROVED (locally committed as of this finalization) | **DEFERRED** — committed only; not deployed or active |
| **Gate B** — Phase 5.2–5.3 payload and ID contracts | APPROVED (locally committed) | **DEFERRED** — committed only; not deployed or active |
| **Gate C** — Phase 5.4 real shadow inference | POLICY APPROVED / METADATA VALUES PENDING | **INDEFINITELY DEFERRED** — no metadata values resolved; no AWS access authorized; no Phase 5.4 implementation started |
| **Gate D** — Phase 6 evaluation; Phase 7 rollout | PENDING shadow output | **INDEFINITELY DEFERRED** — no shadow run authorized; evaluation path blocked |

---

## About tiered gates

The initial version of this brief had a single all-or-nothing gate that required model
accuracy, provider failure rate, inference latency, cost, calibration quality, and other
measurable properties before Phase 5.1 could begin. That was circular: Phase 5.1 is a
permanently disabled server-only provider abstraction that makes no external calls and
produces no model output. Measurable provider properties do not exist at Phase 5.1 time.

This revised brief defines four distinct gates, one per implementation boundary:

| Gate | Covers | Requires |
|---|---|---|
| **Gate A** | Phase 5.1 disabled provider boundary | Safety and architecture decisions only |
| **Gate B** | Phase 5.2–5.3 payload and ID contracts | Contract and privacy decisions |
| **Gate C** | Phase 5.4 real shadow inference | Provider, region, model, credentials, cost, privacy, labeling strategy |
| **Gate D** | Phase 6 evaluation; Phase 7 rollout | Measured model output; performance thresholds |

Gates A and B are independent of model performance because neither phase calls a provider.
Gates C and D require the operating and measurement decisions that were wrongly required at Gate A.

---

## Gate C progression — non-circular sequence

### Gate C-P — policy approval

**Status: COMPLETE**

Contains the already-approved policy choices C1–C14 and Option 2 labeling strategy.
It does not prove live AWS values or invocation capability.

### Gate C-M — metadata resolution

**Status: PENDING**

Resolved through Section G.2 only. No model invocation occurs.

Must establish:

- C1 live deployment-host identity evidence
- C2 exact region
- C3 exact pinned model identifier
- C4a catalog availability, documented access, quota, pricing, and provider-terms evidence
- C9 numeric daily, monthly, per-run, and single-smoke monetary caps
- Exact credential-delivery mechanism type

After Gate C-M is resolved and the owner confirms the resulting values, Phase 5.4A planning
and implementation may begin.

### Phase 5.4A — provider integration and synthetic-smoke readiness

**Status: NOT STARTED**

This is a no-invocation implementation slice. See Section I for the anticipated Phase 5.4A
scope. It may implement, after separate authorization:

- the server-only provider adapter
- AWS SDK dependency, only if explicitly authorized
- pinned region and model configuration
- credential-provider integration without exposing values
- default-off behavior
- kill-switch behavior
- timeout, retry, concurrency, rate, circuit-breaker, budget, and deduplication controls
- minimum-payload construction
- Phase 5.2 parsing integration
- Phase 5.3 semantic validation integration
- privacy-safe logging and metadata
- a fixed synthetic smoke-test harness
- tests proving no provider call occurs while disabled
- tests proving no accounting or review mutation

Phase 5.4A must not invoke a model, transmit real or synthetic payloads, create labels,
process the approved cohort, integrate inference into ordinary review reads, persist shadow
Decisions, or deploy automatically.

### Gate C-S — synthetic smoke validation

**Status: PENDING PHASE 5.4A**

This is the corrected role of Section G.3. It is a post-implementation validation gate,
not a pre-implementation prerequisite.

- G.3 is not a prerequisite to implementing Phase 5.4A.
- G.3 occurs only after Phase 5.4A is implemented and validated locally.
- G.3 proves the implemented provider boundary can invoke the pinned model safely.
- G.3 occurs before any real-data shadow run.
- Successful G.3 evidence resolves C4b.
- Failure leaves deterministic-only behavior active and blocks Phase 5.4B.

May occur only after:

- Phase 5.4A implemented and validated locally
- Exact code and configuration diff reviewed
- Credential delivery confirmed without recording values
- Default-off behavior implemented and tested
- Kill switch implemented and tested
- Logging/redaction behavior implemented and tested
- Numeric monetary caps implemented
- Synthetic payload approved
- Separate explicit invocation authorization issued

Gate C-S makes at most one synthetic invocation.

### Phase 5.4B — first real shadow run

**Status: BLOCKED**

This is the first phase allowed to transmit approved real transaction-derived fields.

Remains blocked until:

- Gate C-S succeeds and C4b is resolved
- Exact Option 2 cohort size selected
- Exact cohort-selection method frozen
- Label creation separately authorized and completed
- Labeled cohort frozen
- Monetary caps for the planned run confirmed
- Owner explicitly authorizes the first real shadow run

No real provider-backed cohort run belongs to Phase 5.4A.

---

## A. Purpose and current state

### What Program Phase 5 adds

Program Phase 5 introduces AWS Bedrock Claude Haiku as a constrained server-side inference
contributor to the Decision Engine. Its role is narrow: when deterministic rules, merchant
resolution, and confirmed-history retrieval produce insufficient confidence, Haiku proposes
one project, transaction type, and category from the supplied restricted candidate set. All
other Decision Engine invariants remain: no automatic booking, human confirmation is
mandatory, every suggestion carries versioned provenance, and the model may abstain.

Phase 5 runs exclusively in shadow mode. Shadow output is evaluated for accuracy against
human-confirmed labels but does not influence the review-queue presentation, reviewer
defaults, or trusted history. It cannot book transactions, close periods, or mutate any
financial fact.

### Why shadow mode must come first

The 221-transaction 2026 benchmark currently has zero confirmed labels. Without labeled
outcomes, the following properties cannot be measured:

- project accuracy, transaction-type accuracy, category accuracy;
- complete three-dimension accuracy, top-three coverage;
- false-high-confidence rate;
- abstention behavior on ambiguous or conflicting inputs;
- calibration quality.

Releasing inference output to reviewers before these properties are measured would mean
presenting uncharacterized recommendations as a reliable aid. The architecture explicitly
requires calibration evidence before calibrated confidence is exposed. Shadow mode is the
only honest intermediate state: the model runs, its outputs are collected, but those outputs
are kept entirely separate from reviewer-visible data and trusted history.

### Why the benchmark cannot currently assess accuracy

All 221 rows in the deterministic benchmark cohort carry status `UNLABELED_PENDING_CONFIRMATION`.
The benchmark runner executes successfully, produces a reproducible source hash and report hash,
and performs zero writes. However, accuracy metrics require at least one row where a
human-confirmed `ReviewDecision` / `TransactionBooking` pair provides the ground-truth label.
Zero such rows exist. Therefore all evaluator outputs — coverage, accuracy, top-three accuracy,
abstention rate, confidence calibration — are zero and undecidable. The Phase 5 gate is
`PHASE_5_GATE_UNDECIDABLE` / `NO_COMMITTED_NUMERIC_ACCEPTANCE_THRESHOLDS`.

### Why suggestions cannot be treated as confirmed labels

The 663 pending `CategorizationSuggestion` records from history-v1 are evidence-backed review
proposals, not confirmed outcomes. The architecture invariant is absolute: only confirmed
human decisions (`ReviewDecision` + `TransactionBooking`) become trusted retrieval history and
benchmark labels. Using suggestion content as benchmark ground truth would contaminate the
learning dataset with machine-generated output, directly violating Invariant 2 of
`docs/architecture/ARCHITECTURAL_INVARIANTS.md`.

### Why human confirmation is the only path to trusted history

An administrator reviews evidence, may correct the proposal, and explicitly submits a complete
project / transaction-type / category triple. That action creates an immutable `ReviewDecision`
record and a `TransactionBooking` record in one database transaction. Only these records feed
confirmed-history retrieval and benchmark labeling. This separation ensures that the accuracy
of any AI contributor can be measured against independently established human truth, not against
its own prior outputs.

### Current residual facts

The following facts are accurate as of 2026-08-01 and must not be treated as resolved:

- All Phase 5 work remains uncommitted and is not integrated or deployed.
- Phase 5.1 is not called by any route, review read, benchmark runner, background job, or startup code.
- The `InferenceAdapter` interface in Phase 5.1 is intentionally minimal and is expected to evolve after Gate B approval; it does not constitute a final provider contract.
- No live provider contract exists. No privacy approval exists. No real data may be sent to any provider.
- The restricted-candidate result does not currently carry display labels; label data comes from separate domain records (`Project`, `TransactionType`, `Category`).
- Display-label enrichment belongs to a later approved local payload-builder or integration slice before Phase 5.4; Phase 5.2 defines DTOs only and must not read live domain records.
- Full-repository TypeScript diagnostics contain pre-existing errors outside the two Phase 5.1 files; those errors predate Phase 5.

---

## B. Verified prerequisites

### Complete

The following Phase 4 contracts are implemented, validated, and in production:

| Prerequisite | Evidence |
|---|---|
| Confirmed-history eligibility contract | Phase 4.1 complete; `confirmed-history-v1` eligible set; zero writes |
| Deterministic bounded retrieval | Phase 4.2 complete; `deterministic-history-retrieval-v1`; 500-row default, 1 000 hard bound |
| Supporting and conflicting evidence | Phase 4.3 complete; `deterministic-retrieval-evidence-v1`; stable dimension evidence hashes |
| Restricted valid-ID candidate generation | Phase 4.4 complete; `restricted-retrieval-candidates-v1`; workspace-scoped, direction-compatible, active IDs only |
| Conceptual Decision contract | Phase 4.5 complete; `deterministic-decision-v1`; in-memory DTO; no persistence |
| Deterministic orchestration | Phase 4.6 complete; `deterministic-orchestration-v1`; rule and Merchant Knowledge contributors; fail-closed |
| Isolation and no-booking integrity validation | Phase 4.7 complete; zero planning writes; locked-period preserved; suggestion/booking separation proven |
| Reproducible benchmark runner | Phase 4.8 complete; source hash `524b03d6…`; report hash `526c3b66…`; replay verified; zero writes |
| Production deployment and read-only verification | Deployed on commit `8717a22`; 902 transactions; 681 bookings; 663 suggestions; 221 unresolved |
| Owner-history-v2 read-only verification | 663 legacy unowned suggestions; 178 proposed targets; 43 abstained; 0 expirations; zero writes |
| Suggestion producer ownership migration | Applied 2026-07-31; three nullable columns and two indexes on `CategorizationSuggestion` |

### Not yet approved or incomplete

| Prerequisite | Status |
|---|---|
| Labeled benchmark cohort | **0 confirmed labels.** All 221 rows are `UNLABELED_PENDING_CONFIRMATION`. |
| Numeric acceptance thresholds | **None committed.** See Gate D (Section H). |
| Provider configuration | **No Bedrock region, model ID, credential mechanism, or environment variable approved.** See Gate C (Section H). |
| Privacy and data-retention policy | **Not decided.** See Gate C (Section H). |
| Cost and operational budget | **Not decided.** See Gate C (Section H). |
| Shadow-output persistence policy | **Not decided.** See Gate C (Section H). |

---

## C. Benchmark-label acquisition decision

The benchmark cannot assess model accuracy until administrator review decisions establish a
frozen ground-truth cohort. Phase 5.1–5.3 are already complete locally and required no labels.
The owner must choose a labeling strategy before Phase 5.4 begins, but this documentation task
does not authorize label creation. Any review decisions require a separate explicit execution
task through the existing administrator review path.

The correct sequence is:

1. Implement the disabled Phase 5.1 boundary (Gate A — labeling strategy not required now).
2. Implement fixture-based payload and ID contracts (Gate B).
3. Approve a labeling strategy before Phase 5.4 begins (pre-Gate-C requirement — see note below).
4. Create labels through the existing administrator review flow at `/review`.
5. Approve the live provider and privacy envelope (Gate C).
6. Run Phase 5.4 in shadow mode.
7. Evaluate Phase 5.4 output in Phase 6 against frozen labels (Gate D).

**Note on labeling strategy:** selecting a labeling strategy is not required to implement Phase 5.1. Phase 5.1 makes no provider calls and produces no output to evaluate. Creating labels is not authorized before Gate C. A labeling strategy must be approved before Phase 5.4 real shadow inference begins (as part of Gate C). Frozen confirmed labels remain required for Phase 6 evaluation (Gate D).

The existing individual administrator review path on `/review` is the only authorized route
to benchmark labels. Each confirmed decision creates one `ReviewDecision` and one
`TransactionBooking` transactionally; both are audited; neither can be created in bulk or
bypassed. No other label source is permitted under the architectural invariants.

The 221 unresolved transactions represent the full 2026 partial-year open statement:
January through June plus early July. All are denominated in EUR. The suggestion matcher
distribution for these transactions after history-v1 persistence is: `NORMALIZED_HISTORY` 353
rows (across all three ranks), `FUZZY_HISTORY` 152, `DIRECTION_DEFAULT` 151, `BEST_HISTORY` 7.
The primary (rank 1) suggestion for each transaction is `DEFAULT` confidence for 218 and
`OVERALL` confidence for 3 of the 221 transactions.

### Option 1 — Label a small representative pilot cohort

**Size:** suggest 20–30 transactions, owner decides.

**Selection rules:** from the full 221, select transactions that represent:
- at least three distinct projects (Klant values);
- both credit and debit directions;
- at least one of each confidence band (high-evidence `OVERALL`, low-evidence `DEFAULT`);
- at least one transaction where the history-v1 rank-1 suggestion may be wrong, to provide
  a ground-truth counterexample.

Owner selects individually through the review UI. No automated selection or batch operation.

**Direction, merchant, amount, and evidence diversity:** moderate — enough to test multi-project
and multi-direction behavior, but with only 20–30 labels the sample is unlikely to represent
the full distribution of edge cases.

**Leakage and selection-bias risks:** high for a small cohort. If the owner selects only
easy, familiar, or high-confidence transactions, the pilot will overestimate accuracy. If
the selection is inadvertently correlated with how history-v1 works, the pilot may further
distort Phase 5 evaluation. The benchmark evaluator has no control over label quality.

**Reviewer effort:** low.
`ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT`: approximately 20–60 minutes for
20–30 individual decisions. Actual time depends on transaction familiarity and dimension complexity.

**Sufficiency:** sufficient for a preliminary smoke-test that the infrastructure works and
a rough directional accuracy check. Not sufficient for a full Phase 6 acceptance gate.
Phase 6 will require more labels.

---

### Option 2 — Label a larger stratified cohort

**Size:** suggest 60–100 transactions, owner decides.

**Selection rules:** stratified by project representation (aiming for proportional coverage of
each active Klant), transaction type, direction, and amount range. The owner decides the
specific transactions by reviewing the queue in risk-first order (lowest confidence first,
highest amount first within that band).

**Direction, merchant, amount, and evidence diversity:** substantially better than Option 1.
With 60+ labels distributed across projects and confidence bands, calibration estimates
become more meaningful.

**Leakage and selection-bias risks:** moderate. Risk-first review ordering (lowest confidence
first) tends to produce a harder cohort, which is conservative and appropriate for accuracy
assessment. Some positive bias remains because the labels come from the same dataset the
model will later be evaluated on.

**Reviewer effort:** moderate.
`ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT`: approximately 2–5 hours for 60–100
individual decisions. Actual time depends on transaction familiarity and dimension complexity.

**Sufficiency:** sufficient for a meaningful Phase 5 entry evaluation. May support preliminary
calibration estimates. Phase 6 will still require additional labels for full calibration.

---

### Option 3 — Complete all 221 administrator decisions before Phase 5

**Size:** all 221 transactions.

**Selection rules:** complete the entire open-statement review in the existing queue order
or in a prioritized order the owner chooses.

**Direction, merchant, amount, and evidence diversity:** maximum — the full open-statement
cohort.

**Leakage and selection-bias risks:** the full 221 rows remove selection bias within this
specific open-statement cohort but do not eliminate temporal, merchant, project, or
dataset-distribution bias. The cohort covers January through early July 2026 for one
organization's transactions; accuracy measured on this cohort may not generalize to future
periods, different merchant populations, or different organizations.

**Reviewer effort:** substantial.
`ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT`: approximately 5–15 hours depending
on transaction familiarity and dimension choices. Actual time is owner-determined.
After this work, the 2026 statement would also be close-eligible once the period is fully
categorized.

**Sufficiency:** maximum for this specific cohort. A complete 221-label cohort supports a
more comprehensive Phase 6 evaluation, but the bias caveats above remain.

---

### Option 4 — Keep Phase 5 blocked

**Action:** make no new review decisions at this time. Phase 5 entry gate remains
`PHASE_5_GATE_UNDECIDABLE`.

**Effect:** the benchmark evaluator continues to produce zero-valued accuracy metrics. Phase
5.1–5.3 remain locally complete, but Phase 5.4 shadow inference and Phase 6 evaluation remain
blocked under the selected owner policy. Phase 7 remains blocked. The 221 unresolved
transactions remain uncategorized and the 2026 statement cannot close.

**When appropriate:** if other priorities take precedence, or if the owner prefers to
fully evaluate the decision-brief before committing.

---

**Owner decision required:** choose one of Options 1–4, or specify a variant. This is a
strategy decision only and is part of Gate C. Phase 5.1–5.3 are already locally complete.
Selecting a strategy does not create labels; label creation requires a separate explicit task
through the existing administrator review path.

---

## D. Gate B — payload and contract decisions (Phase 5.2–5.3)

These decisions govern Phase 5.2 (structured request/response contracts) and Phase 5.3
(valid-ID enforcement). Phase 5.2–5.3 may use local fixtures or a stub and must not call
Bedrock. They do not require a live AWS account, model access, or any provider credentials.

Gate B defines four separate objects. These must not be collapsed or conflated.

---

### D.1 — Four distinct objects

#### Object A: Trusted internal invocation envelope (server-internal; never provider-bound)

The internal envelope carries the fields the server needs to establish identity, enforce
workspace isolation, detect replay attacks, and reject stale input. These fields exist
entirely inside the server and are never automatically transmitted to a provider.

**Purpose of each field:**

| Field | Purpose |
|---|---|
| `contractVersion` | Identifies the schema version of the envelope itself; allows safe evolution |
| `workspaceId` | Required for workspace isolation; every query and candidate is scoped to this workspace |
| `targetTransactionId` | Required for replay detection and result attribution |
| `transactionFactHash` | Detects stale or substituted transaction input; prevents silent replay |
| `candidateSetHash` | Binds response validation to the exact candidate set used in this invocation |

All five fields are server-internal. None may appear in the provider payload. The
`candidateSetHash` is passed to the Phase 5.3 semantic validator separately from the raw
provider response — the validator compares the trusted server value against nothing from
the model output, because the model must not be asked to echo hashes it cannot verify.

**Why these fields must stay internal:** workspace and transaction identity are required
for isolation, replay detection, and stale-input rejection. A model that receives these
values could inadvertently include them in its output. Even if the model echoed them
correctly, they would not be more trustworthy for having passed through the model — they
would be less trustworthy, because echo fidelity is not a security property. Trusted
provenance must be attached by application code, not authenticated through model output.

#### Object B: Provider-bound classification request (minimum structured payload)

This is the minimum structured payload that a future adapter may serialize for a provider
after Gate C approval. It must not contain any field from Object A.

Fields explicitly excluded from the provider payload:

- `workspaceId` — workspace identity; no value to model; isolation must be server-side
- `targetTransactionId` — internal replay identity; no value to model
- `transactionFactHash` — internal stale-input guard; no value to model
- `candidateSetHash` — internal candidate-set binding; model must not echo this
- `contractVersion` — internal schema versioning; model must not echo this
- database metadata, trusted internal provenance, credentials of any kind

Fields included in the provider payload (subject to Gate B approval decisions — see B2):

- transaction direction (`credit` or `debit` — exact repository domain values)
- transaction amount as a signed base-10 integer string, and currency (both-present-or-both-absent)
- restricted candidate descriptors organized by dimension (see B4)
- optional aggregate supporting and conflicting evidence counts per candidate

Fields deferred to Gate C privacy decision (not part of Phase 5.2):

- counterparty text (normalization/redaction policy must be approved first)
- payment purpose text (normalization/redaction policy must be approved first)
- bounded confirmed-history examples

#### Object C: Raw provider response

This defines what the model returns. It must contain only model-generated classification
output.

**Important constraint:** the raw provider response must not be required to echo internal
application context. A model cannot reliably echo a value it was never sent. Even when the
model has seen the value, a model-returned hash or version string must never be treated as
trusted provenance. Trusted metadata is attached by application code after the fact.

**Recommended raw response — discriminated union on `outcome`:**

Case `"PROPOSED"` — all three IDs required:

```
outcome:           "PROPOSED"  (required)
projectId:         string      (required)
transactionTypeId: string      (required)
categoryId:        string      (required)
```

No partial proposal is valid. A `PROPOSED` response missing any classification ID must be
treated as malformed by the Phase 5.2 parser.

Case `"ABSTAINED"` — all classification IDs absent:

```
outcome:          "ABSTAINED"  (required)
abstentionReason: string       (required; one value from the provider-declared reason set — see B8)
```

All three classification IDs must be absent or null.

**What the raw response must not include:**

- `contractVersion` — internal schema version; model must not return this
- `candidateSetHash` — internal hash; a model-supplied hash has no trust value
- confidence scores of any kind presented as calibrated application confidence
- free-form rationale, chain-of-thought, or reasoning text
- token usage, cost metadata, provider metadata
- unknown or unrecognized fields (strict schema required)

**On unknown-field rejection:** the Phase 5.2 schema must reject any response containing
unrecognized fields. This prevents a model from embedding prohibited content in unexpected
fields and makes schema evolution deliberate.

#### Object D: Internal parsed result

After the Phase 5.2 parser successfully validates a raw provider response, the application
combines the trusted internal envelope (Object A) with the validated raw response (Object C)
to produce an internal parsed result. This combination occurs server-side.

The internal parsed result may include:

- all fields from Object A (trusted, never touched by the model)
- the validated `outcome` and classification IDs from Object C
- the `abstentionReason` from Object C (provider-declared reason only, in the ABSTAINED case)
- application-generated metadata: internal system reason if parsing failed (see B8), timestamp, latency

Phase 5.3 receives the trusted envelope (Object A) separately from the parsed provider
response (Object C) — it never receives a single merged object where internal hashes could
be confused with model-supplied values.

---

### D.2 — Concrete B1–B9 decisions

#### B1. Internal-envelope fields

**Recommended exact field set:**

```
contractVersion       — string; server-internal only; never send to provider
workspaceId           — string UUID; server-internal only; never send to provider
targetTransactionId   — string UUID; server-internal only; never send to provider
transactionFactHash   — string hex; server-internal only; never send to provider
candidateSetHash      — string hex; server-internal only; passed to Phase 5.3 separately
```

All five fields are server-internal. None appears in the serialized provider payload or raw
provider response.

`RECOMMENDED — PENDING OWNER APPROVAL`

#### B2. Provider-bound transaction fields

The following fields are candidates for inclusion in the provider payload. The direction and
amount/currency decisions for Phase 5.2 are:

**Direction (use exact repository domain values):**

The `TransactionDirection` enum in `prisma/schema.prisma` defines exactly two values:
`credit` and `debit`. The provider payload must use these exact lowercase values. There is
no `CREDIT`, `DEBIT`, or `BOTH` in the repository domain, and none may be introduced
without a schema change.

| Decision | Recommended |
|---|---|
| Include `direction` | Required — model must respect direction-compatible candidate restrictions |
| Direction representation | Lowercase `"credit"` or `"debit"` — exact domain values |

**Amount and currency — all-or-nothing pair:**

Amount and currency must travel together or both be absent. There is no valid state where
amount is present without currency or currency is present without amount.

| Decision | Recommended |
|---|---|
| Amount representation | `amountMinor` as a signed base-10 integer string (for example `"12500"`) |
| Currency representation | ISO 4217 three-letter code (for example `"EUR"`) |
| Pairing rule | Both present, or both absent — no mixed state |
| Floating-point amounts | Prohibited |
| Integer amounts as number type | Prohibited |

**Text fields — deferred:**

The following fields are NOT part of the Phase 5.2 provider payload DTO. They require
normalization/redaction policies that belong to Gate C. Including them in Phase 5.2 DTOs
would misrepresent the current approval state.

| Field | Phase 5.2 status |
|---|---|
| Counterparty text | Deferred to Gate C — normalization/redaction policy not approved |
| Payment purpose text | Deferred to Gate C — normalization/redaction policy not approved |
| Bounded confirmed-history examples | Deferred to Gate C |

Their character limit bounds are also deferred and must not be documented as approved
Phase 5.2 limits.

**Candidate descriptors:**

Required in Phase 5.2 request DTO. See B4 for the approved structure.

**Aggregate evidence counts:**

Optional in Phase 5.2 request DTO. `supportingEvidenceCount` and `conflictingEvidenceCount`
are already available in `RestrictedRetrievalCandidate` and provide useful model signal
without requiring raw confirmed-history examples.

`RECOMMENDED — PENDING OWNER APPROVAL`

#### B3. Prohibited fields

The following must never appear in provider payloads. Items marked *(internal only)* are
permitted in the internal invocation envelope (Object A) but prohibited in the serialized
provider payload (Object B).

**Absolute prohibitions — provider payload (Object B):**

- credentials, session tokens, API keys, database connection strings
- `workspaceId` *(internal only)* — workspace isolation is server-side
- `targetTransactionId` *(internal only)* — internal replay identity
- `contractVersion` *(internal only)* — internal schema versioning
- `transactionFactHash` *(internal only)* — internal stale-input guard
- `candidateSetHash` *(internal only)* — internal candidate-set binding
- user ID
- account ID
- IBAN or masked IBAN fragments
- retained source file paths or file bytes
- raw imported CSV rows or original ING bank statement rows
- `TransactionBooking` IDs, `ReviewDecision` IDs
- unrelated transaction history (history from other transactions)
- cross-workspace data of any kind
- internal schema names, table names, migration metadata
- unrestricted evidence (unbounded confirmed-history retrieval output)
- hidden chain-of-thought, system-generated reasoning text intended as training input

**Absolute prohibitions — raw provider response (Object C):**

- free-form rationale or reasoning text
- model self-reported confidence presented as application confidence
- `contractVersion` — internal; model must not return this
- `candidateSetHash` — internal; a model-supplied hash has no trust value
- unknown fields (strict schema required; any unknown field causes the response to be treated as malformed by Phase 5.2)

`RECOMMENDED — PENDING OWNER APPROVAL`

#### B4. Candidate descriptor DTO

Candidates are grouped by dimension in the provider payload. Because the array membership
determines the dimension, a redundant `dimension` field in each per-candidate descriptor is
not required unless a specific documented benefit justifies the duplication.

**Recommended request payload candidate structure:**

```
candidates:
  projects:        ProjectCandidateDescriptor[]      (max 10; default max 5)
  transactionTypes: TransactionTypeCandidateDescriptor[] (max 10; default max 5)
  categories:      CategoryCandidateDescriptor[]     (max 10; default max 5)

total across all three arrays: maximum 30
```

**Common descriptor fields (all dimension arrays):**

| Field | Type | Required | Source |
|---|---|---|---|
| `candidateId` | string | yes | `RestrictedRetrievalCandidate.candidateId` |
| `rank` | integer 1–10 | yes | `RestrictedRetrievalCandidate.rank` |
| `displayLabel` | string (max 128 chars; pending approval) | yes | derived from domain record (see label sources below) |
| `supportingEvidenceCount` | non-negative safe integer | optional | `RestrictedRetrievalCandidate.supportingEvidenceCount` |
| `conflictingEvidenceCount` | non-negative safe integer | optional | `RestrictedRetrievalCandidate.conflictingEvidenceCount` |

**Transaction-type-specific additional field:**

| Field | Type | Required | Source |
|---|---|---|---|
| `transactionTypeDirection` | `"credit"` \| `"debit"` \| absent | optional | `TransactionType.direction`; lowercase; `BOTH` does not exist in the domain |

**Approved label sources (for future payload-builder slice — NOT Phase 5.2):**

| Dimension | Label fields available |
|---|---|
| `projects` | `Project.name` (recommended); `Project.code` as compact identifier |
| `transactionTypes` | `TransactionType.literalName` |
| `categories` | `Category.name` |

**Label enrichment boundary — critical correction:**

Phase 5.2 defines and validates DTOs and schemas only. It must not:

- import Prisma;
- query `Project`, `TransactionType`, or `Category` records;
- build a real provider payload from live data;
- read or validate any database record.

Display-label enrichment belongs to a separately approved local payload-builder or
integration slice before Phase 5.4. Gate B may approve the eventual label sources (listed
above) without authorizing or implementing enrichment now.

No candidate workspace IDs, internal UUIDs beyond `candidateId`, database timestamps,
inactive candidates, or workspace-internal metadata may appear in a candidate descriptor.

`RECOMMENDED — PENDING OWNER APPROVAL`

#### B5. Structured raw response schema

The raw provider response schema implements Object C from D.1.

**Concrete requirements:**

- Discriminated union on the `outcome` field: exactly `"PROPOSED"` or `"ABSTAINED"`.
- Classification IDs must be strings. Bounded length: maximum 128 characters each.
- `contractVersion` is absent from the raw response schema. The version is managed internally by Object A.
- `candidateSetHash` is absent from the raw response schema. The hash is managed internally by Object A and passed to Phase 5.3 separately.
- Unknown properties are rejected. The schema parser must fail closed on any property not in the schema definition.
- No partial proposals. A `PROPOSED` response missing any of `projectId`, `transactionTypeId`, or `categoryId` is malformed and treated as such by the Phase 5.2 parser.
- `abstentionReason` is required when `outcome` is `"ABSTAINED"`. Must be one value from the provider-declared reason set (see B8).
- No free-form rationale, chain-of-thought, confidence values, token usage, cost metadata, or provider metadata.

`RECOMMENDED — PENDING OWNER APPROVAL`

#### B6. Malformed-output behavior and non-throwing parser

When provider output fails parsing, the result must never escape as an unhandled exception.
The Phase 5.2 parser must accept raw text and return a typed result that callers can
pattern-match without needing a try/catch.

**Recommended parser function signature:**

```ts
parseProviderResponseText(rawText: string): ProviderResponseParseResult
```

**Recommended result type:**

```ts
type ProviderResponseParseResult =
  | Readonly<{ ok: true; value: RawProviderClassificationResponse }>
  | Readonly<{ ok: false; reason: 'MALFORMED_PROVIDER_OUTPUT' }>;
```

When `ok` is `false`, the calling application code converts this to an internal abstention
using the system reason `MALFORMED_PROVIDER_OUTPUT`. The `ok: false` result is not a valid
`ABSTAINED` provider response — it is an internal failure indicator generated by application
code, not by the model. The distinction matters because provider-declared reasons and
internal reasons are separate (see B8).

**Parser implementation steps (in order):**

1. Measure UTF-8 byte length of `rawText` before any parsing.
2. If byte length exceeds the approved response limit (see B9), return `{ ok: false, reason: 'MALFORMED_PROVIDER_OUTPUT' }`.
3. Attempt JSON parse inside a guarded boundary (try/catch); on any syntax error, return `{ ok: false, reason: 'MALFORMED_PROVIDER_OUTPUT' }`.
4. Apply the strict raw-response Zod schema (`.strict()`, no `passthrough()`, no `z.any()`).
5. On schema validation failure for any reason, return `{ ok: false, reason: 'MALFORMED_PROVIDER_OUTPUT' }`.
6. On success, return `{ ok: true, value: validatedResponse }`.

**Phase 5.2 parser responsibilities (syntax and structure only):**

- UTF-8 byte-size limit enforcement (step 2 above)
- JSON syntax validity (step 3)
- presence of the `outcome` discriminant field and correct discriminant value
- presence of all required fields for the selected branch
- correct field types (string, bounded length as defined in B9)
- strict unknown-field rejection

**What Phase 5.2 must not do:**

- validate whether returned IDs are members of the supplied candidate set — Phase 5.3
- validate dimension membership (project vs. category confusion) — Phase 5.3
- check `candidateSetHash` match — Phase 5.3 (using the trusted envelope value from Object A)
- validate stale candidate-set — Phase 5.3
- perform direction-compatibility checks — Phase 5.3

Phase 5.2 owns syntax and structural conformance; Phase 5.3 owns semantic and membership
correctness.

`RECOMMENDED — PENDING OWNER APPROVAL`

#### B7. Valid-ID behavior

The following responsibilities are reserved for Phase 5.3. None of them belong in Phase 5.2
and must not be implemented during Phase 5.2 work.

**Phase 5.3 responsibilities (semantic and membership validation):**

- Candidate ID membership: is the returned ID actually in the correct dimension array that was supplied?
- Dimension membership: is a project ID in `projects`, a transaction-type ID in `transactionTypes`, a category ID in `categories`?
- Complete-triple: are all three IDs present when `outcome` is `"PROPOSED"`?
- `candidateSetHash` match: does the trusted envelope hash (Object A) match the live candidate set? The hash comes from Object A — not from the raw response.
- Stale candidate-set rejection: has the restricted candidate set changed since the envelope was constructed?
- Direction compatibility: is the returned transaction-type ID direction-compatible with the transaction direction?
- Duplicate or mismatched ID detection across dimensions.
- Whole-result abstention on any invalid selection: if any ID fails any of the above checks, the entire result becomes an internal abstention with reason `INVALID_CANDIDATE_SELECTION`.

Phase 5.3 receives Object A (trusted envelope) and the validated raw response (Object C)
separately. It must never receive a merged object where internal hashes could be confused
with model-supplied values.

Phase 5.3 may not begin until Phase 5.2 is complete and locally validated.

`RECOMMENDED — PENDING OWNER APPROVAL`

#### B8. Abstention taxonomy

There are two fundamentally different kinds of abstention reasons. These must not be mixed.

**Provider-declared reasons (Object C — only these may appear in a valid raw `ABSTAINED` response):**

| Reason | Trigger |
|---|---|
| `INSUFFICIENT_CONTEXT` | Candidate set or available evidence is insufficient to attempt classification |
| `AMBIGUOUS_EVIDENCE` | Evidence is too evenly distributed to produce a reliable proposal |
| `CONFLICTING_EVIDENCE` | Evidence contains material conflicts that the model cannot resolve |
| `MISSING_VALID_CANDIDATES` | No valid active workspace-scoped candidates exist for one or more dimensions |

A provider-declared reason in the raw response confirms that the model actively abstained.
The Phase 5.2 schema must only accept these four values in the `abstentionReason` field of
a raw `ABSTAINED` response. Any other value in that field causes the response to be treated
as structurally malformed.

**Internal/system reasons (generated exclusively by trusted application code; never accepted from raw provider output):**

| Reason | Phase origin | Trigger |
|---|---|---|
| `PROVIDER_DISABLED` | Phase 5.1 | Adapter is in the disabled state |
| `PROVIDER_UNAVAILABLE` | Future provider adapter | Provider returned an error, timed out, or was unreachable |
| `MALFORMED_PROVIDER_OUTPUT` | Phase 5.2 parser | Parser returned `ok: false` |
| `INVALID_CANDIDATE_SELECTION` | Phase 5.3 semantic validator | Returned ID not in supplied candidate set, or wrong dimension |
| `STALE_CANDIDATE_SET` | Phase 5.3 semantic validator | Trusted envelope hash does not match live candidate set |

An internal reason is generated by application code, not by the model. If the raw
`ABSTAINED` response contains a string that matches an internal reason name (for example,
a model that returns `"abstentionReason": "PROVIDER_DISABLED"`), that response is malformed
because `PROVIDER_DISABLED` is not in the provider-declared reason set and is not a valid
value for `abstentionReason` in the raw schema.

**On the combined internal inference result:** the broader application inference result type
(the internal parsed result, Object D) may later use the union of all reason values to
represent any abstention that occurred at any phase. That is a separate internal type and
must not be confused with the raw provider response schema.

`RECOMMENDED — PENDING OWNER APPROVAL`

#### B9. Bounds and fixtures

**Repository-verified bounds (already established in code):**

| Bound | Value | Source |
|---|---|---|
| Default maximum candidates per dimension | 5 | `DEFAULT_RESTRICTED_CANDIDATE_BOUNDS` in `restrictedRetrievalCandidateService.ts` |
| Hard maximum candidates per dimension | 10 | `HARD_MAXIMUM_CANDIDATES_PER_DIMENSION` in `restrictedRetrievalCandidateService.ts` |
| Hard maximum total candidate descriptors (all dimensions combined) | 30 | derived from three dimensions × 10 hard max each |

**Bounds requiring owner approval (starting recommendations only — not approved):**

| Bound | Recommended starting value | Label |
|---|---|---|
| Maximum candidate display-label length (characters) | 128 | `RECOMMENDED — PENDING OWNER APPROVAL` |
| Serialized request byte limit | 16 384 UTF-8 bytes | `RECOMMENDED — PENDING OWNER APPROVAL` |
| Serialized response byte limit | 4 096 UTF-8 bytes | `RECOMMENDED — PENDING OWNER APPROVAL` |

Note on the thirty-descriptor bound: thirty is the total hard maximum number of candidate
descriptors across all three dimension arrays, not a limit on evidence counts.
`supportingEvidenceCount` and `conflictingEvidenceCount` are scalar integers on each
candidate descriptor, not collections of evidence items.

The counterparty text length limit and payment-purpose text length limit are excluded from
Phase 5.2 bounds. Those fields are deferred to Gate C. Their limits belong to the Gate C
privacy decision, not the Gate B payload design.

The serialized request and response limits should be verified against actual token budgets
and provider constraints once those are confirmed at Gate C.

**Fixtures requirements for Phase 5.2:**

Phase 5.2 tests must use only synthetic fixtures:

- synthetic organization names and workspace UUIDs (no real Yeshua Academy data)
- synthetic project, transaction-type, and category IDs and display labels
- synthetic transaction amounts and directions (`"credit"` or `"debit"`)
- no production payment-purpose descriptions
- no realistic IBANs or IBAN fragments
- no real counterparty names
- no real transaction IDs, booking IDs, or review-decision IDs
- no values recognized as secret-shaped by the repository security scanner

If Zod is used for schema parsing in Phase 5.2:

- Zod is already installed at version `^4.1.11`; no `package.json` or lockfile change is required
- Zod use is limited to strict local schema parsing of raw provider response DTOs
- Zod adoption in Phase 5.2 is still pending Gate B approval
- No `z.any()`, `z.unknown()`, or `.passthrough()` on the response object; strict mode required (`.strict()`)

`RECOMMENDED — PENDING OWNER APPROVAL`

---

## E. Gate C — provider, region, model, and operational decisions (Phase 5.4)

These decisions must be made before any real provider invocation. No AWS account, region,
model entitlement, secret, or SDK is assumed to exist currently.

### Identity mechanism — conditional on deployment host

The deployment platform runs the application in a Docker container. The repository does not
establish that the host is an AWS compute environment with an instance profile attached. The
identity mechanism must be decided conditionally:

- Use an attached workload role only when the runtime host is confirmed to support instance
  profiles or workload identity and this has been verified against the live account.
- Otherwise require a separately approved server-only credential approach (short-lived
  credentials or a securely managed secret).
- Long-lived access keys are disfavored but may be used as a temporary path if the host does
  not support workload identity.
- No credential of any kind may enter client bundles, environment variables readable from
  the browser, or application logs.

### Model identifier

The exact pinned model identifier must be selected by the owner from the live Bedrock model
catalog in the approved region. The identifier must be version-dated (never a floating alias)
and verified against the live account's entitlements before it is recorded here.

`OWNER_TO_SELECT_FROM_LIVE_BEDROCK_MODEL_CATALOG`

Do not hardcode a model identifier as factual until the owner has verified it against the
live Bedrock account and selected region.

### Region

The Bedrock region must be selected based on actual availability in the owner's live AWS
account. Model availability by region is not asserted here; it must be confirmed against the
live account. If data-residency requirements apply, the region must comply with those before
any other consideration.

### Operational decisions required before Phase 5.4

| Decision | Status |
|---|---|
| AWS account confirmed and deployment-host identity mechanism verified | **PENDING** |
| Bedrock region verified against live account (confirmed to support selected model) | **PENDING** |
| Exact pinned model identifier selected from live Bedrock model catalog | **PENDING** |
| Model access or entitlement confirmed in the live account and region | **PENDING** |
| Server-only credential mechanism approved (see identity section above) | **PENDING** |
| Privacy and provider-data-handling agreement reviewed and approved | **PENDING** |
| Payload minimization approved (see Section F) | **PENDING** |
| Timeout: _______  Retries: _______  Concurrency: _______ | **PENDING** |
| Daily cost cap: _______  Monthly cost cap: _______ | **PENDING** |
| Token and cost accounting approach approved | **PENDING** |
| Default-off runtime flag confirmed (must be disabled by default) | **PENDING** |
| Kill-switch mechanism approved (owner-controlled, no code change needed) | **PENDING** |
| Shadow-output storage approach approved (see Section G) | **PENDING** |
| Labeled-cohort strategy confirmed (see Section C; strategy must be approved before Phase 5.4) | **PENDING** |
| No-booking and rollback validation plan approved | **PENDING** |

Recommended starting options (all labeled as illustrative):

| Parameter | Starting option | Label |
|---|---|---|
| Timeout | 5 000 ms | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Retries | 2 | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Concurrency | 5 for batch evaluation | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Maximum latency p95 | 5 000 ms | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Maximum provider failure rate | 5% of invocations | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Maximum cost per 221-row run | To be set after model ID and token counts are confirmed | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |

**Owner decision required** for every field above. These are starting points only and must
not be treated as committed values. Cost estimates in particular depend on the confirmed
model ID, actual token volumes, and current pricing — none of which can be established without
live account access.

---

## F. Privacy and payload minimization (Gate C)

These decisions must be approved before Phase 5.4. Phase 5.1–5.3 must not send any real
transaction data to a provider.

### Current minimum payload and deferred expansion

The Gate B contract already defines the smallest provider-neutral request shape. Gate C must
decide whether that shape may be transmitted and whether any additional fields may be added.
The recommended first-shadow payload is limited to:

- transaction direction (`credit` or `debit`);
- optional transaction amount in minor units as a base-10 string together with currency as an
  all-or-nothing pair;
- restricted project, transaction-type, and category candidate descriptors with display labels;
- optional scalar supporting and conflicting evidence counts per candidate.

Counterparty text, payment purpose, merchant display labels, supporting examples, and
conflicting examples are not part of the recommended first-shadow payload. They remain
separate Gate C expansion decisions in Section G.1. No real transmission is authorized by
this document.

### Explicit prohibitions (non-negotiable)

The following must never be sent to the model:

- credentials, session tokens, database URLs, or API keys;
- internal database UUIDs other than the supplied restricted candidate IDs;
- unrelated workspace data, including other workspaces' transactions, merchants, or rules;
- retained source file bytes (original ING CSV or PDF content);
- hidden chain-of-thought, system-generated rationale used as training input;
- unrestricted merchant history or full transaction history beyond the bounded examples;
- free-form database query results or schema information;
- cross-workspace evidence of any kind.

### Decisions required before Phase 5.4

| Field | Decision required |
|---|---|
| Raw transaction descriptions | May the original `description` field be sent? |
| Counterparty text | May the counterparty field (after approved normalization) be sent? |
| IBANs | Must IBANs be masked, fully omitted, or may they be sent in full? |
| Amount and direction | May the exact minor-unit amount and direction be sent? |
| Maximum supporting examples | How many per request? `ILLUSTRATIVE — NOT APPROVED`: ≤ 5 |
| Maximum conflicting examples | How many per request? `ILLUSTRATIVE — NOT APPROVED`: ≤ 3 |
| Retention policy | How long may provider request/response logs be retained? |
| Log-redaction policy | What fields must be redacted before any log is written? |
| Provider data-handling | Data-handling agreement with AWS reviewed and approved? |

**Owner decision required** for every field above. This document does not make a final privacy
approval. It prepares the decision boundary.

---

## G. Shadow-output storage decision (Gate C)

Phase 5 shadow output must be stored or reported somewhere. Three options are compared.
This decision is required before Phase 5.4. Phase 5.1–5.3 produce no shadow output.

### Option G1 — Report-only ephemeral shadow output

**Description:** shadow inference runs as part of the benchmark evaluation. Results are
returned in the benchmark report (a JSON document with hashes) but are never persisted to
the database.

**Schema impact:** none. No new table, column, or migration.

**Trusted-history contamination risk:** lowest.

**Operational complexity:** lowest.

---

### Option G2 — Persisted derived shadow Decisions

**Description:** shadow inference results are stored as a new `ShadowDecision` record type.
Each row includes the transaction ID, model version, prompt version, candidate set, proposed
dimensions, confidence placeholders, abstention state, latency, cost tokens, generation
timestamp, and staleness marker.

**Schema impact:** requires a new Prisma model, a migration, and a new service. Must be
carefully designed to prevent any path from the shadow table back to trusted-history retrieval.

**Trusted-history contamination risk:** higher. Requires explicit query-time filtering guards.

**Operational complexity:** higher.

---

### Option G3 — Dedicated shadow-decision model (defer to Phase 6)

**Description:** Phase 5 uses ephemeral shadow output (G1). Phase 6 adds persistence after
the first evaluation results clarify actual requirements.

**Schema impact:** none in Phase 5. Phase 6 adds the schema once it is known.

**Trusted-history contamination risk:** same as G1 during Phase 5.

**Recommendation:** G1 for Phase 5, then revisit as G3 for Phase 6.

---

**Owner decision required:** choose G1, G2, or G3, or specify a variant. This decision is a
prerequisite for Gate C (Phase 5.4), not for Gate A (Phase 5.1).

---

## G.1 Authoritative Gate C owner-decision package (C1–C14)

This section is the authoritative decision record for Gate C. Sections E–G provide context;
C1–C14 below define the exact owner choices. Every recommendation remains:

`RECOMMENDED — PENDING OWNER APPROVAL`

No recommendation is permission to access AWS, create credentials, transmit data, invoke a
model, change configuration, create labels, or begin Phase 5.4.

### Verified repository and deployment facts

- Production runs in a Docker image. The runtime command is `node scripts/start-prod.mjs`.
- The runtime starts Prisma migration deployment, the API, and Next.js in one container.
- Runtime configuration is supplied through server process environment values.
- The repository does not prove that the Dokploy host runs on AWS compute or supports an
  instance profile, ECS task role, EKS identity, or another workload-identity mechanism.
- The repository contains no Bedrock SDK, provider configuration, provider credentials,
  provider environment variables, model identifier, region, or real-inference integration.
- Phase 5.1–5.3 remain isolated, local, uncommitted, and unused by runtime modules.
- `docker-compose.yml` is a historical local stack and is not evidence of the current Dokploy
  host identity or secret-delivery mechanism.

### C1 — Deployment identity

Options:

1. **Attached workload identity.** Use only if the live Dokploy host is verified to run on an
   AWS service or host configuration that supplies a scoped workload identity to this exact
   container.
2. **Short-lived credentials through an approved server-side secret manager.** Use when the
   host cannot expose workload identity but can obtain renewable, revocable credentials
   without source-controlled secrets.
3. **Securely managed static credentials.** Last resort only. Requires least privilege,
   explicit rotation, independent revocation, runtime-only delivery, and a removal date.

`RECOMMENDED — PENDING OWNER APPROVAL`: first verify the live host and account. Prefer option
1 when supported; otherwise choose option 2. Option 3 is acceptable only as a documented,
time-bounded exception. Do not infer workload-identity support from Docker or Dokploy alone.

### C2 — Bedrock region

Required value:

`OWNER_TO_SELECT_AFTER_LIVE_ACCOUNT_VERIFICATION`

Selection requires live verification of model availability, account entitlement, data
residency, network reachability from the deployment host, latency, quota, commercial support,
and operational ownership.

`RECOMMENDED — PENDING OWNER APPROVAL`: do not record a region until the selected model and
account entitlement are confirmed in that same region.

### C3 — Exact model identifier

Required value:

`OWNER_TO_SELECT_FROM_LIVE_BEDROCK_MODEL_CATALOG`

The identifier must be pinned and versioned, not a floating alias. Approval must record the
selected region, entitlement evidence, planned retirement/replacement procedure, and the
owner who may authorize a model change.

`RECOMMENDED — PENDING OWNER APPROVAL`: select the smallest approved Haiku-class model that
satisfies the Phase 5 contract only after live catalog verification. No model ID is asserted
by this repository analysis.

### C4a — Model-access metadata evidence (gathered before Phase 5.4A implementation)

Metadata evidence gathered before Phase 5.4A implementation through Section G.2 only:

- catalog availability
- documented access or entitlement state
- quota metadata
- pricing
- provider terms

C4a does not prove successful invocation. Gathering C4a does not invoke a model.

Before gathering C4a, verify all of the following without recording secrets:

- the intended AWS account and billing owner;
- model entitlement in the selected region;
- applicable quota and throttling limits;
- approved commercial terms and current pricing source;
- provider data-handling, retention, and training-use terms;
- an owner-approved evidence record containing identifiers and results but no credentials.

`RECOMMENDED — PENDING OWNER APPROVAL`: C4a remains pending until metadata is gathered
through Gate C-M (Section G.2). This document does not authorize any verification action.

### C4b — Operational invocation evidence (gathered after Phase 5.4A implementation through Gate C-S)

Operational invocation evidence gathered after Phase 5.4A implementation through Section G.3
(Gate C-S). C4b proves only:

- the configured identity can invoke the pinned model;
- region/model configuration is operational;
- the bounded response reaches the Phase 5.2 parser;
- logging and cost metadata work safely;
- no finance or review mutation occurs.

C4b does not prove classification accuracy or readiness for reviewer exposure. C4b blocks
Phase 5.4B. C4b does not block Phase 5.4A.

`RECOMMENDED — PENDING OWNER APPROVAL`: C4b requires separately authorized Gate C-S after
Phase 5.4A is implemented and validated. This document does not authorize the invocation.

### C5 — Server-only credential boundary

Required properties:

- credentials are never exposed to client code, public environment variables, source control,
  documentation, logs, error payloads, build arguments, or browser bundles;
- permissions are least-privilege and restricted to the approved model, region, and required
  invocation actions;
- credentials can be revoked independently of application code;
- rotation is documented and testable;
- missing, expired, or malformed credentials fail closed to deterministic-only behavior;
- the kill switch can disable inference without exposing or changing credential values;
- no credential value is copied into benchmark reports or observability metadata.

`RECOMMENDED — PENDING OWNER APPROVAL`: workload identity or renewable short-lived credentials
are preferred. Static credentials require a separate exception record and rotation deadline.
No environment-variable name or credential value is approved by this decision package.

### C6 — Privacy and provider data handling

Initial field decisions:

| Field or policy | Recommended initial decision | Rationale |
|---|---|---|
| Transaction direction | Transmit | Required classification signal already approved by Gate B. |
| Amount and currency | Transmit only as the approved all-or-nothing pair | Useful signal; no floating-point representation. |
| Project/type/category candidate IDs and display labels | Transmit | Required constrained-choice vocabulary; no workspace or transaction identity. |
| Aggregate support/conflict counts | Permit | Scalar, bounded evidence signal without raw examples. |
| Counterparty text | Omit | Additional personal/commercial data is not required for the first shadow experiment. |
| Payment purpose | Omit | Potentially sensitive free text; not required initially. |
| Merchant display label | Omit | Separate merchant privacy and normalization approval is absent. |
| Supporting confirmed-history examples | Omit | Avoid historical transaction disclosure in the first experiment. |
| Conflicting confirmed-history examples | Omit | Avoid historical transaction disclosure in the first experiment. |
| Provider training/data use | Require contractually disabled use for model training where the service terms permit | Finance data must not become provider training material. |
| Provider retention | Require the shortest available retention or no-retention mode, verified against live terms | Minimize external data persistence. |
| Application request/response logging | Metadata only; no bodies | Prevent transaction or candidate-label leakage. |
| Regional handling | Constrained to the approved region and documented provider behavior | Required for residency and incident analysis. |
| Incident response | Disable inference, preserve deterministic review, revoke identity, record affected invocation metadata | Fail closed without changing finance truth. |

`RECOMMENDED — PENDING OWNER APPROVAL`: use the existing Phase 5.2 minimum payload only.
Counterparty, payment purpose, merchant labels, and history examples remain excluded until a
separate payload-expansion approval.

### C7 — Payload-expansion matrix

| Optional field | Expected classification value | Privacy risk | Required control | Proposed bound | Needed for first shadow run? | Recommended initial decision |
|---|---|---|---|---:|---|---|
| Counterparty | Merchant/vendor signal | Medium to high | Canonicalization, redaction, and explicit provider approval | 128 characters | No | Omit |
| Payment purpose | Free-text intent signal | High | Redaction, truncation, and sensitive-pattern review | 256 characters | No | Omit |
| Merchant display label | Canonical merchant signal | Medium | Approved merchant-resolution source and workspace isolation | 128 characters | No | Omit |
| Supporting examples | Pattern and precedent signal | High | Confirmed-only eligibility, field minimization, per-example redaction | Maximum 3 | No | Omit |
| Conflicting examples | Ambiguity signal | High | Confirmed-only eligibility, field minimization, per-example redaction | Maximum 2 | No | Omit |

All bounds are `RECOMMENDED — PENDING OWNER APPROVAL`. They do not alter the Phase 5.2
contract. Any later inclusion requires a new local payload-builder boundary, privacy tests,
and explicit owner approval before real transmission.

### C8 — Timeout, retry, concurrency, and rate limits

Provisional shadow-mode defaults:

| Control | Recommended starting value | Behavior |
|---|---:|---|
| Per-attempt timeout | 10,000 ms | Timeout produces internal `PROVIDER_UNAVAILABLE`. |
| Maximum retries | 1 | One retry only for throttling, transient network failure, or provider 5xx. |
| Non-retryable failures | 0 retries | Authentication, authorization, invalid request, malformed response, and contract failure fail closed. |
| Backoff | 500 ms base, exponential, jittered, capped at 2,000 ms | Prevent synchronized retries. |
| Concurrency | 2 | Conservative first shadow execution. |
| Per-minute limit | 20 requests | Prevent accidental burst spend. |
| Circuit breaker | Open after 5 consecutive provider failures in 60 seconds; 5-minute cooldown | Degrade to deterministic-only behavior. |
| Duplicate prevention | One invocation per trusted transaction/candidate/fact identity within a run | Prevent duplicate shadow requests and duplicate report rows. |
| Maximum wall-clock duration per item | 25 seconds | Includes the single retry and backoff. |

`RECOMMENDED — PENDING OWNER APPROVAL`: these are conservative engineering defaults, not
measured production values. Phase 6 must evaluate actual latency and failure behavior.

### C9 — Budget and token limits

The exact monetary limits cannot be calculated until C2–C4 identify a live region, model,
pricing source, and measured request size. Gate C must nevertheless require explicit hard
limits before any real call.

| Control | Recommended Gate C decision |
|---|---|
| Daily spend cap | `OWNER_TO_SET_AFTER_MODEL_AND_PRICING_VERIFICATION` |
| Monthly spend cap | `OWNER_TO_SET_AFTER_MODEL_AND_PRICING_VERIFICATION` |
| Per-run spend cap | `OWNER_TO_SET_AFTER_MODEL_AND_PRICING_VERIFICATION` |
| First smoke-run request cap | 10 requests |
| Expanded benchmark request cap | No more than the explicitly approved labeled or shadow cohort; never silently default to all 221 |
| Maximum input tokens | 4,096 per request, pending token measurement |
| Maximum output tokens | 256 per request, pending response measurement |
| Cap reached | Stop new calls immediately; return internal budget/provider-unavailable abstention; preserve deterministic output |

`RECOMMENDED — PENDING OWNER APPROVAL`: no invocation is permitted until numeric monetary caps
are entered and enforced. The values above are request/token safety bounds, not a cost estimate.

### C10 — Accounting and observability metadata

Future shadow reporting should capture only operational metadata needed for audit and cost:

- request count and unique invocation count;
- input and output token counts;
- latency and timeout status;
- provider status category and retry count;
- internal abstention reason;
- pinned model identifier and selected region;
- contract, prompt, retrieval, candidate, and Decision Engine versions;
- candidate-set identity and transaction-fact identity as trusted server-side hashes;
- run identity, run start/end time, and aggregate budget consumption.

The following remain server-internal and must not be sent to the provider or written to
unredacted logs: workspace ID, transaction ID, transaction-fact hash, candidate-set hash,
credential details, request bodies, response bodies, and raw finance facts.

`RECOMMENDED — PENDING OWNER APPROVAL`: Phase 5.4 uses ephemeral in-memory/report metadata only.
No persistent storage design is approved here.

### C11 — Default-off control

Required behavior:

- real inference is disabled when configuration is absent, partial, invalid, or unapproved;
- every environment starts disabled until explicitly enabled by an authorized operator;
- deployment never enables inference automatically;
- review reads and normal application startup never trigger provider calls by default;
- deterministic-only behavior remains available under every failure mode;
- the disabled state is visible through privacy-safe operational status, not through secrets.

`RECOMMENDED — PENDING OWNER APPROVAL`: introduce a future server-only boolean control with a
default value of false, conceptually named `AI_SHADOW_INFERENCE_ENABLED`. The name and delivery
mechanism are not implemented or added to `.env.example` by this package.

### C12 — Kill switch

Options:

1. **Dokploy-managed runtime control.** Change a server-only runtime value and restart the
   container. Requires no image rebuild but does require an operator-controlled restart.
2. **Authorized dynamic control.** Read from an approved remote configuration source or
   administrator-only operational store. Avoids restart but adds infrastructure, authorization,
   audit, cache, and availability complexity.
3. **Code removal or deployment rollback.** Last-resort recovery, slower and coupled to release
   operations.

`RECOMMENDED — PENDING OWNER APPROVAL`: use option 1 for the first shadow experiment because the
repository proves no dynamic configuration infrastructure. Require an authorized operator,
audit evidence, fail-closed startup, deterministic fallback, and a tested restart procedure.
Option 2 may be designed later if no-restart operation becomes necessary.

### C13 — Shadow-output handling

| Option | Replay and audit | Schema impact | Staleness/deduplication | Cleanup and rollback | Contamination risk | Complexity |
|---|---|---|---|---|---|---|
| G1 — Ephemeral report-only | Reproducible hashed JSON/report artifact for an approved run | None | Invocation identity deduplicates rows within the report; reruns create a new versioned report | Delete report and disable provider contribution | Lowest | Lowest |
| G2 — Persisted derived shadow Decisions | Strong queryable history | New Prisma model and migration | Requires unique identities, stale markers, cleanup jobs, and retention policy | Disable writes, migrate or delete derived rows | Higher; must be excluded from trusted history | High |
| G3 — Ephemeral in Phase 5, persistence reconsidered in Phase 6 | Same as G1 initially; later design uses measured requirements | None in Phase 5 | Same as G1 initially | Same as G1 initially | Lowest in Phase 5 | Low now, deferred later |

`RECOMMENDED — PENDING OWNER APPROVAL`: select G1 for Phase 5.4. Revisit persistence only after
Phase 6 demonstrates a concrete replay or comparison requirement. No schema or migration is
authorized.

### C14 — No-booking and rollback acceptance plan

Before Phase 5.4 completion, tests and evidence must prove:

- no `TransactionBooking` creation;
- no `ReviewDecision` creation;
- no suggestion creation, update, expiration, or ownership change;
- no transaction or immutable bank-fact mutation;
- no period-state, ledger, reconciliation, or report-truth mutation;
- no trusted-history eligibility change;
- no workspace-isolation bypass;
- no locked-period bypass;
- no provider call from ordinary review reads or startup when disabled;
- provider failure, malformed output, stale input, invalid IDs, budget exhaustion, timeout,
  circuit-open state, and kill-switch state all degrade to deterministic-only output or
  abstention;
- rollback removes or disables model contribution while manual and deterministic review remain
  available;
- ephemeral reports are removable without altering accounting state.

`RECOMMENDED — PENDING OWNER APPROVAL`: Phase 5.4 cannot be marked complete unless every item
has focused tests, affected regression evidence, a clean security scan, and a documented
operator rollback rehearsal.

### Gate C labeling-strategy decision

| Option | Cohort composition | Stratification | Main bias/leakage risk | Owner effort | Evaluation use |
|---|---|---|---|---|---|
| 1 — Small pilot | 20–30 reviewed transactions | Both directions, at least three projects, amount ranges, easy and ambiguous cases | High selection bias and wide uncertainty | Low | Infrastructure smoke test and preliminary directional check only |
| 2 — Stratified cohort | 60–100 reviewed transactions | Proportional project coverage, both directions, amount quartiles, evidence/conflict status, risk-first plus random selection within strata | Moderate selection bias; still one organization and one partial-year cohort | Moderate | Meaningful preliminary shadow evaluation; not automatically a full Phase 6 acceptance set |
| 3 — Full current cohort | All 221 reviewed transactions | Entire current open-statement cohort | No within-cohort selection bias, but temporal, organizational, merchant, and future-distribution bias remain | High | Strongest evaluation of this specific cohort; still not proof of future generalization |
| 4 — Remain blocked | No new labels | None | No measurement possible | None | Phase 5.4 or Phase 6 evaluation remains blocked as specified by owner policy |

Option 2 is **APPROVED**. The exact cohort size within the 60–100 range is:
`OWNER_TO_SELECT_EXACT_COHORT_SIZE_FROM_60_TO_100`

**Labeling dependencies — corrected:**

- The exact cohort size is **not** needed for Gate C-M metadata resolution.
- The exact cohort size is **not** needed to implement Phase 5.4A.
- The exact cohort size is **not** needed for one Gate C-S synthetic invocation.
- The exact cohort size **is** required before cohort selection, label creation, and Phase 5.4B.
- Selecting the exact size does not authorize creating labels.

Selection should be reproducible, risk-aware, and randomized within strata to reduce
easy-case selection bias. Labels must be created only through the existing individual
administrator review path under a separately approved execution task. This package creates
no labels.

```
Exact Option 2 cohort size: [choose one integer from 60 through 100]
```

## G.2 Metadata-only live verification plan — no invocation authorized

This plan describes metadata-only steps to resolve C2 (region), C3 (model ID), C4a (catalog
availability and documented access metadata), and the pricing inputs needed for C9 (monetary
cap arithmetic). It does not include model invocation. Invocation proof (C4b) is separately
defined in Section G.3.

No step in this plan is authorized by the policy approvals above. Each step requires a
separate explicit owner instruction before execution.

### Still-unresolved live values

| Gate C item | What is missing | How to resolve |
|---|---|---|
| **C2** — Region | No region selected | Metadata step: list Bedrock regions with Haiku-class model availability; confirm data residency and reachability |
| **C3** — Model ID | No model identifier | Metadata step: read the live Bedrock model catalog; select a pinned, versioned identifier |
| **C4a** — Metadata evidence | No catalog, entitlement, quota, pricing, or terms records | Metadata step: collect from console/CLI without invoking a model |
| **C4b** — Invocation proof | Invocation capability not yet proven | Separate Section G.3 authorization — not part of this plan |
| **C9** — Monetary caps | No daily/monthly/per-run dollar amounts | Arithmetic from confirmed pricing — no invocation |
| **Exact cohort size** | No integer selected from 60–100 | Owner decision only; see `OWNER_TO_SELECT_EXACT_COHORT_SIZE_FROM_60_TO_100` |

### Absolute prohibitions for metadata-only verification

The authorized metadata session must not:

- invoke any model (real or synthetic prompt);
- create, rotate, read, or record any credential, secret, access key, token, or private key;
- create, enable, or modify any AWS resource, role, policy, quota, or configuration;
- read environment variable values, secret values, mounted secret-file contents, or
  application data;
- read database URLs or connection strings;
- change any Bedrock access setting or request any model enablement;
- install packages, add environment variables, or modify any configuration file;
- deploy, commit, or push.

### Host-inspection boundary

The authorized session may inspect only:

- host and runtime platform type (Docker, ECS, EC2, VPS, bare metal — not credentials);
- identity-provider type or role-attachment type (ECS task role, instance profile,
  Kubernetes service account — not the role ARN value unless it is non-sensitive metadata);
- environment-variable **names** only — never values;
- secret-reference names or provider types — never values;
- volume-mount **paths and source types** — never mounted file contents;
- network and runtime metadata that contains no credentials;
- documented container identity behavior from the deployment-platform documentation.

If identity metadata cannot be obtained without reading credentials or secret values,
stop at that point and report the limitation. Do not proceed past the boundary.

### AWS metadata boundary

The authorized session may use only an already-authenticated, owner-approved session.

It may record only privacy-safe evidence:

- account identifier (or an approved redacted form);
- caller principal type (or an approved redacted form);
- candidate regions;
- catalog model identifiers and lifecycle status;
- documented quota (from console metadata — no test invocation needed);
- pricing source URL and retrieval date;
- official provider terms source and review date.

It must not:

- request pasted or displayed credentials;
- create or rotate credentials;
- alter IAM or Bedrock access;
- assume a new role;
- enable a model or request entitlement changes;
- change quotas;
- invoke a model.

### Metadata step 1 — Deployment-host identity

**Purpose:** determine which credential delivery mechanism is factually available (C1 evidence).

**Actions:**

1. Inspect the deployment-platform application view for this container: note the platform
   type, any identity-provider or role-attachment indicator, and the secret-delivery
   mechanism type.
2. Note environment-variable **names** and secret-reference **names** — not values.
3. Note volume-mount paths and source types — not mounted file contents.
4. Determine whether the host platform supports attached workload identity without
   reading a credential file.
5. If the determination requires reading a secret or credential value, stop and report.
6. Record: platform type, identity mechanism type, and the credential-delivery path that
   is actually available.

**Output:** platform type and identity mechanism type — not credentials, not secret values.

### Metadata step 2 — AWS account identity and Bedrock region candidates

**Purpose:** confirm the billing account and list candidate regions (toward resolving C2).

**Actions:**

1. In the owner-approved AWS session, confirm the account identifier and caller principal
   type. Record only the account ID and principal type — not session tokens or policy content.
2. For each candidate region that satisfies data-residency requirements, list available
   Bedrock foundation models offered by Anthropic:
   `aws bedrock list-foundation-models --region <candidate> --by-provider anthropic`
3. Note which Haiku-class versioned model identifiers are available in each candidate region.
4. Assess each candidate region for: data-residency compliance, network reachability from
   the deployment host (based on documented network topology, not a live test call), and
   operational support availability.
5. Record the candidate region or regions that satisfy all constraints; note which, if any,
   is the single preferred region.

**Output:** account identifier (or approved redacted form), caller principal type, and a
table of candidate regions with Haiku-class model identifiers and lifecycle status.

**No model invocation or credential creation.** Catalog listing is metadata-only.

### Metadata step 3 — Model identifier, access metadata, quota, pricing, and terms

**Purpose:** resolve C3 (model ID) and provide C4a (metadata evidence).

**Actions:**

1. Select the smallest Haiku-class versioned, pinned model identifier available in the
   confirmed region. Record the exact identifier string.
2. Retrieve documented entitlement state for this model ID in this account without invoking
   it. If the console shows access-request status or grants/denials, record that metadata.
3. Note documented quota from the console quota page (tokens-per-minute,
   requests-per-minute) — no test invocation.
4. Retrieve current pricing from the official AWS Bedrock pricing page. Record: pricing
   source URL, retrieval date, input price per 1,000 tokens, and output price per
   1,000 tokens.
5. Review the AWS Bedrock data-handling, retention, and training-use terms from the
   official service documentation. Record: terms source URL, review date, and whether
   no-training or training-opt-out mode is documented as available for this account type.

**Output:**

- Pinned model identifier
- Region confirmed
- Documented entitlement state (from account metadata, not an invocation)
- Quota (from console — not a test invocation)
- Pricing source URL, retrieval date, input and output rates
- Provider terms source URL, review date, training-opt-out status

**Catalog listing and access metadata confirm availability, not invocation capability.**
Invocation capability requires the separately authorized Section G.3 smoke test.

### Metadata step 4 — Monetary-cap arithmetic

**Purpose:** produce the numeric values for C9 owner approval (arithmetic only — no invocation).

**Prerequisites:** step 3 pricing confirmed.

**Inputs required (from step 3 and approved policy):**

- confirmed input price per 1,000 tokens (from official pricing source)
- confirmed output price per 1,000 tokens (from official pricing source)
- approved maximum input tokens: 4,096 per request
- approved maximum output tokens: 256 per request
- approved retry policy: maximum 1 retry (at most 2 attempts per item)
- approved first smoke-run request cap: 10 requests

**Calculations to present to the owner:**

| Scenario | Request count | Maximum cost formula | Owner-entered cap |
|---|---|---|---|
| Single synthetic smoke invocation | 1 | 1 × [(4,096 / 1,000) × input_rate + (256 / 1,000) × output_rate] | N/A (reference) |
| First smoke run | 10 | 10 × [(4,096 / 1,000) × input_rate + (256 / 1,000) × output_rate] × max_attempts | Per-run cap |
| Option 2 cohort run (exact N pending) | N (owner to confirm) | N × per-request max × max_attempts | Per-run cap |
| Full 221-row reference (comparison only) | 221 | 221 × per-request max × max_attempts | Not a cap — reference |

The full 221-row scenario is presented for reference comparison only. It must not be used
to set default caps. The owner must enter explicit numeric daily, monthly, and per-run
dollar values. No cap is set by arithmetic alone.

**Output:** a table of per-scenario cost estimates with formula inputs stated. Three blank
cells for the owner to fill: daily cap, monthly cap, per-run cap.

**No model invocation or spend occurs in this step.**

### Metadata step 5 — Evidence record

**Purpose:** compile all metadata-only findings; present to owner before Gate C resolution.

**Actions:**

1. Compile an evidence record containing outputs of steps 1–4.
2. Present to owner for review.
3. Owner enters the three monetary cap values.
4. Owner selects the exact Option 2 cohort size.
5. After owner confirmation of all values, update this document to replace placeholders.
6. Gate C metadata-only phase is then complete.
7. The separately authorized Section G.3 synthetic smoke test must still succeed (C4b)
   before Phase 5.4 implementation is authorized.

**After step 5:** C2, C3, C4a, and C9 monetary caps are resolved. Gate C-M is then complete
and Phase 5.4A planning and implementation may begin after separate owner authorization.
The exact Option 2 cohort size remains a separate owner decision; it is not required for
Gate C-M, Phase 5.4A, or one G.3 synthetic invocation. C4b remains unresolved until
Gate C-S (Section G.3) is separately authorized and completed after Phase 5.4A.

### What this plan does not do

- Does not invoke any model.
- Does not create, rotate, read, or record any credential, secret, access key, or token.
- Does not add environment variables or modify any configuration file.
- Does not install an AWS SDK or any new dependency.
- Does not create benchmark labels.
- Does not implement Phase 5.4.
- Does not deploy, commit, or push.

---

## G.3 Synthetic invocation verification (Gate C-S) — post-Phase-5.4A validation gate

This section defines the bounded synthetic smoke test that proves invocation capability
(C4b). It is not part of metadata-only verification (G.2). It is a post-implementation
validation gate, not a prerequisite to implementing Phase 5.4A.

**Corrected role:**

- G.3 is not a prerequisite to implementing Phase 5.4A.
- G.3 is a post-implementation validation gate.
- G.3 proves the implemented provider boundary can invoke the pinned model safely.
- G.3 occurs after Phase 5.4A is implemented and validated locally.
- G.3 occurs before any real-data shadow run.
- Successful G.3 evidence resolves C4b.
- Failure leaves deterministic-only behavior active and blocks Phase 5.4B.

It requires a separate explicit owner authorization and may only occur after all of the
following are confirmed and recorded:

### Prerequisites for Gate C-S — all required before any invocation

The following controls cannot be proven before Phase 5.4A is implemented. They become
post-Phase-5.4A requirements, not pre-Phase-5.4A requirements:

- Phase 5.4A implemented and validated locally
- Exact code and configuration diff reviewed
- Default-off state functional and tested: `AI_SHADOW_INFERENCE_ENABLED` is false in all environments (C11)
- Kill switch functional and tested (C12)
- Credential delivery operational without recording values (C1 resolved)
- Logging/redaction behavior implemented and tested (C10 verified)
- Provider request path implemented (Phase 5.4A)
- Response parsing and semantic validation connected (Phase 5.2–5.3 integration)
- Budget enforcement implemented

In addition:

- Exact AWS account confirmed
- Exact region confirmed (C2 resolved)
- Exact pinned model identifier confirmed (C3 resolved)
- Documented entitlement or access grant confirmed (C4a resolved)
- Exact credential mechanism approved and in place (C1 resolved)
- Numeric daily monetary cap entered and enforced (C9 resolved)
- Numeric monthly monetary cap entered and enforced (C9 resolved)
- Numeric per-run monetary cap entered and enforced (C9 resolved)
- Exact input-token limit confirmed (approved: 4,096)
- Exact output-token limit confirmed (approved: 256)
- Provider retention and training-use decision confirmed (C6 verified)
- Synthetic prompt content documented and approved in advance
- Explicit single-invocation cap of exactly one request (unless separately approved otherwise)

### Synthetic smoke-test constraints

The synthetic test must:

- use no real finance, organization, transaction, merchant, project, workspace, or user data;
- use a fixed synthetic payload documented in advance and approved before execution;
- make at most one invocation unless a higher count is separately and explicitly approved;
- stay within the confirmed input-token and output-token limits;
- have an explicit pre-calculated maximum cost;
- produce no database write;
- create no persistent Decision record, shadow record, or report entry;
- create no booking, suggestion, or review decision;
- not enable or trigger application runtime integration;
- stop immediately on any unexpected response, permission error, configuration ambiguity,
  quota error, or logging concern.

### What catalog metadata does not prove

Listing a model in the Bedrock catalog confirms catalog availability. It does not confirm:

- that the account has permission to invoke the model;
- that the IAM policy or resource-based policy allows the `bedrock:InvokeModel` action;
- that the credential mechanism delivers valid credentials at runtime;
- that quotas are not pre-exhausted or throttled;
- that the response structure matches the Phase 5.2 raw-response contract.

Gate C is not fully resolved until C4b (invocation proof from Section G.3) succeeds.

### Output of synthetic smoke test

A privacy-safe evidence record containing:

- invocation timestamp and region
- model identifier used
- response structure match result (yes/no, no content echoed)
- no request or response body in the record (metadata only)
- latency observed
- tokens consumed
- cost charged (if available from the response metadata)
- any error or warning observed

After this evidence is confirmed by the owner, C4b is resolved and Gate C is fully approved.

---

## H. Tiered gate conditions

### Gate A — Phase 5.1 disabled provider boundary

Gate A is an architectural safety gate, not a model evaluation. Phase 5.1 makes no external
calls, produces no model output, and has no measurable performance properties. Therefore
none of the accuracy, latency, cost, coverage, abstention, or calibration thresholds in
Gate D apply to this gate.

Gate A may be approved without:

- a labeled benchmark cohort;
- a final Bedrock region;
- a final model identifier;
- AWS credentials;
- the AWS SDK;
- privacy approval for real payload transmission;
- token-volume estimates;
- accuracy results;
- provider latency or failure measurements;
- shadow-output persistence design.

Gate A requires explicit approval of:

| Condition | Status |
|---|---|
| A1. Server-only placement: no browser export, no client bundle | **APPROVED** |
| A2. Disabled-by-default behavior: implementation always returns `PROVIDER_DISABLED` | **APPROVED** |
| A3. No external calls of any kind | **APPROVED** |
| A4. No provider SDK (no AWS SDK package installed) | **APPROVED** |
| A5. No credentials or environment variable values for provider | **APPROVED** |
| A6. No route or review-read invocation | **APPROVED** |
| A7. No Decision persistence | **APPROVED** |
| A8. No suggestion mutation | **APPROVED** |
| A9. No `ReviewDecision` creation | **APPROVED** |
| A10. No booking | **APPROVED** |
| A11. No trusted-history mutation | **APPROVED** |
| A12. No schema or migration change | **APPROVED** |
| A13. Deterministic-only behavior remaining unchanged | **APPROVED** |
| A14. Complete removal as the rollback mechanism | **APPROVED** |

All Gate A conditions were explicitly approved by the owner through the Phase 5.1
implementation instruction on 2026-08-01. Phase 5.1 has been implemented and validated
locally. The implementation remains uncommitted and is not integrated or deployed.

---

### Gate B — Phase 5.2 and Phase 5.3 contracts

Gate B requires all decisions listed in Section D. It does not require a live Bedrock
account, credentials, or confirmed benchmark labels. Phases 5.2–5.3 may use local fixtures
or a stub. They must not call Bedrock.

Gate B conditions (all from Section D):

| Condition | Status |
|---|---|
| B1. Internal-envelope fields approved | **APPROVED** |
| B2. Provider-bound transaction fields approved | **APPROVED** |
| B3. Prohibited fields approved | **APPROVED** |
| B4. Candidate descriptor DTO approved | **APPROVED** |
| B5. Structured raw response schema approved | **APPROVED** |
| B6. Non-throwing parser contract approved | **APPROVED** |
| B7. Valid-ID behavior (Phase 5.3 boundary) approved | **APPROVED** |
| B8. Abstention taxonomy (provider-declared vs. internal) approved | **APPROVED** |
| B9. Bounds and fixture requirements approved | **APPROVED** |

Gate B was approved by the owner on 2026-08-01. Phase 5.2 and Phase 5.3 are implemented and validated locally, remain uncommitted, and have no runtime integration.

---

### Gate C — Phase 5.4 real shadow inference

Gate C requires all operational decisions before the first real provider invocation. Gate C
conditions (all from Sections E, F, and G):

| Condition | Status |
|---|---|
| C1. Deployment identity mechanism selected after live-host verification | **POLICY APPROVED** — verify live host first; workload identity if proven; otherwise renewable short-lived credentials; static requires time-bounded exception |
| C2. Bedrock region selected after live-account verification | **POLICY APPROVED / VALUE PENDING** — `OWNER_TO_SELECT_AFTER_LIVE_ACCOUNT_VERIFICATION` |
| C3. Exact pinned model identifier selected from the live catalog | **POLICY APPROVED / VALUE PENDING** — `OWNER_TO_SELECT_FROM_LIVE_BEDROCK_MODEL_CATALOG`; must be pinned, versioned, entitled, with documented retirement procedure |
| C4a. Catalog availability, documented entitlement, IAM/access metadata, quota, pricing, and provider terms (metadata evidence — gathered before Phase 5.4A; no invocation) | **POLICY APPROVED / EVIDENCE PENDING** — checklist approved; metadata not yet collected; C4a does not prove successful invocation |
| C4b. Invocation capability proven via synthetic smoke test (Section G.3 / Gate C-S — gathered after Phase 5.4A implementation) | **INVOCATION CAPABILITY NOT YET PROVEN** — requires separately authorized Gate C-S after Phase 5.4A is implemented; C4b blocks Phase 5.4B, not Phase 5.4A |
| C5. Server-only credential boundary and rotation/revocation approach approved | **POLICY APPROVED** — server-only, least-privilege, independently revocable and rotatable, no client/source/log/browser exposure, fail-closed |
| C6. Privacy, retention, provider-data-use, logging, and incident policy approved | **POLICY APPROVED** — direction + optional amount/currency + candidate IDs/labels + optional evidence counts only; counterparty, purpose, merchant, examples omitted |
| C7. First-shadow payload and deferred expansion fields approved | **POLICY APPROVED** — all optional expansion fields initially omitted; later bounds are proposals only requiring separate approval |
| C8. Timeout, retry, concurrency, rate limit, circuit breaker, and deduplication approved | **APPROVED** — 10 s timeout; 1 retry transient only; 500 ms jittered backoff capped 2 s; concurrency 2; 20 req/min; circuit breaker 5 failures/60 s with 5-min cooldown; 1 invocation per identity per run; 25 s item wall time |
| C9. Monetary, request, and token caps approved | **PARTIALLY APPROVED / MONETARY VALUES PENDING** — smoke-run 10 requests; input 4,096 tokens; output 256 tokens; fail-closed at any cap; daily/monthly/per-run monetary caps require live pricing before entry |
| C10. Server-internal accounting and observability metadata approved | **APPROVED** — ephemeral server-internal metadata only; no request/response bodies, workspace/transaction IDs, hashes, credentials, or raw finance facts in logs |
| C11. Default-off control approved | **APPROVED** — conceptual `AI_SHADOW_INFERENCE_ENABLED` default false; not yet added to configuration |
| C12. Kill-switch mechanism and operator procedure approved | **APPROVED** — Dokploy-managed runtime control + authorized restart; audit evidence, fail-closed, deterministic fallback, tested procedure required |
| C13. Shadow-output handling selected | **APPROVED** — G1 ephemeral report-only; no Prisma schema, migration, or persistent shadow records |
| C14. No-booking and rollback acceptance plan approved | **APPROVED** — complete zero-side-effect checklist; model output must never create/alter bookings, review decisions, suggestions, transactions, finance facts, periods, ledgers, trusted history, workspace scope, or locked-period state |
| Labeling strategy (Option 2) | **APPROVED** — stratified cohort; reproducible project/direction/amount/evidence strata with randomized selection; label creation not authorized |
| Exact Option 2 cohort size | **PENDING** — `OWNER_TO_SELECT_EXACT_COHORT_SIZE_FROM_60_TO_100`; not needed for Gate C-M, Phase 5.4A, or one G.3 synthetic invocation; required before cohort selection, label creation, and Phase 5.4B; selecting the exact number does not authorize creating labels |

**Entry to Phase 5.4A — provider integration and synthetic-smoke readiness** may begin after:

- Gate C-P (C1–C14 policy): **APPROVED**
- C1 deployment identity evidence (live host verified)
- C2 exact region (live-account metadata)
- C3 exact pinned model identifier (live catalog)
- C4a metadata evidence (catalog, documented access, quota, pricing, provider terms)
- C5 exact credential-delivery mechanism confirmed
- C6–C14 policies: **APPROVED**
- C9 numeric monetary caps confirmed
- Separate owner authorization for Phase 5.4A implementation

Phase 5.4A does **not** require C4b invocation proof, an exact cohort size, or completed labels.

**Entry to Gate C-S — synthetic smoke** may begin after:

- Phase 5.4A implemented and validated locally
- Default-off and kill-switch controls functional and tested
- Synthetic payload approved in advance
- Credential delivery confirmed without recording values
- Exact cost cap for one invocation confirmed
- Separate owner invocation authorization

**Entry to Phase 5.4B — first real shadow run** may begin after:

- Successful C4b evidence from Gate C-S
- Exact Option 2 cohort size selected
- Frozen cohort-selection method
- Separately authorized and completed labels
- Frozen labeled cohort
- Run-specific monetary cap confirmed
- Final owner authorization for the first real shadow run

Policy approval alone does not authorize AWS access, credentials, model calls, configuration changes, label creation, or deployment.

---

### Gate D — Phase 6 evaluation and Phase 7 rollout

These thresholds apply when Phase 5 shadow output exists and labeled benchmark data is
available. They are not prerequisites for any Phase 5 slice.

**Phase 6 may define and evaluate:**

| Metric | Starting option | Label |
|---|---|---|
| Project accuracy (top-1) | ≥ 60% over labeled cohort | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Transaction-type accuracy (top-1) | ≥ 60% over labeled cohort | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Category accuracy (top-1) | ≥ 50% over labeled cohort | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Complete three-dimension accuracy (top-1) | ≥ 40% over labeled cohort | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Top-three candidate accuracy | ≥ 70% over labeled cohort | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Coverage (non-abstention rate) | ≥ 80% over labeled cohort | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Abstention rate | ≤ 20% over labeled cohort | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| False-high-confidence rate | ≤ 10% of all recommendations | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Provider failure rate | ≤ 5% of invocations | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Maximum duplicate or stale Decision tolerance | 0 in shadow output | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Maximum cost per benchmark run | To be set after live model + token counts confirmed | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Maximum latency per inference (p95) | To be set after live measurements | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |

**Phase 7 reviewer-exposure thresholds:**

| Metric | Starting option | Label |
|---|---|---|
| Green-band complete-classification precision | ≥ 95% over validated cohort | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| False-high-confidence rate in green band | ≤ 2% | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |
| Reviewer correction rate | ≤ 15% sustained | `ILLUSTRATIVE — NOT APPROVED — REQUIRES MEASUREMENT` |

**Owner decision required for Gate D** when Phase 6 planning begins, not now. These thresholds
cannot be prerequisites for Phase 5.1, 5.2, 5.3, or 5.4 because model output does not exist
at those phases.

Zero-tolerance conditions (recommended invariants, still require explicit approval):

| Condition | Recommended |
|---|---|
| Invalid-ID tolerance | 0 (any out-of-set ID is an integrity violation) |
| Workspace-isolation failure tolerance | 0 (cross-workspace exposure is absolute safety failure) |
| Booking or trusted-history contamination | 0 (non-negotiable architectural invariant) |

---

## I. Proposed Phase 5.1 scope after Gate A approval

This section describes — but does not implement — the smallest coherent first code slice.

### What Phase 5.1 would add

The only goal of Phase 5.1 is to establish the server-only provider interface in a
permanently disabled state and prove that it satisfies all safety requirements without
any external API call.

The slice would include:

- **Server-only provider interface:** a TypeScript interface defining the contract for
  an inference adapter. No browser exports permitted.
- **Disabled provider implementation:** a concrete implementation that always returns
  a deliberate abstention with reason `PROVIDER_DISABLED`. No actual Bedrock SDK calls.
  The implementation is constructible without environment variables and requires no
  provider configuration of any kind.
- No Decision persistence. No model invocation from review reads. No booking or suggestion
  mutations. No Sonnet fallback. No browser-accessible inference path.
- Phase 5.1 does not validate AWS region formats, Bedrock model identifiers, provider
  credentials, access keys, IAM configuration, provider-specific environment variables,
  or live provider entitlement. Those belong to Gate C.
- Phase 5.1 does not modify `deterministicDecisionOrchestrationService.ts`. It does not
  introduce an optional inference-contributor slot into the orchestrator.
- Phase 5.1 is not called by routes, review reads, benchmark runners, background jobs,
  or startup code. No existing service imports the adapter. Integration begins only in
  a later approved slice after Gate B and Gate C approval.
- The adapter is an isolated server-only module. Its safety contract is proven by tests.
  Removing it restores the exact prior runtime behavior (invariants A6, A13, A14).

### What Phase 5.1 would not include

- The AWS Bedrock SDK package.
- Bedrock credentials, IAM roles, or environment variable values.
- Any actual HTTP call to a provider.
- Any change to `prisma/schema.prisma` or any migration.
- Any change to the review queue, review decision, or booking path.
- Shadow-output storage (deferred to Phase 5.4 or Phase 6).
- Calibration, metrics, or confidence exposure.

### Anticipated Phase 5.1 files

Phase 5.1 creates exactly two files and modifies no existing file:

- New: `server/services/bedrockInferenceAdapter.ts`
- New: `tests/services/bedrockInferenceAdapter.test.ts`

No other implementation file is anticipated for Phase 5.1.

### Anticipated Phase 5.2 files

Phase 5.2 creates exactly two files and modifies no existing file:

- New: `server/services/inferenceContractService.ts`
- New: `tests/services/inferenceContractService.test.ts`

The name is provider-neutral because Phase 5.2 defines provider-neutral DTOs and Zod
schemas. Using a Bedrock-specific filename for a provider-neutral contract would be
misleading and would require a rename if the provider changes.

Phase 5.2 does not modify `bedrockInferenceAdapter.ts` or its test file. It does not
integrate with orchestration, read from Prisma, build real payloads, or enrich candidate
labels.

### Tests Phase 5.1 would add

- Disabled adapter always returns `PROVIDER_DISABLED` abstention for any input.
- Result is deterministic for repeated identical input.
- `workspaceId` and `targetTransactionId` are required by the TypeScript contract; omission is rejected at compile time, while runtime cross-workspace mismatch validation belongs to a later integration boundary.
- No external network call or provider client exists in the module.
- No AWS SDK import exists in the module.
- No environment variable or credential is read.
- Serialized results contain no secrets.
- Module has no Prisma dependency.
- Module has no route, review, booking, suggestion, or accounting dependency.
- No database write or financial side effect is possible.
- Existing deterministic orchestration tests remain unchanged and passing.
- Removal of the two new files restores the exact prior runtime behavior.

---

## J. Approval requests

### Approval A — Phase 5.1 only

This approval authorizes only the disabled provider boundary. It is concise and can be
answered without any of the provider, model, credential, privacy, or cost decisions.

**This approval explicitly does not authorize:**

- Bedrock SDK installation or usage;
- AWS account provisioning, IAM role creation, or credential issuance;
- AWS Bedrock model invocation of any kind;
- any benchmark labeling action on behalf of the owner;
- execution of owner-history-v2 proposals;
- creation of `ReviewDecision` or `TransactionBooking` records;
- schema change, migration, or Prisma model addition;
- deployment, commit, or push.

Gate A conditions — all approved by owner on 2026-08-01:

- [x] **A1.** Server-only placement: no browser export, no client bundle
- [x] **A2.** Disabled-by-default: always returns `PROVIDER_DISABLED`
- [x] **A3.** No external calls of any kind
- [x] **A4.** No provider SDK
- [x] **A5.** No credentials or environment variables for provider
- [x] **A6.** No route or review-read invocation
- [x] **A7.** No Decision persistence
- [x] **A8.** No suggestion mutation
- [x] **A9.** No `ReviewDecision` creation
- [x] **A10.** No booking
- [x] **A11.** No trusted-history mutation
- [x] **A12.** No schema or migration change
- [x] **A13.** Deterministic-only behavior remaining unchanged
- [x] **A14.** Complete removal as the rollback mechanism

**Labeling strategy (pre-Gate-C, not required for Gate A):** selecting a labeling strategy is not required to approve Phase 5.1. Label creation is not authorized before Gate C. A labeling strategy must be approved before Phase 5.4 real shadow inference (as part of Gate C). Frozen confirmed labels remain required for Phase 6 evaluation. The strategy options are described in Section C; the decision is reserved until Gate C planning.

---

### Approval B — Phase 5.2–5.3 contract design

**Status: APPROVED by owner on 2026-08-01. All recommended B1–B9 values below are selected; no overrides were requested.**

Gate B decisions govern Phase 5.2 (provider-neutral TypeScript DTOs, strict raw-response
schemas, non-throwing parser, serialization-safe amount representation, request/response
bounds, and synthetic fixtures) and Phase 5.3 (candidate membership validation, dimension
validation, candidate-set identity validation using the trusted envelope, stale-set
rejection, direction compatibility, complete-triple enforcement, and fail-closed conversion
to internal abstention).

This approval does not require a live Bedrock account or confirmed benchmark labels. It does
not authorize sending real transaction data to any provider. Gate B approves the contract
shape only.

Concrete recommended values are in Section D. Owner approves or rejects each item below.

- [x] **B1.** Internal-envelope fields: `contractVersion`, `workspaceId`, `targetTransactionId`, `transactionFactHash`, `candidateSetHash` — all server-internal; none sent to provider or returned by model  
  ☒ Approve recommended  ☐ Override: not selected

- [x] **B2.** Provider-bound transaction fields: `direction` as lowercase `"credit"` or `"debit"` (exact domain values; required); `amountMinor` as signed base-10 integer string and `currency` as an all-or-nothing pair (both present or both absent; floating-point prohibited); candidate descriptors (required); aggregate evidence counts (optional); counterparty text, payment purpose, and history examples deferred to Gate C  
  ☒ Approve recommended  ☐ Override: not selected

- [x] **B3.** Prohibited fields: credentials, all five Object-A fields, user ID, account ID, IBAN, source file bytes, raw imported rows, booking and review-decision IDs, unrelated history, cross-workspace data, internal schema information, unrestricted evidence, hidden chain-of-thought in provider payload; `contractVersion`, `candidateSetHash`, confidence, free-form rationale, and unknown fields in raw provider response  
  ☒ Approve recommended  ☐ Override: not selected

- [x] **B4.** Candidate descriptor DTO: candidates grouped by dimension (`projects[]`, `transactionTypes[]`, `categories[]`); no redundant `dimension` field per descriptor; common fields `candidateId`, `rank` (1–10), `displayLabel` (max 128 chars), optional `supportingEvidenceCount`, optional `conflictingEvidenceCount`; transaction types additionally may carry optional `transactionTypeDirection: "credit" | "debit"` (no `BOTH`); max 10 per array; max 30 total; label enrichment deferred to later approved slice before Phase 5.4 (Phase 5.2 must not read Prisma)  
  ☒ Approve recommended  ☐ Override: not selected

- [x] **B5.** Structured raw response schema: strict discriminated union on `outcome` (`"PROPOSED"` / `"ABSTAINED"`); classification IDs as strings max 128 chars; `contractVersion` and `candidateSetHash` absent from raw response (trusted application context only); unknown properties rejected; no partial proposals; no free-form rationale; no confidence values; abstention reason one value from provider-declared set only  
  ☒ Approve recommended  ☐ Override: not selected

- [x] **B6.** Non-throwing parser: `parseProviderResponseText(rawText: string): ProviderResponseParseResult` where result is `{ ok: true; value: RawProviderClassificationResponse }` or `{ ok: false; reason: 'MALFORMED_PROVIDER_OUTPUT' }`; parser measures byte length first, then parses JSON in a guarded boundary, then applies strict Zod schema; on any failure returns `ok: false`; never throws; `ok: false` is an internal indicator generated by application code, not a valid model-supplied ABSTAINED response  
  ☒ Approve recommended  ☐ Override: not selected

- [x] **B7.** Valid-ID behavior (Phase 5.3 boundary): candidate ID membership, dimension membership, complete-triple, `candidateSetHash` match (using trusted Object-A value, not model-supplied), stale-set rejection, direction compatibility, whole-result abstention on any invalid selection — all reserved exclusively for Phase 5.3; none implemented in Phase 5.2  
  ☒ Approve recommended  ☐ Override: not selected

- [x] **B8.** Abstention taxonomy: provider-declared reasons (`INSUFFICIENT_CONTEXT`, `AMBIGUOUS_EVIDENCE`, `CONFLICTING_EVIDENCE`, `MISSING_VALID_CANDIDATES`) — only these may appear in a valid raw ABSTAINED response; internal/system reasons (`PROVIDER_DISABLED`, `PROVIDER_UNAVAILABLE`, `MALFORMED_PROVIDER_OUTPUT`, `INVALID_CANDIDATE_SELECTION`, `STALE_CANDIDATE_SET`) — generated by application code only, never accepted from raw provider output; a model-supplied string matching an internal reason name is malformed  
  ☒ Approve recommended  ☐ Override: not selected

- [x] **B9.** Bounds: default max candidates/dimension 5; hard max per dimension 10; hard max total descriptors 30 (not 30 evidence items — evidence counts are scalars); display-label max 128 chars pending approval; request byte limit 16 384 UTF-8 bytes pending approval; response byte limit 4 096 UTF-8 bytes pending approval; counterparty and payment-purpose limits deferred to Gate C; fixtures fully synthetic (no real IDs, IBANs, descriptions, counterparties, values recognized as secret-shaped by repository scanner); Zod with `.strict()` pending this approval  
  ☒ Approve recommended  ☐ Override: not selected

### Phase 5.2 local implementation evidence

Status: `DONE_LOCAL_UNCOMMITTED` on 2026-08-01.

Created exactly:

- `server/services/inferenceContractService.ts`
- `tests/services/inferenceContractService.test.ts`

The provider-neutral contract module exports the approved request and response DTO schemas, candidate descriptor schemas, approved bounds, provider-declared abstention reasons, `ProviderResponseParseResult`, and the non-throwing `parseProviderResponseText` parser. It imports no Prisma, provider SDK, orchestration, route, review, booking, suggestion, or accounting service and performs no network, environment, filesystem, logging, database, or production operation.

Validation evidence:

- focused Phase 5.2 contract tests: 58/58 passed;
- Phase 5.1 adapter regression: 12/12 passed;
- deterministic orchestration regression: 10/10 passed;
- server TypeScript build: passed;
- Next.js production build: passed with the pre-existing SWC lockfile warning only;
- full `tsconfig.json` diagnostic check: non-zero because of pre-existing repository diagnostics, with no diagnostic referencing either Phase 5.1 or Phase 5.2 file;
- high-risk scan across all four Phase 5.1–5.2 files: zero findings;
- no package, lockfile, Prisma, migration, configuration, runtime integration, provider call, production command, deployment, commit, or push occurred.

Phase 5.1 files were not modified during this slice. Phase 5.2 implementation remained unchanged. Its focused test received one owner-approved narrow repair so compile-time-only `import type` dependencies remain permitted while runtime imports remain forbidden.

### Phase 5.3 local implementation evidence

Status: `DONE_LOCAL_UNCOMMITTED` on 2026-08-01.

Created exactly:

- `server/services/inferenceCandidateValidationService.ts`
- `tests/services/inferenceCandidateValidationService.test.ts`

The pure semantic validator receives the trusted internal envelope, the current trusted restricted-candidate result, and a structurally valid Phase 5.2 raw provider response as separate inputs. It validates trusted workspace, target-transaction, and candidate-set identities before any response outcome; passes valid provider-declared abstentions through unchanged only after trusted-context validation; and fail-closes proposals on incomplete or duplicate IDs, non-matched candidate-set state, missing or cross-dimension membership, ambiguous IDs, inactive candidates, incompatible direction, or incorrect candidate dimension.

Failure results are internal abstentions only:

- `STALE_CANDIDATE_SET` for trusted context or candidate-set identity mismatch;
- `INVALID_CANDIDATE_SELECTION` for every proposal membership or candidate-integrity failure.

Validation evidence:

- focused Phase 5.3 semantic-validation suite: 25/25 passed;
- Phase 5.2 contract regression: 58/58 passed after the approved type-only-import assertion repair;
- Phase 5.1 adapter regression: 12/12 passed;
- restricted-candidate regression: 12/12 passed;
- deterministic orchestration regression: 10/10 passed;
- server TypeScript build: passed;
- Next.js production build: passed with the pre-existing SWC lockfile warning only;
- full `tsconfig.json` check: exit code 2 from pre-existing repository diagnostics only, with no diagnostic referencing Phase 5.1, Phase 5.2, or Phase 5.3 files;
- high-risk scan across all six Phase 5.1–5.3 code and test files: zero findings;
- no Prisma, provider SDK, environment access, network, filesystem, logging, route, orchestration, review, booking, suggestion, accounting, or production dependency was introduced into the validator.

No runtime integration, provider call, database effect, deployment, stage, commit, or push occurred. Gate C and Gate D remain pending. Gate C decision preparation is the exact next owner action; Phase 5.4 has not started.

---

### Approval C — Phase 5.4 live shadow inference

**Status: POLICY DECISIONS APPROVED on 2026-08-02. Live-verification values remain unresolved.**

The owner explicitly approved all C1–C14 policy decisions and the labeling strategy
(Option 2) on 2026-08-02. The following values must still be resolved before Phase 5.4
may begin:

- **C2** — Bedrock region: `OWNER_TO_SELECT_AFTER_LIVE_ACCOUNT_VERIFICATION`
- **C3** — Exact pinned model identifier: `OWNER_TO_SELECT_FROM_LIVE_BEDROCK_MODEL_CATALOG`
- **C4a** — Metadata evidence (catalog, entitlement, quota, pricing, terms): not yet collected
- **C4b** — Invocation capability proof: `INVOCATION CAPABILITY NOT YET PROVEN` (requires Section G.3)
- **C9** — Daily, monthly, and per-run monetary caps: requires confirmed pricing and owner entry
- **Exact cohort size** — `OWNER_TO_SELECT_EXACT_COHORT_SIZE_FROM_60_TO_100`

No AWS access, credential creation, model invocation, label creation, or Phase 5.4
implementation is authorized until all values above are resolved and recorded.

---

- [x] **C1. Deployment identity.** Approved: verify the live Dokploy host first; use attached
  workload identity only when proven available for this container; otherwise use renewable
  short-lived server credentials; static credentials require a separate time-bounded exception.

- [x] **C2. Region.** Approved: the live-verification process is approved. Value remains
  `OWNER_TO_SELECT_AFTER_LIVE_ACCOUNT_VERIFICATION`. No region is selected until live
  verification confirms model availability, entitlement, data residency, and network
  reachability.

- [x] **C3. Model identifier.** Approved: the live-catalog selection process is approved. Value
  remains `OWNER_TO_SELECT_FROM_LIVE_BEDROCK_MODEL_CATALOG`. Must be pinned, versioned,
  entitled in the selected region, and have a documented retirement procedure.

- [x] **C4a. Model-access metadata evidence.** Approved: collect catalog availability,
  documented entitlement state, IAM or access metadata visible without mutation, quota
  metadata, pricing from the official source, and provider retention/data-use terms — all
  without invoking a model. C4a is the metadata tier gathered through Section G.2 before
  Phase 5.4A implementation. C4a does not prove successful invocation. `EVIDENCE PENDING`

- [x] **C4b. Invocation capability proof.** Approved: a single bounded synthetic smoke
  invocation through Gate C-S (Section G.3) after Phase 5.4A is implemented and validated.
  C4b is an operational invocation evidence tier gathered after Phase 5.4A. Catalog listing
  or metadata alone does not prove invocation capability. C4b blocks Phase 5.4B; it does
  not block Phase 5.4A. Until C4b succeeds: `INVOCATION CAPABILITY NOT YET PROVEN`

- [x] **C5. Credentials.** Approved: server-only, least-privilege, independently revocable and
  rotatable credentials with no client exposure, source-control value, documentation value,
  browser bundle, or logging. Missing/expired/malformed credentials fail closed. No variable
  name or value is approved yet.

- [x] **C6. Privacy.** Approved: transmit only direction; optional amount/currency pair;
  constrained project/type/category candidate IDs and display labels; optional scalar
  support/conflict counts. Counterparty, payment purpose, merchant labels, and history
  examples remain omitted. Require shortest available retention, no provider training use
  where supported, metadata-only application logs, regional handling, and disable/revoke
  incident procedure.

- [x] **C7. Payload expansion.** Approved: initial omission of all optional expansion fields.
  Documented later bounds remain proposals only and require separate approval before use.

- [x] **C8. Operational limits.** Approved: 10,000 ms timeout per attempt; one retry only for
  transient failures; 500 ms exponential backoff with jitter capped at 2,000 ms; concurrency 2;
  20 requests per minute; circuit breaker open after 5 consecutive failures in 60 seconds with
  5-minute cooldown; one invocation per trusted identity per run; maximum 25-second item wall
  time.

- [x] **C9. Budget.** Approved: first smoke-run cap 10 requests; provisional maximum input
  tokens 4,096; provisional maximum output tokens 256; immediate fail-closed behavior when any
  cap is reached. Daily, monthly, and per-run monetary caps remain mandatory but unresolved
  until model and pricing verification. No call is authorized until numeric monetary values
  are approved.

- [x] **C10. Observability.** Approved: ephemeral server-internal operational metadata only.
  Do not log request/response bodies, workspace or transaction IDs, trusted hashes in exposed
  logs, credentials, or raw finance facts.

- [x] **C11. Default-off.** Approved: a future server-only control, conceptually
  `AI_SHADOW_INFERENCE_ENABLED`, default false in every environment. This approval does not
  add the configuration value.

- [x] **C12. Kill switch.** Approved: initial Dokploy-managed server-only runtime control with
  authorized container restart and no image rebuild. Require audit evidence, fail-closed
  behavior, deterministic fallback, and a tested restart procedure.

- [x] **C13. Shadow output.** Approved: G1 ephemeral report-only output for Phase 5.4. No
  Prisma schema, migration, or persistent shadow-decision record is authorized.

- [x] **C14. No-booking and rollback.** Approved: complete zero-side-effect checklist. Model
  output must never create or alter bookings, review decisions, suggestions, transactions,
  finance facts, periods, ledgers, trusted history, workspace scope, or locked-period state.
  All failures degrade to deterministic-only output or abstention. Rollback disables/removes
  model contribution while manual and deterministic review remains available.

- [x] **Labeling strategy.** Approved: Option 2 — reproducible stratified cohort. Selection
  must cover projects, both directions, amount ranges, evidence/conflict states, and
  randomized selection within strata. This approval selects the strategy only and does not
  authorize creating labels.

- [ ] **Exact Option 2 cohort size.** Pending owner selection.
  `OWNER_TO_SELECT_EXACT_COHORT_SIZE_FROM_60_TO_100`

  Selecting this number does not authorize creating labels. Labels may only be created
  through the existing individual administrator review path after Gate C is fully resolved.

  **Owner decision line:**
  ```
  Exact Option 2 cohort size: [choose one integer from 60 through 100]
  ```

---

**What this approval authorizes:** Gate C-M metadata-verification preparation only.
Phase 5.4A planning may begin only after Gate C-M values are confirmed by the owner.
Phase 5.4A implementation requires a separate owner authorization after Gate C-M.
Gate C-S (one synthetic invocation) requires a separate owner authorization after Phase 5.4A.
Phase 5.4B (first real shadow run) requires C4b, exact cohort, frozen labels, and final owner authorization.

**What this approval does not authorize:** AWS access, account queries, credential creation,
configuration changes, model calls, label creation, provider data transmission, deployment,
commit, or push. Each operational action requires a separate explicit task after all
live-verification placeholders (C2, C3, C4a evidence, C9 monetary caps) are confirmed and
further separate authorizations are issued for Phase 5.4A, Gate C-S, and Phase 5.4B.

---

### Approval D — Phase 6 evaluation and Phase 7 rollout

Do not ask the owner to approve numeric model-performance thresholds before Phase 5.4 shadow
output exists. Numeric values in Gate D become meaningful only after shadow outputs can be
measured against human-confirmed labels.

When Phase 6 planning begins, the owner must approve or modify the thresholds listed in
Section H (Gate D). At that time, the following will be required:

- [ ] **D1.** Phase 6 per-dimension accuracy thresholds (all labeled `ILLUSTRATIVE` in Section H)
- [ ] **D2.** Phase 6 coverage and abstention thresholds
- [ ] **D3.** Phase 6 false-high-confidence threshold
- [ ] **D4.** Phase 6 latency and provider-failure thresholds (measured values required)
- [ ] **D5.** Phase 6 cost thresholds (verified against live model ID and token volumes)
- [ ] **D6.** Phase 7 green-band precision threshold
- [ ] **D7.** Phase 7 false-high-confidence and reviewer-correction thresholds

---

*End of Phase 5 Entry Gate brief.*
