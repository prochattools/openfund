# Yeshua Academy Finance — Financial Domain Model Proposal

Status: approved after owner review; documentation only; ready for commit  
Task: `MODEL-001`  
Depends on: `docs/PHILOSOPHY.md`, `docs/STRATEGY.md`, `docs/ROADMAP.md`  
Schema state: no Prisma schema or migration change has been made

## Purpose

This proposal defines the smallest explicit financial domain needed to implement the confirmed Yeshua Academy workflow safely. It replaces implicit state in category fields and raw JSON with auditable records for source files, bank statements, classifications, review decisions, period closes, reports, and dispatches.

The model is not a generic bookkeeping schema. It supports cash-basis ING imports, the exact historical `Klant` / `Type` / `Category` method, administrator review, exact reconciliation, frozen reporting, and Dutch user-facing workflows.

## Non-negotiable invariants

1. Imported bank facts are immutable after acceptance.
2. Money is stored as non-negative absolute integer euro cents (`BigInt`); `direction` alone determines cash-flow sign.
3. Original uploaded files are retained byte-identically, hashed, and downloadable.
4. Historical 2024 and 2025 labels are stored and reproduced exactly.
5. Every final booking has exactly one `Klant`, one `Type`, and one `Category`.
6. A suggestion is never a final booking.
7. Only an approved deterministic rule or a complete raw historical replay may create a final automatic booking.
8. Fuzzy, normalized fallback, popularity, amount-only, and heuristic matches remain suggestions.
9. A period cannot close while any transaction is unresolved or any control difference is non-zero.
10. A report is generated from a frozen close snapshot, not from mutable live transactions.
11. Sending requires a separate administrator approval after close.
12. Reopening never deletes a prior close; it supersedes it with an audited reason.
13. Generic `AuditLog` supports investigation but is not the only source of truth for financial decisions.
14. Financial records belong to a `FinanceWorkspace`; human identities and roles are separate actor and membership data.

## Aggregate boundaries

The design has five main aggregates:

1. **Source and statement** — original file, import attempt, statement facts, immutable transactions.
2. **Classification** — exact dimensions, deterministic rules, suggestions, final booking, review decisions.
3. **Period close** — reconciliation controls and immutable close versions.
4. **Reporting** — frozen report snapshot, report lines, generated artifacts.
5. **Distribution and access** — report approval, dispatch, recipients, roles, audit records.

## 1. Financial ownership, users, and actors

Financial data belongs to a shared workspace. Human identities act within that workspace through explicit memberships. A person’s identity is never used as the financial ownership boundary.

### `FinanceWorkspace`

The stable owner of the Yeshua Academy administration.

Fields:

- `id: String` — primary key.
- `name: String` — default display name `Yeshua Academy`.
- `slug: String` — unique stable identifier.
- `defaultCurrency: String` — default `EUR`.
- `isActive: Boolean` — default `true`.
- `createdAt: DateTime`.
- `updatedAt: DateTime`.

Rules:

- Accounts, ledgers, dimensions, files, statements, transactions, rules, reports, and recipients are scoped to one `FinanceWorkspace`.
- A workspace remains stable when administrators or viewers change.
- The current request-level `userId` financial scope must migrate to an explicit `workspaceId`; it must not be interpreted as the actor’s identity.

### `User`

Human login identity only.

Fields:

- `id: String` — primary key.
- `email: String` — unique login identity.
- `isActive: Boolean` — default `true`.
- `createdAt: DateTime`.
- `updatedAt: DateTime`.

### `WorkspaceMembership`

Connects a human identity to a financial workspace.

Fields:

- `id: String`.
- `workspaceId: String`.
- `userId: String`.
- `role: WorkspaceRole` — `ADMIN` or `VIEWER`.
- `isActive: Boolean` — default `true`.
- `createdAt: DateTime`.
- `updatedAt: DateTime`.

Constraints:

- Unique `(workspaceId, userId)`.

Rules:

- `ADMIN` may import, classify, approve, manage rules, close, reopen, approve reports, and send.
- `VIEWER` may only read financial data and download permitted files.
- Every mutating action records both `workspaceId` and the acting `userId` or actor snapshot.
- Authorization is enforced server-side from an active membership, never from a client-supplied role alone.

## 2. Exact classification dimensions

Internal model names may remain English. All UI labels and values are shown in Dutch or exactly as historically supplied.

