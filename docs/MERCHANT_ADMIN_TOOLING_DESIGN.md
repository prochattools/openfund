# Yeshua Academy Finance — Merchant Knowledge Administrator Tooling Design

Status: APPROVED  
Owner: merchant-domain and finance-application owners  
Canonical for: Program Phase 3.8 administrator-tooling implementation readiness  
Last reviewed: 2026-07-18  
Depends on: `docs/architecture/MERCHANT_KNOWLEDGE_ARCHITECTURE.md`, `docs/MERCHANT_KNOWLEDGE_SCHEMA_PROPOSAL.md`, `docs/architecture/ARCHITECTURAL_INVARIANTS.md`  
Related documents: `docs/IMPLEMENTATION_PLAN.md`, `docs/ACCOUNTING_INTEGRITY_AND_REVIEW_PREFILL.md`, `docs/finance-rebuild-run.md`

## Implementation status

This document is an implementation-readiness design only. It does not create a route, API, service, Prisma model, migration, UI component, persistence behavior, mutation, audit event, feature flag, Bedrock integration, AI inference, booking, or automatic action.

Program Phase 3.8 code must not begin until the schema/persistence prerequisites and the implementation gates in this document are separately approved.

## Objective

Provide an administrator-only, individually confirmed Merchant Knowledge maintenance workflow that improves deterministic categorization intelligence for the 221 unresolved transactions and future review queues without changing accounting truth.

The tooling may inspect and propose changes to merchant identities, aliases, fingerprints, conflicts, merges, splits, reassignment, and deprecation. It must never create or rewrite a `TransactionBooking`, alter imported bank facts, or silently promote generated knowledge to trusted state.

## Exact current source map

| Current file or symbol | Current responsibility | Phase 3.8 relevance |
|---|---|---|
| `server/auth/requestContext.ts` — `requireAuthenticatedRequest`, `requireAdmin`, `RequestActor` | Resolves authenticated workspace membership and authoritative server role (`admin` or `viewer`). | All read routes require authentication. Every mutation route must call `requireAdmin`; client role hints are never authoritative. |
| `server/services/reviewDecisionService.ts` | Performs administrator-only, transactional, audited individual booking confirmation; enforces complete dimensions, workspace consistency, and locked-ledger protection. | Provides the mutation-service pattern: validate actor and workspace, load exact records in the transaction, reject unsafe input, write audit evidence atomically, and expose typed domain errors. It must not be reused to create merchant knowledge because bookings and merchant identity are separate domains. |
| `server/services/auditLogService.ts` | Writes generic user-scoped audit records inside a supplied Prisma transaction. | The approved merchant design requires dedicated workspace-scoped `MerchantAuditEvent`; the generic audit helper is insufficient as the only merchant audit contract. |
| `server/routes/review.ts` | Authenticated review reads; administrator-only individual confirmation and rule actions; explicit transactional service calls. | Establishes route parsing, error translation, authenticated read/admin mutation separation, individual transaction IDs, and no-bulk policy. |
| `server/routes/rules.ts` | Authenticated list; admin-only transactional create/update/delete with audit. | Establishes settings-style CRUD conventions, but merchant identity mutations require stricter plan hashes, before/after evidence, rollback evidence, and conflict checks. |
| `server/routes/emailRecipients.ts` | Authenticated viewer-readable list; admin-only individual transactional mutation with audit. | Best current pattern for viewer read-only visibility plus administrator-only actions on a settings surface. |
| `src/app/api/review/route.ts` and `src/app/api/_express-adapter` | Thin Next route bridge to Express-style handlers. | Merchant routes should use the same Node runtime, force-dynamic read behavior, and adapter rather than introducing a second API architecture. |
| `src/ui/FinanceReviewPage.tsx` | Responsive compact individual transaction review, expandable evidence, inline fields, viewer-disabled controls, no bulk confirmation. | Supplies row density, evidence disclosure, mobile labels, warning text, and individual-action patterns. Merchant maintenance must not be embedded here as a second mutation workflow. |
| `src/ui/FinanceSettingsPage.tsx` | Settings/admin panels with viewer-readable information and admin-gated mutations. | Supplies the closest navigation and page-family precedent for Merchant Knowledge administration. |
| `src/helpers/navigation.ts`, `src/ui/FinanceAppFrame.tsx` | Canonical navigation and responsive application shell. | A separately approved Merchant Knowledge route should appear under Settings, not as a new top-level finance workflow unless later user evidence requires it. |
| `src/components/ui/dialog.tsx`, `src/components/ui/sheet.tsx` | Radix accessible modal and sheet primitives. | Confirmation dialogs and mobile evidence sheets should reuse these primitives, but colors/copy must be aligned with the finance light theme in implementation. |
| `src/libs/api.ts` | Typed client DTOs and credentialed fetch helpers; explicitly states client role is not authorization. | New read/mutation DTOs belong here only after APIs exist; server authorization remains authoritative. |
| `tests/auth/adminMutationPolicy.test.ts` | Central guard that viewer requests cannot execute admin mutations. | Every future merchant mutation route must be added to this test. |
| `tests/services/reviewDecisionService.test.ts` | Transactional integrity, audit, locked-period, workspace, evidence-hash, no-bulk tests. | Supplies the required depth for merchant mutation-service tests, excluding booking-specific behavior. |
| `tests/routes/review.test.ts` | Authenticated viewer reads and admin mutation route behavior. | Supplies route test conventions for authentication, role, error, and no-side-effect evidence. |
| `tests/helpers/settingsPage.test.ts`, `tests/helpers/reviewUi.test.ts` | Dutch copy, formatting, read-only/disabled state, reliability, and option-validity helpers. | Future merchant helpers require equivalent Dutch text, accessible state, viewer behavior, warnings, and deterministic display tests. |

