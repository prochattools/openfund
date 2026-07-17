# Yeshua Academy Finance — Documentation Governance

Status: CURRENT  
Owner: repository maintainers  
Canonical for: documentation governance, ownership, status, migration, and archival rules  
Last reviewed: 2026-07-17  
Index: `docs/README.md`

## Core rule

Repository documentation is the durable project memory. Chat history, temporary prompts, and uncommitted notes are not authoritative.

One fact has one canonical home. Other documents may summarize and link to that fact, but must not redefine it.

## Documentation hierarchy

Documentation responsibilities flow in this direction:

```text
strategic direction
→ architecture and domain contracts
→ roadmap
→ implementation planning
→ active run and handoff
→ operational and release evidence
→ historical evidence
```

### Strategic direction

Defines product purpose, long-term goals, constraints, and success measures.

Current canonical documents:

- `docs/PHILOSOPHY.md`
- `docs/STRATEGY.md`

### Architecture and domain contracts

Define what the system must preserve, including financial truth, domain boundaries, authorization, review behavior, auditability, and data invariants.

Current canonical documents include:

- `docs/DOMAIN_MODEL.md`
- `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`

### Roadmap

Defines when capabilities are introduced, their dependencies, exclusions, and completion criteria.

Current canonical document:

- `docs/ROADMAP.md`

### Implementation planning

Defines how the current approved work is implemented, validated, and released. It may not redefine architecture.

Current canonical document:

- `docs/IMPLEMENTATION_PLAN.md`

### Operations

Define how to run, deploy, verify, restore, reconcile, and administer the application. Operational documents may not redefine product or accounting architecture.

### Active run and handoff

Record the exact current source, branch, HEAD, changed paths, validation, commits, blockers, restrictions, and exact next task.

Current canonical document:

- `docs/finance-rebuild-run.md`

This path remains the active handoff until a separately approved migration updates every script, test, workflow, cross-reference, operational procedure, and resume instruction that consumes it.

### Historical evidence

Preserves prior plans, decisions, handoffs, release evidence, and superseded architecture. Historical material does not govern new implementation unless a current canonical document explicitly references it.

## Fixed status vocabulary

Every governed document should use one of these statuses:

- `DRAFT` — incomplete and not approved for implementation.
- `PROPOSED` — ready for review but not authoritative.
- `APPROVED` — accepted architecture or policy, not necessarily the current execution document.
- `CURRENT` — the one active canonical document for its responsibility.
- `SUPERSEDED` — replaced by a named canonical document and not valid for new decisions.
- `ARCHIVED` — retained only as historical evidence.

Do not invent equivalent status labels when one of these applies. There may not be two `CURRENT` documents for the same responsibility.

## Ownership expectations

Every governed document should declare:

- `Status`
- `Owner`
- `Canonical for`
- `Last reviewed`
- `Depends on` or `Related documents` where useful
- `Supersedes` or `Superseded by` when applicable

Ownership expectations:

- strategic direction: product and engineering leadership;
- accounting architecture and invariants: accounting and engineering owners jointly;
- domain architecture: the responsible domain owner;
- roadmap: product and engineering leadership;
- implementation plan: the current implementation owner;
- operational procedures: the operations owner;
- active run: the current executor;
- release evidence: the release owner or verifier.

## Cross-reference rules

Lower-level documents must reference higher-level authorities rather than copy their mutable content.

Required direction:

```text
architecture
→ roadmap
→ implementation plan
→ active run
→ operational and release evidence
```

Examples:

- a roadmap phase links to its architecture contract;
- an implementation task links to the roadmap and architecture it implements;
- the active run records which implementation task is current;
- release evidence records what was validated and deployed.

Lower-level documents may not silently redefine architecture, accounting truth, authorization, workspace isolation, learning eligibility, confidence semantics, or audit requirements.

## Architecture-first change rule

Before code changes an architectural contract, the relevant architecture document or decision record must be updated and approved.

This rule applies especially to changes involving:

- accounting truth or booking creation;
- immutable bank facts;
- suggestion-versus-booking separation;
- authorization or workspace isolation;
- audit and evidence retention;
- learning eligibility;
- model, retrieval, confidence, or decision-engine responsibilities;
- schema ownership or migration boundaries.

Implementation plans may refine execution details within approved architecture, but may not introduce new architecture by implication.

## Compatibility-stub policy

Markdown has no true redirect. Future path migrations must preserve compatibility with a stub when scripts, tests, workflows, external links, or operational procedures still depend on the old path.

A compatibility stub must:

- declare status `CURRENT` only if it remains the canonical entrypoint, otherwise `SUPERSEDED`;
- name and link the replacement canonical document;
- state that mutable content belongs only in the replacement;
- avoid retaining a second copy of changing architecture or status;
- remain until every consumer is updated and at least one complete validation cycle has passed.

A future path migration must update exact-path scripts and tests in the same bounded packet as the path change.

## Archival policy

Historical documents are preserved unless an explicit retention decision permits deletion.

Archival requirements:

- preserve Git history;
- add a `SUPERSEDED` or `ARCHIVED` banner;
- link to the replacing canonical document when one exists;
- remove archived files from onboarding and current implementation reading orders;
- never leave archived material marked `CURRENT`;
- archive completed active runs by date or program;
- preserve accepted decision records as immutable evidence.

Do not combine content migration, path movement, and architectural rewriting in one packet unless explicitly approved and independently reversible.

## Owner and release suite rule

The owner-review and release document suite is path-sensitive and interdependent. It must never be partially migrated.

A migration of this suite must update together:

- every affected owner and release document;
- `scripts/final-docs-consistency-audit.mjs` and any related scripts;
- focused owner, roadmap, release, and documentation consistency tests;
- generated references and rollback instructions;
- root and documentation indexes.

## Active-run requirements

After each coherent implementation, documentation, verification, or release packet, the active run must record:

- source, branch, and starting HEAD;
- task and current phase;
- changed paths;
- completed behavior or documentation;
- validation commands and results;
- commits;
- blockers and uncertainty;
- push or deployment restrictions;
- exact next task.

The active run records execution state. It must not become the canonical home for permanent architecture.

## Validation requirements

Every documentation packet must run the smallest relevant validation, including as applicable:

- `git diff --check`;
- final documentation consistency audit;
- focused final-docs consistency tests;
- focused roadmap-status consistency tests;
- focused release-evidence consistency tests;
- broken-reference search for changed paths;
- duplicate `CURRENT` status review;
- focused secret-material scan on every changed path.

When canonical paths change, every exact-path script, test, workflow, cross-reference, and operational instruction must be validated in the same packet.

## Phase-transition review

Before a roadmap phase changes status, review:

- relevant architecture and invariants;
- roadmap objective, dependencies, exclusions, and completion criteria;
- implementation plan and validation evidence;
- release and rollback readiness;
- active-run checkpoint and exact next task;
- whether historical plans should be superseded or archived.

A phase is not complete merely because code exists. Required validation, production verification where applicable, and documentation reconciliation must also be complete.

## Migration restrictions

Until separately approved:

- existing root-level canonical paths remain authoritative;
- `docs/finance-rebuild-run.md` remains the active handoff;
- no canonical document may be moved, renamed, split, archived, or replaced by this governance policy alone;
- no owner/release document may be migrated independently;
- no exact-path consumer may be left pointing to a removed or noncanonical path.