### `Project` — user label: `Klant`

Fields:

- `id: String` — primary key.
- `workspaceId: String` — financial ownership boundary.
- `code: String` — exact short value used in the administration, for example `FTK`, `FR`, `WLJ`, `YA`, `VS`, or `Algemeen`.
- `name: String` — official full name where known.
- `isActive: Boolean` — whether administrators may select it for new bookings.
- `isHistorical: Boolean` — identifies values created from concluded history.
- `createdAt: DateTime`.
- `updatedAt: DateTime`.

Constraints:

- Unique `(workspaceId, code)` with case-sensitive comparison.
- Historical values are never renamed or merged.

Confirmed values:

- `FTK` — For the King
- `FR` — Fellowship Renswoude
- `WLJ` — Walk Like Jesus
- `YA` — Yeshua Academy
- `VS` — Vila Solidária

Historical rule:

- Preserve all 2024 `FR` data unchanged.
- In 2025, the first literal `FTK` transaction is the practical transition point.

### `TransactionType` — user label: `Type`

Fields:

- `id: String`.
- `workspaceId: String` — financial ownership boundary.
- `literalName: String` — exact wording, spelling, and capitalization.
- `isActive: Boolean`.
- `isHistorical: Boolean`.
- `sortOrder: Int?` — presentation only.
- `createdAt: DateTime`.
- `updatedAt: DateTime`.

Constraints:

- Unique `(workspaceId, literalName)` with case-sensitive comparison.
- No canonical replacement field is used to rewrite historical reports.

### `Category` — user label: `Categorie`

Fields:

- `id: String`.
- `workspaceId: String` — financial ownership boundary.
- `literalName: String` — exact wording, spelling, capitalization, and any deliberate `in` / `uit` distinction.
- `isActive: Boolean`.
- `isHistorical: Boolean`.
- `sortOrder: Int?`.
- `createdAt: DateTime`.
- `updatedAt: DateTime`.

Constraints:

- Unique `(workspaceId, literalName)` with case-sensitive comparison.
- Historical categories are immutable.
- Direction remains a separate bank fact even when the literal category contains `in` or `uit`.

### Optional future interpretation metadata

If reporting later needs grouping such as operating, transfer, savings, deposit, refund, reversal, or restricted-purpose, add separate interpretation metadata. It must never replace `literalName` or change historical output.

Proposed future fields on a separate `CategoryInterpretation` record:

- `categoryId`.
- `reportingClass`.
- `restrictedPurpose: Boolean`.
- `notes`.
- `approvedBy`.
- `approvedAt`.

This record is not required for the first schema migration.

## 3. Original files and import attempts

### `SourceFile`

Immutable original file storage.

Fields:

- `id: String`.
- `workspaceId: String` — financial ownership boundary.
- `kind: SourceFileKind` — initially `BANK_EXPORT_CSV`, `BANK_STATEMENT_PDF`, or `HISTORICAL_WORKBOOK_XLSX`.
- `originalFilename: String`.
- `mediaType: String`.
- `sizeBytes: Int`.
- `sha256: String`.
- `content: Bytes`.
- `uploadedBy: String?`.
- `uploadedAt: DateTime`.

Constraints:

- Unique `(workspaceId, sha256)`.
- `content`, `sha256`, `sizeBytes`, and `originalFilename` are immutable.
- Download response includes the stored hash.

### `ImportBatch`

Technical parse/import attempt. Evolve the existing model instead of duplicating it.

Fields:

- `id: String`.
- `workspaceId: String` — financial ownership boundary.
- `sourceFileId: String`.
- `initiatedBy: String?` — actor identity snapshot or relation.
- `status: ImportBatchStatus` — `PREVIEW`, `IMPORTED`, `REJECTED`, or `FAILED`.
- `parserName: String`.
- `parserVersion: String`.
- `totalRows: Int`.
- `importedRows: Int`.
- `duplicateRows: Int`.
- `errorRows: Int`.
- `finalAutoBookedRows: Int`.
- `reviewRows: Int`.
- `errorSummary: Json?`.
- `startedAt: DateTime`.
- `completedAt: DateTime?`.
- `createdAt: DateTime`.
- `updatedAt: DateTime`.

Rules:

- A preview may parse and validate without creating accepted transactions.
- An imported batch references one accepted bank statement.
- Counts distinguish final automatic bookings from suggestions.

## 4. Bank statements and immutable transactions