## Architecture decision: separate route under Settings

### Decision

Use a dedicated route:

```text
/settings/merchant-knowledge
```

with an entry from the existing Settings page. Do not embed merchant identity maintenance inside `/review`.

### Rationale

- `/review` is an accounting-review workflow whose individual confirmation creates booking truth.
- Merchant Knowledge maintenance changes reusable identity evidence, not the current transaction booking.
- Mixing both mutation domains in one row would make authorization, evidence, rollback, locked-period semantics, and user intent unclear.
- The Settings page already contains authenticated read/admin mutation panels.
- A dedicated route permits larger evidence and rollback views without increasing the vertical complexity of the 221-item review queue.

The review page may later show a read-only merchant label and a link to the administrator page, but it must not expose merge/split/deprecate mutations in the transaction row.

## Proposed navigation and page design

### Route hierarchy

```text
/settings
  → Merchantkennis
      → /settings/merchant-knowledge
```

Do not add a top-level navigation item in the first slice. The settings card should be visible to both roles:

- administrator: “Open beheer”;
- viewer: “Alleen-lezen bekijken”.

### Page structure

1. Summary cards:
   - known merchant coverage;
   - unresolved merchant conflicts;
   - proposed aliases;
   - correction-reuse opportunities;
   - retrieval-anchor readiness for the current benchmark.
2. Paginated compact table/list:
   - merchant name/status;
   - alias/fingerprint counts;
   - unresolved conflict count;
   - affected transaction count;
   - evidence strength;
   - last administrator decision;
   - individual “Inspecteren” action.
3. Filters:
   - status;
   - conflict state;
   - signal type;
   - known/new merchant;
   - correction-reuse opportunity;
   - transaction reference search where privacy-safe.
4. Evidence sheet/dialog:
   - immutable source facts through masked/redacted references;
   - supporting and conflicting signals;
   - extraction/resolution/plan versions;
   - evidence hashes;
   - affected alias and fingerprint IDs;
   - before/after snapshots;
   - rollback plan.
5. Individual confirmation dialog for one plan only.

No checkbox selection, multi-select, “apply all”, “merge selected”, bulk approval, or bulk deprecation may exist.

## Proposed API contracts

These are approved conceptual contracts only. Exact route names remain subject to source verification when implementation begins.

### Authenticated reads

```text
GET /api/merchant-knowledge/summary
GET /api/merchant-knowledge/merchants?page=1&pageSize=25&status=&conflictState=&signalType=&query=
GET /api/merchant-knowledge/merchants/:merchantId
GET /api/merchant-knowledge/conflicts/:conflictId
GET /api/merchant-knowledge/plans/:planHash
```

Read responses must:

- be workspace-scoped from server request context;
- return no raw unrestricted alias examples;
- use masked IBANs and redacted evidence-safe samples;
- include versions and evidence hashes;
- explicitly state `createsTransactionBooking: false` and `mutatesBankFacts: false`;
- allow viewer access in read-only mode.

### Administrator-only plan preview

```text
POST /api/merchant-knowledge/plans/preview
```

Input:

