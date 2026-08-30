# Yeshua Academy Finance - Auth Readiness

Status: Clerk-only production email sign-in configured and verified; public sign-up and Google disabled
Date: 2026-08-30 (latest production verification)

Authentication implementation milestone: `f9e967f54632f86bad2ef3c5774334a48cda85ad`
(historical application commit). The August 2026 pre-import readiness release
was validated separately at
`3ac4b7f4adde5895aead98b4b0c93a6e8e74f32e`.
The running production build SHA is verified from the no-cache deployment-info
endpoint after each release; the normal GitHub Actions and Dokploy rollout is
the source of runtime truth.

## Goal

The app is private-only. Clerk is the only supported production identity
provider and is used for email sign-in and session verification only. `/sign-in`
is the canonical public authentication route. Public application sign-up is
disabled, `/sign-up` is unsupported, and Google/social sign-in is disabled.
The server maps a verified Clerk primary email to an active local `User` and
active `WorkspaceMembership`; the membership role is authoritative for
administrator/viewer authorization. A Clerk account alone never grants finance
access.

## Configuration

GitHub Actions build-time configuration must provide:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
```

The workflow validates that this is a non-empty `pk_live_` or `pk_test_`
value before Docker execution. The value is public and is passed only as the
Docker build argument needed by the browser bundle.

Dokploy production runtime configuration must provide:

```bash
AUTH_PROVIDER=clerk
NEXT_PUBLIC_AUTH_PROVIDER=clerk
ALLOW_PRODUCTION_AUTH_BYPASS=false
NEXT_PUBLIC_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_SIGN_UP_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-in
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<publishable-key>
CLERK_SECRET_KEY=<runtime-secret-key>
DEFAULT_WORKSPACE_ID=<finance-workspace-id>
```

`CLERK_SECRET_KEY` is runtime-only. It is never a GitHub build secret, Docker
build argument, image-layer value, public variable, or logged payload. The
workspace value must be the configured active finance workspace UUID; missing
or malformed values fail closed. The production finance workspace uses the
seeded UUID recorded in Dokploy because it is the one active workspace with
the active membership data.

Local development may explicitly use the server-side bypass:

```bash
AUTH_PROVIDER=disabled
NEXT_PUBLIC_AUTH_PROVIDER=disabled
DEFAULT_USER_ID=<local-user-id>
DEFAULT_WORKSPACE_ID=<finance-workspace-id>
```

`disabled` is local-only. Production always selects the statically imported
Clerk middleware. Missing or invalid runtime Clerk configuration fails closed
with a safe response. Ory is historical only and has been removed from the
production authentication path; no Ory cookie or generic cookie fallback
authenticates a request.

Provisioning requires the Clerk primary email to match an active local `User`
and an active `WorkspaceMembership` in the configured active finance
workspace. `ADMIN` memberships map to administrator access; other supported
active memberships map to viewer access. Unknown, inactive, or unprovisioned
users receive `403`.

## Authorization contract

1. API routes require a verified Clerk `__session` cookie and return `401`
   JSON when it is absent or invalid.
2. A verified identity without an active local user or workspace membership
   receives `403`.
3. Active `ADMIN` membership permits mutations; active `VIEWER` membership
   permits reads only.
4. Review, accounting, and evaluation reads never create financial records.
5. `/sign-in` is the only public authentication page; `/sign-up` is not a
   supported application route and redirects to `/sign-in`.
6. Client-supplied `x-user-id`, `x-user-role`, `x-actor-id`, and `x-user-email`
   headers are ignored.

The sign-in redirect accepts only internal single-slash paths. External,
protocol-relative, absolute, and malformed redirect targets fall back to
`/ledger`. Google remains disabled until separately configured production OAuth
credentials and verified redirect URIs are approved.

Administrators may import, review, categorize, send summaries, and manage
settings. Viewers may read dashboard, reports, ledger, review, accounting,
and evaluation data, but cannot submit mutations.

## Safety note

Do not make the app public. Do not use client identity headers as a fallback,
and do not restore Ory or generic provider selection. Rollback is an
authentication-only operation: restore the last verified Clerk image and
matching Clerk runtime variables, then repeat the unauthenticated and
authenticated smoke tests. Do not change financial data during rollback.

This authentication cutover changes no financial records. The 221 unresolved
transactions, 663 review-only suggestions, cash/classification/close controls,
and all booking and review-decision records remain unchanged.

## Final production authentication verification (2026-08-30)

- `AUTH_PROVIDER=clerk` and `NEXT_PUBLIC_AUTH_PROVIDER=clerk` were verified in
  the production deployment; `ALLOW_PRODUCTION_AUTH_BYPASS=false`.
- `/sign-in` returned `200`; protected application pages redirected
  unauthenticated requests to the sign-in flow.
- Protected Finance APIs returned `401` JSON without a Clerk session.
- No Clerk secret value or credential was recorded here.
- No financial data, import, review decision, booking, or opening-balance
  mutation was performed.

## Historical auth-cutover rollout verification (2026-07-14)

- The three protected APIs returned `401` JSON without a Clerk session.
- `/review` and `/reports` returned `307` redirects to the internal `/sign-in`
  flow without a Clerk session.
- `/sign-in` returned `200`; `/sign-up` redirected to `/sign-in`.
- The active local administrator and verified Clerk primary email matched
  case-insensitively; the identity is intentionally not recorded here.
- No transaction approval, booking, review decision, suggestion backfill,
  opening-balance repair, or other financial write was submitted.

## Historical authenticated portal regression diagnosis (2026-07-14)

The empty authenticated-portal report was a client session-readiness race:
`LedgerProvider` could read before Clerk had finished establishing the session,
swallow the transient `401`, and remain empty. The client now waits for Clerk
to be loaded and signed in before reading finance data, then refreshes when that
state becomes ready.

A read-only production ownership audit confirmed that the authenticated
administrator already owns the imported finance records. No separate
`FINANCE_DATA_OWNER_USER_ID` variable, ownership reassignment, migration,
reimport, or financial write was required.

Authenticated production verification returned `200` JSON for the ledger,
accounts, review, reports summary, and accounting audit reads. The ledger
contained 902 transactions, review contained 221 unresolved items, the audit
reported cash `PASSED`, classification `PENDING`, and close `BLOCKED`, and the
ledger, review, and reports pages rendered populated content without hydration
errors or failed network requests.