### `BankStatement`

One accepted statement or historical source period for one bank account.

Fields:

- `id: String`.
- `workspaceId: String` — financial ownership boundary.
- `accountId: String`.
- `sourceFileId: String` — original authoritative export.
- `supportingPdfFileId: String?` — optional matching bank statement PDF.
- `importBatchId: String`.
- `periodStart: DateTime`.
- `periodEnd: DateTime`.
- `coverageStatus: StatementCoverageStatus` — `COMPLETE` or `PARTIAL`.
- `currency: String` — default `EUR`.
- `openingBalanceMinor: BigInt`.
- `incomeMinor: BigInt`.
- `expenseMinor: BigInt`.
- `netMinor: BigInt`.
- `closingBalanceMinor: BigInt`.
- `transactionCount: Int`.
- `bankAccountIdentifier: String`.
- `acceptedBy: String?`.
- `acceptedAt: DateTime?`.
- `createdAt: DateTime`.

Constraints:

- One authoritative statement per accepted `sourceFileId`.
- `opening + income - expense = closing` must be exact before acceptance.
- `net = income - expense`.
- Overlapping accepted statements for the same account require explicit duplicate/overlap resolution.
- A `PARTIAL` statement cannot close its incomplete month.

### `StatementPeriod`

One account-specific calendar period contained in an accepted bank statement. This is the reconciliation and close boundary, even when one source file spans several months.

Fields:

- `id: String`.
- `workspaceId: String` — financial ownership boundary.
- `statementId: String`.
- `accountId: String`.
- `periodStart: DateTime` — inclusive first calendar day.
- `periodEnd: DateTime` — inclusive last covered day.
- `coverageStatus: StatementCoverageStatus` — `COMPLETE` or `PARTIAL` for this exact period.
- `openingBalanceMinor: BigInt`.
- `incomeMinor: BigInt`.
- `expenseMinor: BigInt`.
- `netMinor: BigInt`.
- `closingBalanceMinor: BigInt`.
- `transactionCount: Int`.
- `createdAt: DateTime`.

Constraints:

- Unique `(statementId, accountId, periodStart, periodEnd)`.
- A transaction belongs to exactly one `StatementPeriod` based on account and booking date.
- `opening + income - expense = closing` and `net = income - expense` must hold exactly for the period.
- `COMPLETE` requires full calendar coverage and an authoritative closing balance for the exact period end.
- `PARTIAL` remains reviewable and reportable as open data but cannot produce a balanced close.
- For the supplied 2026 statement, January through June may become complete periods after exact validation; July remains `PARTIAL` because the source ends on July 1.

### `Transaction`

Immutable bank/source facts only.

Fields:

- `id: String`.
- `workspaceId: String` — financial ownership boundary.
- `statementId: String`.
- `statementPeriodId: String`.
- `accountId: String`.
- `sourceRowNumber: Int`.
- `date: DateTime`.
- `description: String`.
- `normalizedDescription: String`.
- `paymentPurpose: String?`.
- `normalizedPaymentPurpose: String`.
- `counterparty: String?`.
- `reference: String?`.
- `sourceCode: String?`.
- `transactionType: String?` — original ING value.
- `amountMinor: BigInt` — non-negative absolute euro cents.
- `direction: TransactionDirection` — `CREDIT` or `DEBIT`; this field alone determines the sign of cash movement.
- `resultingBalanceMinor: BigInt?`.
- `currency: String`.
- `sourceRowHash: String`.
- `importFingerprint: String`.
- `rawRow: Json` — exact parsed source columns.
- `createdAt: DateTime`.

Constraints:

- Unique `(statementId, sourceRowNumber)`.
- Unique `(workspaceId, importFingerprint)`.
- Source facts cannot be edited after statement acceptance.
- Classification fields do not live directly on this immutable source record in the target model.

## 5. Final bookings, suggestions, rules, and review decisions

### `TransactionBooking`

The current final classification for one transaction.

Fields:

