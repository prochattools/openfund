/**
 * Future push readiness preflight for Yeshua Academy Finance.
 *
 * Local-only report. It verifies whether a future owner-approved publish would
 * be ready, but it never pushes, tags, reads .env, mutates files, or calls the
 * network.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_FILES = [
  'docs/OWNER_HANDOFF_NL.md',
  'docs/RELEASE_MANIFEST_NL.md',
  'docs/PUSH_READINESS_CHECKLIST_NL.md',
  'package.json',
];

const ALLOWED_DIRTY_PATHS = ['.graphifyignore', 'graphify-out/'];
const DUMP_FILE_PATTERN = /\.(dump|backup|bak|tar|tgz|gz)$/i;
const SQL_DUMP_PATTERN = /\.sql$/i;
const OWNER_SOURCE_PATTERN = /(^|\/)(owner[-_ ]?source|raw[-_ ]?transactions?|productie[-_ ]?import|historische[-_ ]?productie|ya[-_ ]?financieel).*\.(xlsx|csv|pdf)$/i;

const HELP_TEXT = `Yeshua Academy Finance — Push readiness preflight

GEBRUIK / USAGE:
  node scripts/push-readiness-preflight.mjs
  node scripts/push-readiness-preflight.mjs --strict
  node scripts/push-readiness-preflight.mjs --help

GUARDS:
  - Leest geen .env
  - Wijzigt geen bestanden
  - Publiceert niets naar remote
  - Maakt geen tags
  - Voert geen productie-, database-, provider- of netwerkactie uit`;

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

function isEnvPath(path) {
  return path === '.env' || path.startsWith('.env.');
}

function isAllowedEnvTemplate(path) {
  return ['.env.example', '.env.preview', '.env.production'].includes(path);
}

function isSqlDump(path) {
  if (!SQL_DUMP_PATTERN.test(path)) return false;
  return !path.startsWith('prisma/migrations/') && !path.startsWith('prisma/migrations-legacy-pre-baseline/');
}

function isDumpPath(path) {
  return DUMP_FILE_PATTERN.test(path) || isSqlDump(path);
}

function isOwnerSourcePath(path) {
  return OWNER_SOURCE_PATTERN.test(path);
}

export function buildPushReadinessPreflight(input = {}) {
  const repoRoot = input.repoRoot ?? process.cwd();
  const branch = input.branch ?? safeExec('git branch --show-current');
  const head = input.head ?? safeExec('git rev-parse --short HEAD');
  const status = input.status ?? safeExec('git status --short --branch');
  const dirtyPaths = input.dirtyPaths ?? parseDirtyPaths(status);
  const trackedFiles = input.trackedFiles ?? safeExec('git ls-files').split('\n').filter(Boolean);
  const pkgPath = resolve(repoRoot, 'package.json');
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf-8')) : { scripts: {} };

  const unexpectedDirtyPaths = dirtyPaths.filter((path) => !isAllowedDirtyPath(path));
  const dirtyEnvPaths = dirtyPaths.filter((path) => isEnvPath(path));
  const trackedEnvFiles = trackedFiles.filter((path) => path === '.env');
  const dumpFiles = trackedFiles.filter(isDumpPath);
  const ownerSourceFiles = trackedFiles.filter(isOwnerSourcePath);
  const missingRequiredFiles = REQUIRED_FILES.filter((path) => !existsSync(resolve(repoRoot, path)));
  const hasValidateScript = Boolean(pkg.scripts?.['validate:release-candidate']);

  const checks = [
    {
      id: 'branch',
      label: 'Branch is main',
      ok: branch === 'main',
      detail: branch || '(onbekend)',
    },
    {
      id: 'worktree',
      label: 'Alleen toegestane Graphify-artifacts zijn dirty',
      ok: unexpectedDirtyPaths.length === 0,
      detail: dirtyPaths.length ? dirtyPaths.join(', ') : 'schoon',
    },
    {
      id: 'validate_script',
      label: 'Release-candidate validatiescript bestaat',
      ok: hasValidateScript,
      detail: hasValidateScript ? 'validate:release-candidate' : 'ontbreekt',
    },
    {
      id: 'required_docs',
      label: 'Release manifest, owner handoff en push checklist zijn aanwezig',
      ok: missingRequiredFiles.length === 0,
      detail: missingRequiredFiles.length ? missingRequiredFiles.join(', ') : `${REQUIRED_FILES.length} bestanden`,
    },
    {
      id: 'env',
      label: '.env is niet tracked of dirty',
      ok: trackedEnvFiles.length === 0 && dirtyEnvPaths.filter((path) => !isAllowedEnvTemplate(path)).length === 0,
      detail: [...trackedEnvFiles, ...dirtyEnvPaths].join(', ') || 'geen .env',
    },
    {
      id: 'dumps',
      label: 'Geen database-dumpbestanden in Git',
      ok: dumpFiles.length === 0,
      detail: dumpFiles.length ? dumpFiles.join(', ') : 'geen dumps',
    },
    {
      id: 'owner_sources',
      label: 'Geen owner-productiebronbestanden in Git',
      ok: ownerSourceFiles.length === 0,
      detail: ownerSourceFiles.length ? ownerSourceFiles.join(', ') : 'geen owner-productiebronnen',
    },
  ];

  return {
    decision: checks.every((check) => check.ok) ? 'READY_FOR_OWNER_APPROVED_PUSH' : 'NO_GO',
    branch,
    head,
    dirtyPaths,
    checks,
  };
}

export function renderPushReadinessPreflight(result) {
  const lines = [
    '# Yeshua Academy Finance — Push readiness preflight',
    '',
    `Besluit: ${result.decision === 'READY_FOR_OWNER_APPROVED_PUSH' ? 'GEREED VOOR OWNER-APPROVED PUSH' : 'NO-GO'}`,
    `Branch: ${result.branch || '(onbekend)'}`,
    `HEAD: ${result.head || '(onbekend)'}`,
    '',
    '| Controle | Status | Detail |',
    '|----------|--------|--------|',
    ...result.checks.map((check) => `| ${check.label} | ${check.ok ? 'GESLAAGD' : 'GEBLOKKEERD'} | ${check.detail} |`),
    '',
    '## Toekomstige push-prompt',
    '',
    'Kopieer pas na expliciete eigenaargoedkeuring:',
    '',
    '```text',
    'Owner approval received for remote publish.',
    'Run the push readiness preflight and release-candidate validation again.',
    'Confirm branch, HEAD, and clean worktree scope.',
    'Publish the current main commit to the approved remote without tags and without force.',
    'Report the published commit hash and final git status.',
    '```',
    '',
    'Bevestiging: deze preflight heeft niets gepubliceerd, geen tag gemaakt, geen `.env` gelezen, geen productie gebruikt, geen database geraakt en geen bestanden gewijzigd.',
  ];

  return `${lines.join('\n')}\n`;
}

const args = process.argv.slice(2);
const isHelp = args.includes('--help');
const isStrict = args.includes('--strict');

if (import.meta.url === `file://${process.argv[1]}`) {
  if (isHelp) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const result = buildPushReadinessPreflight();
  process.stdout.write(renderPushReadinessPreflight(result));
  if (isStrict && result.decision !== 'READY_FOR_OWNER_APPROVED_PUSH') {
    process.exit(1);
  }
}
