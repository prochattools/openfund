# Yeshua Academy Finance

Internal finance administration for Yeshua Academy.

This repository is not a SaaS product and is not intended for resale. It exists to support Yeshua Academy's finance workflows:

- bank statement imports
- ledger review and categorization
- reconciliation and opening balances
- period locking
- finance exports and internal reporting

## Authoritative product documents

Read these documents in order before changing product behavior:

1. [`docs/PHILOSOPHY.md`](docs/PHILOSOPHY.md) — what the application is and how financial truth is handled.
2. [`docs/STRATEGY.md`](docs/STRATEGY.md) — high-level goals, delivery strategy, constraints, and success measures.
3. [`docs/ROADMAP.md`](docs/ROADMAP.md) — ordered product phases and future scope.
4. [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — exact AI-executable tasks, statuses, acceptance criteria, and validation.

The active rebuild evidence and resume point are recorded in [`docs/finance-rebuild-run.md`](docs/finance-rebuild-run.md). Older discovery and handoff documents are historical unless one of the four authoritative documents explicitly references them.

## Runtime model

The app runs against a standalone PostgreSQL database named `finance`.

- Application database: `finance`
- Application schema: `finance`
- Application role: `finance_user`
- Optional shadow database: `finance_shadow`
- Public URL: `https://finance.yeshua.academy`

There is no tenant registry and no `tenant_*` schema pattern in the target architecture for this app.

## Environment

Production should use:

```bash
SYSTEM_DATABASE_URL=postgresql://<admin-user>:<admin-password>@<db-host>:5433/postgres?schema=public
DATABASE_URL=postgresql://finance_user:<app-password>@<db-host>:5433/finance?schema=finance
SHADOW_DATABASE_URL=postgresql://finance_user:<app-password>@<db-host>:5433/finance_shadow?schema=finance
DATABASE_SCHEMA=finance
NEXT_PUBLIC_APP_URL=https://finance.yeshua.academy
NEXT_PUBLIC_API_BASE_URL=https://finance.yeshua.academy
DEFAULT_USER_ID=finance_user
NEXT_PUBLIC_API_USER_ID=finance_user
```

Local development should mirror the same shape, but point at local Postgres.

## Database operations

Administrative scripts should use `SYSTEM_DATABASE_URL` for privileged operations and `DATABASE_URL` for normal app/runtime access.

The intended workflow is:

1. Provision the standalone `finance` database and `finance_user` role.
2. Apply Prisma migrations to `finance.finance`.
3. Migrate verified data from the legacy `openfund.openfund` schema into `finance.finance`.
4. Update runtime env to the new `DATABASE_URL`.
5. Redeploy and verify `finance.yeshua.academy`.
6. Leave the old database in place until the new deployment is verified.

## Notes

- `openfund` is the legacy name.
- `ya_finance_schema` exists in production as an older, empty schema and should not be treated as the source of truth.
- The live source of truth before cutover is `openfund.openfund`.