- `id: String`.
- `transactionId: String` — unique one-to-one relation.
- `projectId: String`.
- `transactionTypeId: String`.
- `categoryId: String`.
- `source: BookingSource` — `HISTORICAL`, `RULE`, or `MANUAL`.
- `ruleId: String?`.
- `historicalSourceTransactionId: String?` — exact previously confirmed transaction authorizing a historical replay.
- `historicalMatchKey: String?` — complete raw historical replay key used for the decision.
- `evidence: Json` — immutable matched source fields, rule version, or manual decision context.
- `evidenceHash: String` — hash of the canonical booking evidence.
- `confirmedBy: String?`.
- `confirmedAt: DateTime`.
- `literalProjectLabel: String`.
- `literalTypeLabel: String`.
- `literalCategoryLabel: String`.
- `createdAt: DateTime`.
- `updatedAt: DateTime`.

Rules:

- Absence of a booking means the transaction is unresolved.
- All three dimension IDs are required.
- Literal snapshots preserve reporting wording even if selectable metadata changes later.
- `RULE` requires an active approved rule, its exact `ruleId`, the applied rule version in `evidence`, and a matching `evidenceHash`.
- `HISTORICAL` requires `historicalSourceTransactionId`, `historicalMatchKey`, immutable matched-field evidence, and a matching `evidenceHash` for a complete raw replay of a previously confirmed booking.
- `MANUAL` requires an administrator decision and immutable decision context in `evidence`.
- Source-specific provenance fields are validated in the same database transaction that creates or changes the booking.

### `CategorizationSuggestion`

Append-only proposed classification evidence.

Fields:

- `id: String`.
- `transactionId: String`.
- `projectId: String?`.
- `transactionTypeId: String?`.
- `categoryId: String?`.
- `confidence: SuggestionConfidence` — `EXACT_FALLBACK`, `FUZZY`, `OVERALL`, or `DEFAULT`.
- `matcher: SuggestionMatcher` — identifies exact normalized fallback, fuzzy history, best-history score, or direction default.
- `rank: Int`.
- `scoreBasisPoints: Int?` — optional 0–10000 representation; no floating-point persistence.
- `evidence: Json` — matched fields, compared transaction/rule IDs, and competing candidates.
- `status: SuggestionStatus` — `PENDING`, `ACCEPTED`, `REJECTED`, or `EXPIRED`.
- `createdAt: DateTime`.
- `resolvedAt: DateTime?`.

Rules:

- Suggestions never populate `TransactionBooking` without a review decision.
- Competing categories remain visible.
- A stronger suggestion is not overwritten by a weaker one; suggestions are ranked records, not one mutable JSON object.

### `CategorizationRule`

Replace the single-category JSON-condition target with an approved three-dimension rule.

Fields:

- `id: String`.
- `workspaceId: String` — financial ownership boundary.
- `label: String`.
- `projectId: String`.
- `transactionTypeId: String`.
- `categoryId: String`.
- `direction: TransactionDirection` — required.
- `status: RuleStatus` — `DRAFT`, `ACTIVE`, or `DISABLED`.
- `priority: Int`.
- `version: Int`.
- `createdBy: String`.
- `createdAt: DateTime`.
- `approvedBy: String?`.
- `approvedAt: DateTime?`.
- `disabledBy: String?`.
- `disabledAt: DateTime?`.
- `lastMatchedAt: DateTime?`.

### `CategorizationRuleCondition`

Fields:

