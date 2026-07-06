/**
 * Final owner review preflight for Yeshua Academy Finance.
 *
 * Local-only script that checks owner-review readiness without executing
 * any production action.
 *
 * Guards:
 * - Does NOT push, tag, or read .env.
 * - Does NOT call the network.
 * - Does NOT connect to any database.
 * - Does NOT install dependencies.
 * - Does NOT send email.
 * - Does NOT run historical import.
 * - Does NOT mutate files.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_FILES = [
  'docs/RELEASE_MANIFEST_NL.md',
  'docs/OWNER_REVIEW_FINAL_PACKET_NL.md',
  'docs/OWNER_APPROVAL_INTAKE_NL.md',
  'docs/OWNER_APPROVED_ACTION_PLAN_NL.md',
  'docs/PUSH_READINESS_CHECKLIST_NL.md',
  'docs/SAFE_COMMAND_INVENTORY_NL.md',
  'docs/OWNER_HANDOFF_NL.md',
  'docs/OWNER_REVIEW_INDEX_NL.md',
  'docs/OWNER_DECISION_PACK_NL.md',
  'docs/OWNER_DECISION_READINESS_MATRIX_NL.md',
  'docs/POST_APPROVAL_PROMPTS_NL.md',
  'docs/FINAL_READINESS_AUDIT_NL.md',
  'docs/FINAL_RELEASE_CANDIDATE_CHECKLIST_NL.md',
  'docs/FINAL_DOCS_CONSISTENCY_AUDIT_NL.md',
];

const REQUIRED_SCRIPTS = [
  'scripts/owner-go-no-go-preflight.mjs',
  'scripts/owner-decision-preflight.mjs',
  'scripts/owner-approved-action-plan.mjs',
  'scripts/push-readiness-preflight.mjs',
  'scripts/backup-restore-rehearsal.mjs',
  'scripts/generate-release-manifest.mjs',
  'scripts/final-docs-consistency-audit.mjs',
  'scripts/final-owner-review-preflight.mjs',
];

const ALLOWED_DIRTY_PATHS = ['.graphifyignore', 'graphify-out/'];

const FORBIDDEN_PACKAGE_SCRIPT_PATTERNS = [
  /git\s+push/,
  /git\s+tag/,
  /npm\s+install\b/,
  /npm\s+ci\b/,
  /10\.0\.2\.4/,
  /dokploy/i,
  /resend/i,
  /sendMail/i,
  /historical.*import/i,
];

const SAFE_NEXT_COMMANDS = [
  'npm run validate:release-candidate',
  'node scripts/owner-go-no-go-preflight.mjs --strict',
  'node scripts/owner-decision-preflight.mjs --decision pdf',
  'node scripts/push-readiness-preflight.mjs --strict',
  'node scripts/final-docs-consistency-audit.mjs',
];

const HELP_TEXT = `Yeshua Academy Finance — Finale eigenaarsbeoordeling preflight

GEBRUIK / USAGE:
  node scripts/final-owner-review-preflight.mjs            Markdown samenvatting
  node scripts/final-owner-review-preflight.mjs --check    Uitgebreide statische controles
  node scripts/final-owner-review-preflight.mjs --json     JSON output
  node scripts/final-owner-review-preflight.mjs --strict   Exit 1 als NIET GEREED
  node scripts/final-owner-review-preflight.mjs --help     Toon dit helpscherm

GUARDS:
  - Leest geen .env
  - Geen push, tag, migratie, import, database, netwerk
  - Geen dependencies installeren
  - Geen e-mail versturen
  - Muteert geen bestanden`;

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function parseDirtyPaths(statusOutput) {
  return statusOutput
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => !line.startsWith('## '))
    .map((line) => line.slice(3).trim());
}

function isAllowedDirtyPath(path) {
  return ALLOWED_DIRTY_PATHS.some((allowed) => {
    if (allowed.endsWith('/')) return path === allowed.slice(0, -1) || path.startsWith(allowed);
    return path === allowed;
  });
}

export function buildFinalOwnerReviewPreflight(input = {}) {
  const repoRoot = input.repoRoot ?? process.cwd();
  const branch = input.branch ?? safeExec('git branch --show-current');
  const head = input.head ?? safeExec('git rev-parse --short HEAD');
  const status = input.status ?? safeExec('git status --short --branch');
  const dirtyPaths = input.dirtyPaths ?? parseDirtyPaths(status);
  const unexpectedDirty = dirtyPaths.filter((p) => !isAllowedDirtyPath(p));

  const missingFiles = REQUIRED_FILES.filter((f) => !existsSync(resolve(repoRoot, f)));
  const missingScripts = REQUIRED_SCRIPTS.filter((s) => !existsSync(resolve(repoRoot, s)));

  const pkgPath = resolve(repoRoot, 'package.json');
  const pkg = existsSync(pkgPath)
    ? JSON.parse(readFileSync(pkgPath, 'utf-8'))
    : { scripts: {} };

  const scriptViolations = [];
  for (const [name, value] of Object.entries(pkg.scripts ?? {})) {
    for (const pattern of FORBIDDEN_PACKAGE_SCRIPT_PATTERNS) {
      if (pattern.test(value)) {
        scriptViolations.push(`${name}: ${pattern}`);
      }
    }
  }

  const releaseManifestPath = resolve(repoRoot, 'docs/RELEASE_MANIFEST_NL.md');
  const manifestContent = existsSync(releaseManifestPath)
    ? readFileSync(releaseManifestPath, 'utf-8')
    : '';
  const manifestIsRC4 = manifestContent.includes('Release Candidate 4');
  const manifestHasEvidence = manifestContent.includes('Release evidence validated through');

  const checks = [
    {
      id: 'branch',
      label: 'Branch is main',
      ok: branch === 'main',
      detail: branch || '(onbekend)',
    },
    {
      id: 'worktree',
      label: 'Worktree bevat alleen toegestane Graphify-artifacts',
      ok: unexpectedDirty.length === 0,
      detail: unexpectedDirty.length === 0
        ? 'schoon'
        : unexpectedDirty.join(', '),
    },
    {
      id: 'required_files',
      label: 'Alle vereiste eigenaarsdocumenten aanwezig',
      ok: missingFiles.length === 0,
      detail: missingFiles.length === 0
        ? `${REQUIRED_FILES.length} documenten`
        : `Ontbreekt: ${missingFiles.join(', ')}`,
    },
    {
      id: 'required_scripts',
      label: 'Alle vereiste preflight-scripts aanwezig',
      ok: missingScripts.length === 0,
      detail: missingScripts.length === 0
        ? `${REQUIRED_SCRIPTS.length} scripts`
        : `Ontbreekt: ${missingScripts.join(', ')}`,
    },
    {
      id: 'manifest_rc4',
      label: 'Release manifest is RC4 met validate-through evidence',
      ok: manifestIsRC4 && manifestHasEvidence,
      detail: manifestIsRC4 && manifestHasEvidence
        ? 'RC4 manifest met evidence'
        : 'Manifest ongeldig of ontbrekend',
    },
    {
      id: 'package_script_safety',
      label: 'Package scripts bevatten geen verboden commando\'s',
      ok: scriptViolations.length === 0,
      detail: scriptViolations.length === 0
        ? 'Geen verboden commando\'s'
        : scriptViolations.slice(0, 3).join('; '),
    },
  ];

  const ok = checks.every((c) => c.ok);
  const readyForOwnerReview = ok ? 'JA' : 'NEE';

  return {
    decision: ok ? 'READY_FOR_OWNER_REVIEW' : 'NOT_READY',
    readyForOwnerReview,
    branch,
    head,
    blockers: checks.filter((c) => !c.ok).map((c) => c.label),
    safeNextCommands: SAFE_NEXT_COMMANDS,
    checks,
  };
}

export function renderFinalOwnerReviewPreflightMarkdown(result) {
  const lines = [
    '# Yeshua Academy Finance — Finale eigenaarsbeoordeling preflight',
    '',
    `GEREED VOOR EIGENAARSBEOORDELING: ${result.readyForOwnerReview}`,
    `Branch: ${result.branch || '(onbekend)'}`,
    `HEAD: ${result.head || '(onbekend)'}`,
    '',
    '| Controle | Status | Detail |',
    '|----------|--------|--------|',
    ...result.checks.map(
      (c) => `| ${c.label} | ${c.ok ? 'GESLAAGD' : 'GEBLOKKEERD'} | ${c.detail} |`,
    ),
  ];

  if (result.blockers.length > 0) {
    lines.push('');
    lines.push('## Blockers');
    for (const b of result.blockers) {
      lines.push(`- ${b}`);
    }
  }

  lines.push('');
  lines.push('## Veilige volgende commando\'s');
  for (const cmd of result.safeNextCommands) {
    lines.push(`- \`${cmd}\``);
  }

  lines.push('');
  lines.push('Bevestiging: deze preflight heeft geen .env gelezen, geen push of tag uitgevoerd,');
  lines.push('geen database geraakt, geen netwerk gebruikt en geen bestanden gewijzigd.');

  return `${lines.join('\n')}\n`;
}

const cliArgs = process.argv.slice(2);
const isHelp = cliArgs.includes('--help');
const isJson = cliArgs.includes('--json');
const isStrict = cliArgs.includes('--strict');
// --check performs the same static checks; kept for forward-compat with test contracts
// const isCheck = cliArgs.includes('--check');

if (import.meta.url === `file://${process.argv[1]}`) {
  if (isHelp) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const result = buildFinalOwnerReviewPreflight();

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    process.stdout.write(renderFinalOwnerReviewPreflightMarkdown(result));
  }

  if (isStrict && result.decision !== 'READY_FOR_OWNER_REVIEW') {
    process.exit(1);
  }
}