- one action;
- explicit workspace-derived entity IDs;
- actor intent;
- reason;
- explicit affected alias/fingerprint IDs;
- current evidence hashes and versions;
- idempotency/request key.

Output:

- deterministic plan hash;
- blocking errors and warnings;
- before/after state;
- supporting/conflicting evidence;
- rollback plan;
- `administratorConfirmationRequired: true`;
- no writes.

### Administrator-only individual confirmation

```text
POST /api/merchant-knowledge/plans/:planHash/confirm
```

Input:

- exact plan hash;
- request/idempotency key;
- non-empty reason;
- expected entity versions/evidence hashes;
- one explicit action only.

The server must recompute or revalidate the plan inside the transaction. A stale plan must return a conflict response and make no changes.

### Explicit exclusions

No bulk endpoint may exist. Do not create endpoints such as:

```text
POST /api/merchant-knowledge/bulk
POST /api/merchant-knowledge/merge-selected
POST /api/merchant-knowledge/approve-all
```

## Proposed service boundaries

### `merchantKnowledgeQueryService`

Authenticated, workspace-scoped read model for summary, merchants, aliases, conflicts, and plan evidence. It must redact private source values and never write.

### `merchantIdentityPlanService`

The existing pure Phase 3.5 planner remains the authoritative deterministic plan builder. It does not authorize, query, write, or generate IDs.

### `merchantKnowledgeDecisionService`

Future dedicated transactional mutation service. Responsibilities:

1. assert administrator actor;
2. resolve workspace from request context, never request body authority;
3. load every referenced merchant, alias, fingerprint, conflict, and decision in the same workspace;
4. verify active/current status and versions;
5. rebuild/revalidate the Phase 3.5 plan;
6. reject blocking errors, collisions, stale hashes, and cross-workspace references;
7. apply exactly one approved plan;
8. write dedicated workspace-scoped merchant decision and audit events atomically;
9. return the updated read model and rollback reference;
10. never update `Transaction`, `TransactionBooking`, `CategorizationSuggestion`, or `ReviewDecision`.

### `merchantKnowledgeAuditService`

Future append-only writer for the approved `MerchantAuditEvent` contract. The generic `AuditLog` may receive an optional high-level compatibility event only if separately approved, but it cannot replace merchant-domain audit history.

## Authorization matrix

| Capability | Administrator | Viewer |
|---|---:|---:|
| View summary and merchant list | allowed | allowed, read-only |
| View aliases, fingerprints, conflicts, evidence, versions, and rollback preview | allowed | allowed, read-only with privacy redaction |
| Preview a plan | allowed | forbidden (`403`) |
| Confirm merge | allowed individually | forbidden (`403`) |
| Confirm split | allowed individually | forbidden (`403`) |
| Reassign alias/fingerprint | allowed individually | forbidden (`403`) |
| Resolve/dismiss conflict | allowed individually | forbidden (`403`) |
| Deprecate alias/merchant | allowed individually | forbidden (`403`) |
| Bulk mutation | prohibited | prohibited |
| Create/rewrite a booking | prohibited through merchant tooling | prohibited |

Client controls must be disabled or hidden for viewers, but server `requireAdmin` remains authoritative.

## Individual mutation workflow

1. User opens one merchant/conflict detail.
2. Server returns current redacted evidence and versions.
3. Administrator chooses one explicit action and affected record IDs.
4. Client requests a plan preview.
5. Server returns deterministic plan hash, warnings, blocking errors, before/after state, evidence, and rollback.
6. Client opens an accessible confirmation dialog.
7. Administrator enters or confirms a non-empty reason.
8. Client submits the exact plan hash and expected versions.
9. Server starts one Prisma transaction, reloads all records within the actor workspace, and revalidates the plan.
10. On any stale/conflicting evidence, the transaction aborts with no write.
11. On success, the service applies one plan and writes decision/audit records atomically.
12. Client refreshes the affected detail, summary counts, and current page.

The dialog must never default the destructive action. Cancel is the initial safe focus target where the component permits it.

## Audit and provenance requirements

Every confirmed action must preserve:

- workspace ID;
- actor ID and display-safe actor reference;
- request/idempotency key;
- action and reason;
- plan, engine, extraction, resolution, and evidence versions;
- plan hash and evidence hash;
- before and after snapshots;
- source/target merchant IDs;
- affected alias/fingerprint IDs;
- supporting and conflicting evidence;
- blocking/warning state observed at confirmation;
- rollback plan/reference;
- timestamp generated by persistence at commit time;
- no-booking and no-bank-fact side-effect declarations.