- `id: String`.
- `ruleId: String`.
- `field: RuleConditionField` — `COUNTERPARTY`, `PAYMENT_PURPOSE`, `DESCRIPTION`, `REFERENCE`, `SOURCE`, or `AMOUNT_MINOR`.
- `operator: RuleConditionOperator` — `EQUALS`, `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, or approved bounded `REGEX`.
- `stringValue: String?`.
- `amountMinor: BigInt?`.
- `sortOrder: Int`.

Rules:

- Direction is always required on the rule.
- At least one strong identifying condition is required.
- Counterparty alone, amount alone, description alone, or popularity cannot activate a rule.
- Ambiguous rules that match competing historical categories are rejected before activation.

### `ReviewDecision`

Append-only administrator decision history.

Fields:

- `id: String`.
- `transactionId: String`.
- `suggestionId: String?`.
- `action: ReviewDecisionAction` — `ACCEPT_SUGGESTION`, `ASSIGN_MANUALLY`, `CHANGE_BOOKING`, or `REMOVE_BOOKING`.
- `beforeProjectId: String?`.
- `beforeTypeId: String?`.
- `beforeCategoryId: String?`.
- `afterProjectId: String?`.
- `afterTypeId: String?`.
- `afterCategoryId: String?`.
- `actorId: String`.
- `actorEmail: String?`.
- `reason: String?`.
- `decidedAt: DateTime`.

Rules:

- The decision and `TransactionBooking` update occur in one database transaction.
- A locked period cannot be changed without an audited reopen.
- Remove the current broad `clearReviewQueue` behavior; there is no bulk conversion of suggestions to manual truth.

## 6. Reconciliation and period close

### `StatementReconciliation`

Append-only validation result for one exact account and statement period. A whole-file reconciliation never authorizes a monthly close when the source spans multiple months.

Fields:

- `id: String`.
- `workspaceId: String` — financial ownership boundary.
- `statementId: String`.
- `statementPeriodId: String`.
- `accountId: String`.
- `periodStart: DateTime`.
- `periodEnd: DateTime`.
- `checkedAt: DateTime`.
- `checkedBy: String?`.
- `openingBalanceMinor: BigInt`.
- `computedIncomeMinor: BigInt`.
- `computedExpenseMinor: BigInt`.
- `computedNetMinor: BigInt`.
- `computedClosingBalanceMinor: BigInt`.
- `bankClosingBalanceMinor: BigInt`.
- `balanceDifferenceMinor: BigInt`.
- `transactionCount: Int`.
- `bookedTransactionCount: Int`.
- `unresolvedTransactionCount: Int`.
- `categoryIncomeDifferenceMinor: BigInt`.
- `categoryExpenseDifferenceMinor: BigInt`.
- `runningBalanceErrorCount: Int`.
- `status: ReconciliationStatus` — `BALANCED`, `UNBALANCED`, or `INCOMPLETE`.
- `validatorVersion: String`.

Constraints:

- `workspaceId`, `statementId`, `accountId`, `periodStart`, and `periodEnd` must exactly match the referenced `StatementPeriod`.
- `BALANCED` requires the referenced `StatementPeriod.coverageStatus` to be `COMPLETE`.
- `BALANCED` requires zero unresolved transactions, equal booked and source transaction counts, zero balance and category differences, and zero running-balance errors.
- A reconciliation for the partial July 2026 period must remain `INCOMPLETE` and cannot authorize a close.

### `PeriodClose`

Immutable versioned close record.

Fields:

- `id: String`.
- `workspaceId: String` — financial ownership boundary.
- `ledgerId: String`.
- `statementId: String`.
- `statementPeriodId: String`.
- `reconciliationId: String`.
- `version: Int`.
- `status: PeriodCloseStatus` — `CLOSED`, `REOPENED`, or `SUPERSEDED`.
- `periodStart: DateTime`.
- `periodEnd: DateTime`.
- `openingBalanceMinor: BigInt`.
- `incomeMinor: BigInt`.
- `expenseMinor: BigInt`.
- `netMinor: BigInt`.
- `closingBalanceMinor: BigInt`.
- `transactionCount: Int`.
- `classificationHash: String`.
- `sourceDataHash: String`.
- `closedBy: String`.
- `closedAt: DateTime`.
- `reopenedBy: String?`.
- `reopenedAt: DateTime?`.
- `reopenReason: String?`.

Constraints:

- Unique `(ledgerId, version)`.
- The close, ledger, reconciliation, and `StatementPeriod` must share the same workspace, account, `periodStart`, and `periodEnd`.
- Close requires a `BALANCED` reconciliation with zero unresolved transactions and all differences equal to zero.
- The referenced `StatementPeriod.coverageStatus` must be `COMPLETE`; a partial period cannot close.
- Reopening marks the old close `REOPENED`; a later close creates a new version.
- Previous close records remain immutable and auditable.

`Ledger` should expose an optional `activePeriodCloseId` instead of relying only on mutable `lockedAt` fields.

## 7. Frozen reports and artifacts

### `ReportSnapshot`

Immutable report facts generated from closed periods.

Fields:

- `id: String`.
- `workspaceId: String` — financial ownership boundary.
- `kind: ReportKind` — `MONTHLY` or `YEARLY`.
- `year: Int`.
- `month: Int?`.
- `version: Int`.
- `openingBalanceMinor: BigInt`.
- `incomeMinor: BigInt`.
- `expenseMinor: BigInt`.
- `netMinor: BigInt`.
- `closingBalanceMinor: BigInt`.
- `transactionCount: Int`.
- `snapshotHash: String`.
- `generatedBy: String`.
- `generatedAt: DateTime`.

Relations:

- Monthly snapshot references exactly one `PeriodClose`.
- Yearly snapshot references all included monthly closes through `ReportSnapshotPeriodClose`.

### `ReportSnapshotPeriodClose`

Fields:

- `reportSnapshotId: String`.
- `periodCloseId: String`.
- `sortOrder: Int`.

Unique `(reportSnapshotId, periodCloseId)`.

### `ReportSnapshotLine`

Frozen breakdown line.

Fields:

- `id: String`.
- `reportSnapshotId: String`.
- `lineKind: ReportLineKind` — `PROJECT`, `TRANSACTION_TYPE`, `CATEGORY`, `REPORTING_CLASS`, or `TOTAL`.
- `projectId: String?`.
- `transactionTypeId: String?`.
- `categoryId: String?`.
- `literalProjectLabel: String?`.
- `literalTypeLabel: String?`.
- `literalCategoryLabel: String?`.
- `direction: TransactionDirection?`.
- `reportingClass: String?` — presentation metadata only.
- `amountMinor: BigInt`.
- `transactionCount: Int`.
- `sortOrder: Int`.

Rules:

- `PROJECT` requires only `projectId` and `literalProjectLabel` among the dimension fields.
- `TRANSACTION_TYPE` requires only `transactionTypeId` and `literalTypeLabel` among the dimension fields.
- `CATEGORY` requires only `categoryId` and `literalCategoryLabel` among the dimension fields.
- `REPORTING_CLASS` requires `reportingClass` and no dimension ID.
- `TOTAL` has no dimension ID or reporting class.
- Lines reproduce historical labels exactly.
- Sum of income lines equals snapshot income.
- Sum of expense lines equals snapshot expense.

### `ReportArtifact`

Generated immutable output.

Fields:

- `id: String`.
- `reportSnapshotId: String`.
- `format: ReportArtifactFormat` — `HTML`, `XLSX`, or `PDF`.
- `filename: String`.
- `mediaType: String`.
- `sizeBytes: Int`.
- `sha256: String`.
- `content: Bytes`.
- `generatedAt: DateTime`.

Constraints:

- Unique `(reportSnapshotId, format)`.
- All three artifacts derive from the same snapshot hash.
- Application-level completeness requires exactly one `HTML`, one `XLSX`, and one `PDF` artifact before report approval; database uniqueness alone is not treated as sufficient proof of completeness.

## 8. Separate approval and report dispatch

### `ReportApproval`

Represents the required final administrator click.

Fields:

- `id: String`.
- `reportSnapshotId: String`.
- `approvedBy: String`.
- `approvedAt: DateTime`.
- `snapshotHash: String`.
- `revokedBy: String?`.
- `revokedAt: DateTime?`.
- `revokeReason: String?`.

Rules:

- Approval is valid only while the referenced snapshot hash remains unchanged.
- Reopening an included period revokes the approval.

### `ReportDispatch`

One send attempt.

Fields:

- `id: String`.
- `reportSnapshotId: String`.
- `reportApprovalId: String`.
- `status: DispatchStatus` — `PENDING`, `SENT`, or `FAILED`.
- `fromAddress: String`.
- `subject: String`.
- `recipientHash: String`.
- `contentHash: String`.
- `providerMessageId: String?`.
- `sentBy: String`.
- `sentAt: DateTime?`.
- `errorMessage: String?`.
- `createdAt: DateTime`.

### `ReportDispatchRecipient`

Fields:

- `id: String`.
- `reportDispatchId: String`.
- `email: String`.
- `name: String?`.

Rules:

- Dispatch requires an active approval.
- Server loads HTML, XLSX, and PDF artifacts from the approved snapshot.
- Client-supplied arbitrary HTML or attachments are not accepted.

## 9. Existing models to retain or evolve

- `Account` — retain; replace actor-like `userId` ownership with required `workspaceId`, and require statement and transaction relations after migration.
- `OpeningBalance` — retain for initial continuity and audited adjustments; it inherits workspace scope through `Account`, and closed snapshots store the applied amount.
- `EmailRecipient` — retain as workspace-scoped administrator-managed defaults, but snapshot actual recipients in dispatch records.
- `AuditLog` — retain for generic actions; add required `workspaceId` while preserving separate actor fields. Specific decision/close/approval/dispatch models remain authoritative.
- `Ledger` — retain as a workspace-scoped monthly period container; replace actor-like `userId` ownership with `workspaceId` and replace mutable lock state with an active close relation after migration.

## 10. Relationships summary

```text
FinanceWorkspace 1─* WorkspaceMembership *─1 User
FinanceWorkspace 1─* Account
FinanceWorkspace 1─* Ledger
FinanceWorkspace 1─* Project
FinanceWorkspace 1─* TransactionType
FinanceWorkspace 1─* Category
FinanceWorkspace 1─* SourceFile
FinanceWorkspace 1─* ImportBatch
FinanceWorkspace 1─* CategorizationRule
FinanceWorkspace 1─* ReportSnapshot
FinanceWorkspace 1─* EmailRecipient
FinanceWorkspace 1─* AuditLog

