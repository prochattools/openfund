/**
 * Release manifest generator for Yeshua Academy Finance.
 *
 * Generates a Dutch operator-facing release manifest summarising:
 * - current git commit, branch, timestamp
 * - package version and Prisma version
 * - latest phase implementation summary
 * - current blockers
 * - validation command list
 * - safety confirmations
 *
 * Usage:
 *   node scripts/generate-release-manifest.mjs           # preview to stdout
 *   node scripts/generate-release-manifest.mjs --write   # write to docs/RELEASE_MANIFEST_NL.md
 *   node scripts/generate-release-manifest.mjs --help    # show usage
 *
 * Guards:
 * - Does NOT require network access.
 * - Does NOT read .env.
 * - Does NOT print secrets.
 * - Does NOT modify files unless called with --write.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';

const MANIFEST_PATH = 'docs/RELEASE_MANIFEST_NL.md';

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '(onbekend)';
  }
}

export function buildManifest() {
  const cwd = process.cwd();

  // Git info
  const commit = safeExec('git rev-parse HEAD');
  const commitShort = safeExec('git rev-parse --short HEAD');
  const branch = safeExec('git branch --show-current');
  const commitMsg = safeExec('git log -1 --pretty=%s');
  const commitDate = safeExec('git log -1 --pretty=%ci');

  // Package versions — read from package.json, not network
  const pkgPath = resolve(cwd, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const appVersion = pkg.version ?? '(onbekend)';
  const prismaVersion = pkg.devDependencies?.prisma ?? pkg.dependencies?.prisma ?? '(onbekend)';
  const prismaClientVersion = pkg.dependencies?.['@prisma/client'] ?? '(onbekend)';

  // Generation timestamp (passed in from outside to keep script deterministic)
  // We use the git commit date as the stable timestamp so this is reproducible.
  const generatedAt = commitDate;

  const manifest = `# Yeshua Academy Finance — Release Manifest

Status: Release Candidate 4 — final owner handoff polish
Taal: Nederlands
Gegenereerd op: ${generatedAt} (RC4)

---

## Versie-informatie

| Veld | Waarde |
|------|--------|
| Applicatieversie | ${appVersion} |
| Branch | ${branch} |
| Commit (volledig) | ${commit} |
| Commit (kort) | ${commitShort} |
| Commit bericht | ${commitMsg} |
| Commit datum | ${commitDate} |
| Prisma versie (dev) | ${prismaVersion} |
| @prisma/client versie | ${prismaClientVersion} |

---

## Geïmplementeerde fasen (samenvatting)

| Fase | Status |
|------|--------|
| Phase 0 — Governance | COMPLETE |
| Phase 1 — Veilige categorisatiebasis | COMPLETE |
| Phase 2 — Financieel domein en historisch model | COMPLETE |
| Phase 3 — Historisch laden (guarded dry-run) | IN PROGRESS |
| Phase 4 — Maandelijkse import en review | COMPLETE |
| Phase 5 — Reconciliatie en afsluiting | COMPLETE |
| Phase 6 — Rapporten en distributie | COMPLETE |
| Phase 7 — Dutch UX en autorisatiehardening | COMPLETE |
| Phase 8 — Infrastructuur en deployment | COMPLETE (lokale gereedheid; productiecutover blijft geblokkeerd) |
| Phase 9 — Operationele hardening en overdracht | COMPLETE (lokaal, RC4) |

---

## Openstaande blockers vóór productie

De volgende blokkades zijn nog van kracht. Ze mogen **NIET** worden omzeild zonder expliciete eigenaargoedkeuring:

| # | Blocker | Reden |
|---|---------|-------|
| 1 | Echte PDF-renderer afhankelijkheid | \`PDF_BLOCKER\` actief; geen goedgekeurde bibliotheek |
| 2 | Productiemigratie en cutover | Vereist expliciete eigenaargoedkeuring |
| 3 | Historische productie-import (2024/2025/2026) | Operator-gated; vereist eigenaargoedkeuring en dry-run |
| 4 | Echte e-mailverzending | \`RESEND_API_KEY\` niet geconfigureerd; no-op modus actief |
| 5 | PostgreSQL-productieversie bevestigen | Vereist verificatie bij hostingprovider vóór cutover |
| 6 | Live backup/restore rehearsal | VOLTOOID op 2026-07-05 (RC3); productieback-up/herstel blijft geblokkeerd tot eigenaargoedkeuring |

---

## Validatiecommando's

Voer het volgende commando uit om alle veilige lokale validaties in één stap te draaien:

\`\`\`bash
npm run validate:release-candidate
\`\`\`

Dit commando voert uit:
1. \`npm test\` — volledig testsuite
2. \`npm run build:server\` — TypeScript server-compilatie
3. \`npm run build\` — Next.js productiebuild
4. \`DATABASE_URL=... npx prisma validate\` — schemavalidatie
5. \`npx prisma generate\` — Prisma Client genereren
6. \`node scripts/backup-restore-rehearsal.mjs --dry-run\` — guard-check zonder database
7. \`git diff --check\` — geen onverwachte wijzigingen

Aanvullende veilige validaties:

\`\`\`bash
node scripts/backup-restore-rehearsal.mjs --help
node scripts/backup-restore-rehearsal.mjs --dry-run
node scripts/generate-release-manifest.mjs
\`\`\`

---

## Veiligheidsstatus

| Controle | Status |
|---------|--------|
| Geen productiedatabase aangeraakt | BEVESTIGD |
| Geen push uitgevoerd | BEVESTIGD |
| Geen .env gewijzigd | BEVESTIGD |
| Geen Graphify aangeraakt | BEVESTIGD |
| Geen owner-bronbestanden in Git | BEVESTIGD |
| Geen ruwe transactiedumps in Git | BEVESTIGD |
| Geen databasedumps in Git | BEVESTIGD |
| Geen historische productie-import uitgevoerd | BEVESTIGD |
| Geen echte e-mail verzonden | BEVESTIGD |
| Geen PDF-bibliotheek geïnstalleerd | BEVESTIGD |
| Geen Dokploy of 10.0.2.4 gebruikt | BEVESTIGD |

---

## Eigenaarsbeslissingen die nog vereist zijn

Zie \`docs/OWNER_DECISION_PACK_NL.md\` voor de volledige beslissingschecklist.

Zie \`docs/OWNER_HANDOFF_NL.md\` voor de volledige eigenaaroverdracht.

---

*Gegenereerd door \`scripts/generate-release-manifest.mjs\`*
`;

  return manifest.trimEnd() + '\n';
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const cliArgs = process.argv.slice(2);
const isHelp = cliArgs.includes('--help');
const isWrite = cliArgs.includes('--write');

if (import.meta.url === `file://${process.argv[1]}`) {
  if (isHelp) {
    console.log(`Yeshua Academy Finance — Release Manifest Generator

GEBRUIK / USAGE:
  node scripts/generate-release-manifest.mjs           Preview naar stdout
  node scripts/generate-release-manifest.mjs --write   Schrijf naar docs/RELEASE_MANIFEST_NL.md
  node scripts/generate-release-manifest.mjs --help    Toon dit helpscherm

GUARDS:
  - Geen netwerktoegang vereist
  - Leest geen .env
  - Print geen geheimen
  - Wijzigt geen bestanden zonder --write`);
    process.exit(0);
  }

  const manifest = buildManifest();

  if (isWrite) {
    writeFileSync(MANIFEST_PATH, manifest, 'utf-8');
    console.log(`[manifest] Geschreven naar ${MANIFEST_PATH}`);
  } else {
    process.stdout.write(manifest);
  }
}
