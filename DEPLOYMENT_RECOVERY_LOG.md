# Deployment Recovery Log — CLOSED

## Incident: 2026-08-07/08 Dokploy deployment failure and recovery

### Summary

Production deployment stalled after Docker image push and Dokploy HTTP acceptance.
Root cause identified, fixed, and production converged to exact SHA.

**Status: CLOSED — READY FOR OWNER USE**

### Final Production State

| Component | Status | Value |
|-----------|--------|-------|
| Deployed SHA | Converged | `189c7d6a2278bb53a6c090d6b19ddd318f93f08f` |
| GitHub Actions #280 | SUCCESS | Run `31280488648` |
| `/api/health` | 200 | ok |
| `/api/deployment-info` | 200 | buildSha matches |
| Transactions | 902 | confirmed |
| Unresolved queue | 0 | — |
| ReviewDecisions | 223 | — |
| Accounting | PASSED | — |
| Cash reconciliation | PASSED | — |
| Classification | PASSED | — |
| Prisma migrations | 11/11 | clean |

### Root Cause

1. **Env stripped by Dokploy**: The `application.saveDockerProvider` API call left the application's env field with only `AUTH_PROVIDER=clerk` and `NEXT_PUBLIC_AUTH_PROVIDER=clerk`. All other variables (including `DATABASE_URL`) were missing.
2. **Container exit code 1**: Without `DATABASE_URL`, `start-prod.mjs` threw immediately, causing Docker Swarm replacement tasks to shut down within seconds and triggering automatic rollback to the old container.
3. **Auth misconfiguration**: After restoring the full environment, `DEFAULT_USER_ID` was set to `finance_user` (a string slug) instead of the actual database UUID. The auth resolver returned 503 because no matching active User record existed.

### Resolution

1. Restored full 21-variable environment via Dokploy `application.saveEnvironment` API.
2. Deployed a temporary startup diagnostic to discover the correct User UUID from the database.
3. Set `DEFAULT_USER_ID` to the correct UUID value.
4. Removed the temporary diagnostic commit.
5. Production converged at `189c7d6a` with full health verification.

### Lessons

- Dokploy HTTP 200 acceptance does not prove deployment success — follow through to Swarm task state and container startup.
- Exact-SHA image publishing/pulling worked correctly throughout.
- The actual failure path was: Dokploy env → Swarm task → container startup → immediate exit.
- `serverId:null` in the Dokploy API response is normal for Docker Swarm applications and is NOT a deployment blocker.

### Incorrect intermediate diagnoses (not root causes)

- `serverId:null` meaning "no deployment server" — disproven
- `composeId:undefined` — irrelevant to Docker provider applications
- Endpoint path speculation (`/deploy` vs `/redeploy`) — both work; the issue was env, not the trigger

---

*Incident closed 2026-08-09*