Account 1─* BankStatement
SourceFile 1─0..1 BankStatement
ImportBatch 1─0..1 BankStatement
BankStatement 1─* StatementPeriod
StatementPeriod 1─* Transaction

Transaction 1─0..1 TransactionBooking
Transaction 1─* CategorizationSuggestion
Transaction 1─* ReviewDecision
Project 1─* TransactionBooking
TransactionType 1─* TransactionBooking
Category 1─* TransactionBooking
CategorizationRule 1─* CategorizationRuleCondition
CategorizationRule 1─* TransactionBooking
Transaction 1─* TransactionBooking as historical provenance source

StatementPeriod 1─* StatementReconciliation
Ledger 1─* PeriodClose
PeriodClose *─1 StatementReconciliation
PeriodClose *─1 StatementPeriod

ReportSnapshot *─* PeriodClose through ReportSnapshotPeriodClose
ReportSnapshot 1─* ReportSnapshotLine
ReportSnapshot 1─3 ReportArtifact
ReportSnapshot 1─* ReportApproval
ReportApproval 1─* ReportDispatch
ReportDispatch 1─* ReportDispatchRecipient
```

## 11. Migration sequence for later tasks

No migration is authorized by this proposal. The later implementation should proceed in this order:

1. Add `FinanceWorkspace` and `WorkspaceMembership`; backfill one Yeshua Academy workspace and map existing financial `userId` ownership to `workspaceId` without changing actor identities.
2. Add workspace-scoped dimension and evidence tables without removing current fields.
3. Backfill exact `Project`, `TransactionType`, and `Category` values from verified fixtures.
4. Backfill `TransactionBooking` with exact source-specific provenance for current confirmed, rule, manual, and historical classifications.
5. Move raw suggestion JSON into append-only `CategorizationSuggestion` records.
6. Add `SourceFile`, `BankStatement`, and monthly `StatementPeriod` relations while preserving current `ImportBatch.originalFile` bytes.
7. Backfill every transaction to exactly one statement period and verify period controls, including July 2026 as partial.
8. Add period-scoped reconciliation, close, snapshot, artifact, approval, and dispatch tables.
9. Update authorization, services, and APIs to use workspace membership and the new records.
10. Validate 2024, 2025, and 2026 financial fixtures exactly, including monthly coverage and close eligibility.
11. Only after complete validation, remove obsolete actor-like ownership fields, transaction classification columns, and mutable lock/report behavior in separate migrations.

## 12. Explicitly deferred design choices

These do not block the first domain migration:

- Canonical reporting aliases or category grouping beyond literal historical output.
- Additional banks or source formats.
- Accrual accounting, invoices, payroll, tax automation, budgets, or forecasts.
- External accountant access.
- Automated scheduled report sending.

Any such feature requires a philosophy and roadmap update first.

## MODEL-001 acceptance conclusion

This revised proposal satisfies the confirmed workflow while keeping the model lean:

- financial ownership belongs to one shared `FinanceWorkspace`, while human actors and roles are represented through memberships;
- transaction amounts are non-negative integer cents and `direction` alone determines cash-flow sign;
- exact source evidence is immutable;
- exact historical labels remain authoritative;
- every historical automatic booking records the exact source transaction, complete match key, immutable evidence, and evidence hash;
- suggestions, decisions, and final bookings are distinct;
- multi-month statements are divided into exact account-specific `StatementPeriod` records;
- reconciliation and close eligibility are period-scoped, and partial July 2026 cannot close;
- report lines have an explicit discriminator and artifact completeness requires HTML, XLSX, and PDF before approval;
- report approval and dispatch are separate audited actions;
- existing useful models are evolved rather than discarded;
- no schema or production change is included in this task.