Historical merchant resolution, booking, review, and raw transaction evidence must not be rewritten.

## Locked-period decision

Locked accounting periods protect financial booking changes. Merchant Knowledge maintenance is a separate knowledge-domain operation and may be allowed for evidence linked to a locked period **only when it does not modify any booking, transaction classification, ledger, report snapshot, or period state**.

Required implementation rule:

- merchant-only plan: locked period does not automatically block the knowledge action;
- any attempted financial mutation: reject and route the user through the existing locked-period accounting workflow;
- UI must state that merchant maintenance improves future matching and does not change historical booked accounting.

## Evidence and rollback presentation

The confirmation view must show, before the final button:

- action label in Dutch;
- source and target merchants;
- every affected alias/fingerprint ID and evidence-safe label;
- masked/redacted source facts;
- supporting and conflicting evidence in separate labeled sections;
- before and after ownership/status tables;
- warnings and blocking errors with text and icons, not color alone;
- plan/evidence versions and short hashes;
- rollback steps;
- explicit statement: “Deze actie wijzigt geen boeking of banktransactie.”

Rollback is not a generic browser undo. A reversal must be a new individually confirmed, audited plan referencing the prior decision. The original audit event remains immutable.

## Responsive and accessibility requirements

- Desktop: compact table with persistent headers and row-level inspect action.
- Below desktop breakpoint: table-like cards with visible field labels.
- Evidence details: side sheet on mobile; dialog or wider sheet on desktop.
- Confirmation action: full-width and reachable on mobile.
- No horizontal clipping that hides warnings or confirmation.
- Radix `Dialog`/`Sheet` semantics, focus trapping, Escape handling, labelled title/description, and visible focus rings.
- All state badges include text; color is supplemental.
- Warnings use `role="alert"` or an equivalent announced region where appropriate.
- Loading and mutation states set `aria-busy` and disable duplicate submission.
- Destructive actions use explicit Dutch verbs such as `Merchant samenvoegen`, `Merchant splitsen`, or `Alias deprecëren`; never generic `Opslaan` alone.
- Viewer state must be understandable without relying solely on disabled styling.

## Safe-disable and rollback strategy

### Exposure control

Use one server-authoritative feature flag, proposed name:

```text
MERCHANT_KNOWLEDGE_ADMIN_ENABLED
```

Requirements:

- default `false` until schema, migrations, services, authorization, tests, and production verification pass;
- server read and mutation routes return a clear unavailable response when disabled;
- client navigation card is hidden or marked unavailable based on a server-provided capability, not a public environment variable alone;
- disabling the flag stops all merchant tooling without affecting `/review`, booking, imports, reports, or current retrieval behavior.

### Rollback

- UI/API slice rollback: disable the feature flag and revert the application commit.
- Mutation rollback: create a new validated reversal plan from persisted audit/decision evidence.
- Schema rollback: not part of Phase 3.8; additive merchant tables remain safely unused if tooling is disabled.
- Never delete audit history to simulate rollback.

## Smallest coherent implementation slices

### Slice 3.8A — Read-only capability and source contracts

Objective: expose an authenticated, workspace-scoped, feature-disabled-by-default read-only merchant summary/detail contract after persistence exists.

Anticipated areas, subject to exact source verification:

- server feature/capability helper;
- `server/services/merchantKnowledgeQueryService.ts`;
- `server/routes/merchantKnowledge.ts` read handlers;
- thin `src/app/api/merchant-knowledge/**/route.ts` bridges;
- typed DTOs and fetchers in `src/libs/api.ts`;
- focused query, route, authorization, privacy-redaction, and no-side-effect tests.

No mutation, UI route, navigation, or booking behavior.

### Slice 3.8B — Read-only administrator page

Objective: render the summary/list/detail/evidence workflow for both roles, with viewer read-only labeling.

Anticipated areas:

- `src/app/settings/merchant-knowledge/page.tsx`;
- `src/ui/FinanceMerchantKnowledgePage.tsx`;
- focused helpers;
- one Settings-page navigation card;
- responsive/accessibility/helper tests.

No mutation buttons until Slice 3.8C is separately approved.

### Slice 3.8C — Plan preview

Objective: expose administrator-only preview of one Phase 3.5 plan with no writes.

Requires:

- `requireAdmin`;
- exact IDs and reason;
- full workspace query scope;
- deterministic plan hash;
- stale/collision/blocking evidence;
- route/service/admin-policy tests.

### Slice 3.8D — Individual transactional confirmation

