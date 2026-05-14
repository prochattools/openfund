# Yeshua Academy Finance — Auth Readiness

Status: provider-neutral auth preparation  
Date: 2026-05-14

## Goal

The app is private-only. The target auth direction is Ory, with admin/viewer roles later. Clerk remains only as a temporary fallback until Ory is proven in the deployed environment.

## Current provider switch

Use:

```bash
AUTH_PROVIDER=disabled
NEXT_PUBLIC_AUTH_PROVIDER=disabled
```

Supported values:

- `disabled` — local/dev mode without auth guard;
- `ory` — Ory-ready middleware using session cookie detection and login redirect;
- `clerk` — temporary legacy fallback when valid Clerk keys are present.

## Ory-ready environment

```bash
AUTH_PROVIDER=ory
NEXT_PUBLIC_AUTH_PROVIDER=ory
ORY_SDK_URL=https://<ory-public-url>
NEXT_PUBLIC_ORY_SDK_URL=https://<ory-public-url>
NEXT_PUBLIC_ORY_LOGIN_URL=/self-service/login/browser
ORY_ADMIN_API_URL=https://<ory-admin-url>
```

The middleware currently checks for an Ory/Kratos session cookie:

- `ory_kratos_session`; or
- `ory_session`.

If no session cookie exists, the middleware redirects to the configured Ory login route and includes a `return_to` parameter.

## Temporary Clerk fallback

Use only during migration:

```bash
AUTH_PROVIDER=clerk
NEXT_PUBLIC_AUTH_PROVIDER=clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<real publishable key>
CLERK_SECRET_KEY=<real secret key>
```

Clerk code is not loaded unless the provider is `clerk` and keys look valid.

## Remaining Ory migration tasks

1. Verify the exact Ory session cookie name in the deployed environment.
2. Add server-side Ory session verification for Express routes.
3. Map Ory identity ID/email to the local `User` row.
4. Add roles:
   - `admin` can import, review, categorize, send summaries, manage settings;
   - `viewer` can only read dashboard/reports/ledger.
5. Add role checks to mutation routes:
   - upload/import;
   - transaction category updates;
   - rule creation/update/deletion;
   - ledger locks/unlocks;
   - opening balances;
   - email sending.
6. Write audit logs with the actual Ory identity.
7. Remove Clerk dependency after Ory login and route protection are verified.

## Safety note

Do not make the app public. If auth is `disabled`, that should only be for local/dev or protected internal deployments.