Objective: apply one revalidated plan atomically and audit it.

Requires completed Merchant Knowledge schema/migrations and dedicated transaction/audit services. This slice must be split further by action if the mutation surface cannot be proven safely in one bounded packet.

### Slice 3.8E — Production acceptance and rollback rehearsal

Objective: verify administrator/viewer behavior, desktop/mobile accessibility, individual mutation, stale-plan rejection, audit evidence, feature disablement, and absence of booking side effects in an approved authenticated environment.

## Exact anticipated files

Likely future additions or changes, subject to source verification:

- `server/services/merchantKnowledgeQueryService.ts`
- `server/services/merchantKnowledgeDecisionService.ts`
- `server/services/merchantKnowledgeAuditService.ts`
- `server/routes/merchantKnowledge.ts`
- `src/app/api/merchant-knowledge/route.ts`
- additional item/plan route bridges under `src/app/api/merchant-knowledge/`
- `src/app/settings/merchant-knowledge/page.tsx`
- `src/ui/FinanceMerchantKnowledgePage.tsx`
- `src/helpers/merchant-knowledge-ui.ts`
- `src/libs/api.ts`
- `src/ui/FinanceSettingsPage.tsx`
- targeted tests under `tests/services`, `tests/routes`, `tests/auth`, and `tests/helpers`

The exact Prisma models and migrations remain governed by `docs/MERCHANT_KNOWLEDGE_SCHEMA_PROPOSAL.md` and must be implemented before mutation slices.

## Targeted validation plan

### Query/read contract

- workspace isolation for every query;
- viewer and administrator authenticated reads;
- privacy redaction and masked IBANs;
- feature-disabled behavior;
- pagination, filters, ordering, and empty states;
- no database writes and no financial side effects.

### Mutation authorization

- viewer receives Dutch `403` for every preview/confirm route;
- missing/invalid session receives `401`;
- all mutations appear in `tests/auth/adminMutationPolicy.test.ts`;
- client role hints cannot authorize requests.

### Transactional integrity

- exact one-plan transaction;
- stale plan/evidence/version rejection;
- cross-workspace rejection;
- collision/cycle/split-partition rejection;
- before/after/audit/rollback evidence in the same transaction;
- transaction, booking, review, suggestion, ledger, period, and report tables unchanged;
- duplicate idempotency key does not duplicate a decision.

### UI/accessibility

- administrator versus viewer controls;
- no bulk action;
- evidence and rollback visible before confirmation;
- dialog/sheet title, description, focus behavior, keyboard cancel, and duplicate-submit blocking;
- mobile labels and full-width confirm action;
- no color-only meaning;
- Dutch copy and error states.

### Repository validation

- focused route/service/auth/helper tests;
- affected TypeScript build;
- full production build;
- exact diff review;
- secret-material scan;
- approved browser acceptance for desktop and mobile once an authenticated environment exists.

## Blockers and dependencies

Phase 3.8 mutation code is blocked until:

1. the approved Merchant Knowledge Prisma schema and additive migration are implemented and replay-validated;
2. dedicated workspace-scoped merchant audit persistence exists;
3. persisted merchants, aliases, fingerprints, conflicts, resolutions, and decisions exist;
4. query contracts can prove workspace isolation and privacy redaction;
5. administrator capability/feature-flag behavior is approved;
6. action-by-action transactional service contracts and idempotency are approved;
7. rollback is represented as a new audited reversal, not destructive history editing;
8. server-side role enforcement is included in the central admin mutation policy tests;
9. no-booking/no-bank-fact assertions are executable in service tests;
10. an approved authenticated browser environment is available for final acceptance.

## Criteria before any Phase 3.8 application code

The first implementation packet may begin only when all of the following are true:

- repository HEAD and worktree are verified;
- this design remains `APPROVED` and current;
- the exact packet is limited to Slice 3.8A read-only capability/query contracts;
- Merchant Knowledge persistence required by that read contract exists or the packet is explicitly limited to typed in-memory fixtures and no production route;
- server feature flag defaults to disabled;
- exact query/service/route/test paths are verified;
- viewer/admin behavior is explicit;
- privacy redaction is specified;
- no mutation endpoint is included;
- no application code can create a booking or trusted alias;
- targeted tests, build, diff review, scan, handoff, commit restriction, and no-push rule are specified.

If persistence is still absent, the next executable task is not UI. It is the separately approved additive schema/migration implementation from Program Phase 3.2, followed by read-only query services.
