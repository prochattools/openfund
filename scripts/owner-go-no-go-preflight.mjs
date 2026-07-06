/**
 * Owner go/no-go preflight for Yeshua Academy Finance.
 *
 * Local-only handoff helper. It reads committed repository metadata and
 * documentation, then reports whether the repo is ready for owner review.
 *
 * Guards:
 * - Does NOT require network access.
 * - Does NOT read .env.
 * - Does NOT connect to any database.
 * - Does NOT call external providers.
 * - Does NOT push, tag, migrate, import, or mutate production state.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_DOCS = [
  'docs/FINAL_READINESS_AUDIT_NL.md',
  'docs/OWNER_HANDOFF_NL.md',
  'docs/OWNER_DECISION_PACK_NL.md',
  'docs/OWNER_REVIEW_INDEX_NL.md',
  'docs/OWNER_DECISION_READINESS_MATRIX_NL.md',
  'docs/POST_APPROVAL_PROMPTS_NL.md',
  'docs/RELEASE_MANIFEST_NL.md',
  'docs/OWNER_GO_NO_GO_PREFLIGHT_NL.md',
  'docs/BACKUP_RESTORE_REHEARSAL_NL.md',
  'docs/PRODUCTION_CUTOVER_PLAN_NL.md',
  'docs/FINAL_RELEASE_CANDIDATE_CHECKLIST_NL.md',
];

const ALLOWED_DIRTY_PATHS = [
  '.graphifyignore',
  'graphify-out/',
];

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '(onbekend)';
  }
}

export function classifyDirtyPaths(statusOutput) {
  const lines = statusOutput
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const dirtyPaths = lines
    .filter((line) => !line.startsWith('## '))
    .map((line) => line.slice(3).trim());

  const unexpected = dirtyPaths.filter((path) => {
    return !ALLOWED_DIRTY_PATHS.some((allowed) => {
      if (allowed.endsWith('/')) return path === allowed.slice(0, -1) || path.startsWith(allowed);
      return path === allowed;
    });
  });

  return {
    dirtyPaths,
    unexpected,
    onlyAllowedGraphify: unexpected.length === 0,
  };
}

export function extractManifestCommit(manifestContent) {
  const full = manifestContent.match(/\| Commit \(volledig\) \| ([0-9a-f]{40}) \|/i)?.[1] ?? null;
  const short = manifestContent.match(/\| Commit \(kort\) \| ([0-9a-f]{7,12}) \|/i)?.[1] ?? null;
  return { full, short };
}

export function extractReleaseEvidenceCommit(manifestContent) {
  const full = manifestContent.match(/\| Release evidence validated through \| ([0-9a-f]{40}) \|/i)?.[1] ?? null;
  const short = manifestContent.match(/\| Release evidence validated through short \| ([0-9a-f]{7,12}) \|/i)?.[1] ?? null;
  return { full, short };
}

function isCommitAncestorOfHead(commit, head) {
  if (!commit) return false;
  try {
    execSync(`git cat-file -e ${commit}^{commit}`, { stdio: ['ignore', 'ignore', 'ignore'] });
    execSync(`git merge-base --is-ancestor ${commit} ${head}`, { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

export function buildOwnerGoNoGoPreflight(input) {
  const dirty = classifyDirtyPaths(input.gitStatus);
  const missingDocs = REQUIRED_DOCS.filter((doc) => !input.existingDocs.includes(doc));
  const manifestCommit = extractManifestCommit(input.releaseManifest);
  const releaseEvidenceCommit = extractReleaseEvidenceCommit(input.releaseManifest);

  const checks = [
    {
      id: 'branch',
      label: 'Branch is main',
      ok: input.branch === 'main',
      detail: input.branch,
    },
    {
      id: 'manifest_rc4',
      label: 'Release manifest is RC4',
      ok: input.releaseManifest.includes('Release Candidate 4') && input.releaseManifest.includes('Release evidence validated through'),
      detail: releaseEvidenceCommit.short ?? manifestCommit.short ?? '(geen commit gevonden)',
    },
    {
      id: 'release_evidence_current',
      label: 'Release-evidence is niet misleidend verouderd',
      ok: isCommitAncestorOfHead(releaseEvidenceCommit.full ?? manifestCommit.full, input.head),
      detail: `validated-through ${releaseEvidenceCommit.short ?? manifestCommit.short ?? '(onbekend)'}`,
    },
    {
      id: 'required_docs',
      label: 'Eigenaarsdocumenten zijn aanwezig',
      ok: missingDocs.length === 0,
      detail: missingDocs.length === 0 ? `${REQUIRED_DOCS.length} documenten` : missingDocs.join(', '),
    },
    {
      id: 'worktree_scope',
      label: 'Worktree bevat alleen toegestane Graphify-artifacts',
      ok: dirty.onlyAllowedGraphify,
      detail: dirty.dirtyPaths.length === 0 ? 'schoon' : dirty.dirtyPaths.join(', '),
    },
    {
      id: 'production_blockers',
      label: 'Productieblockers blijven expliciet',
      ok: [
        'Productiemigratie',
        'Historische productie-import',
        'RESEND_API_KEY',
        'PDF_BLOCKER',
        'PostgreSQL-productieversie',
        'Push',
        'Geheimen',
      ].every((text) => input.releaseManifest.includes(text)),
      detail: 'manifest blockers',
    },
    {
      id: 'no_go_until_owner',
      label: 'Push en productie blijven geblokkeerd tot eigenaargoedkeuring',
      ok: input.ownerHandoff.includes('git push') && input.ownerHandoff.includes('Productiemigratie uitvoeren'),
      detail: 'owner handoff',
    },
  ];

  const ok = checks.every((check) => check.ok);

  return {
    decision: ok ? 'GO_FOR_OWNER_REVIEW' : 'NO_GO',
    branch: input.branch,
    head: input.head,
    manifestCommit,
    releaseEvidenceCommit,
    checks,
  };
}

export function renderPreflightMarkdown(result) {
  const title = result.decision === 'GO_FOR_OWNER_REVIEW'
    ? 'GO voor eigenaarsbeoordeling'
    : 'NO-GO voor eigenaarsbeoordeling';

  const lines = [
    '# Yeshua Academy Finance — Owner go/no-go preflight',
    '',
    `Besluit: ${title}`,
    `Branch: ${result.branch}`,
    `HEAD: ${result.head}`,
    `Manifest commit: ${result.manifestCommit.short ?? '(onbekend)'}`,
    `Release evidence validated through: ${result.releaseEvidenceCommit?.short ?? result.manifestCommit.short ?? '(onbekend)'}`,
    '',
    '| Controle | Status | Detail |',
    '|----------|--------|--------|',
  ];

  for (const check of result.checks) {
    lines.push(`| ${check.label} | ${check.ok ? 'GESLAAGD' : 'GEBLOKKEERD'} | ${check.detail} |`);
  }

  lines.push('');
  lines.push('Bevestiging: geen productie, Dokploy, MCP bridge, 10.0.2.4, .env, database, e-mailprovider, push, tag, historische import, PDF-bibliotheek of externe provider is aangeraakt.');

  return `${lines.join('\n')}\n`;
}

const cliArgs = process.argv.slice(2);
const isHelp = cliArgs.includes('--help');
const isJson = cliArgs.includes('--json');
const isStrict = cliArgs.includes('--strict');

if (import.meta.url === `file://${process.argv[1]}`) {
  if (isHelp) {
    console.log(`Yeshua Academy Finance — Owner go/no-go preflight

GEBRUIK / USAGE:
  node scripts/owner-go-no-go-preflight.mjs           Markdown samenvatting
  node scripts/owner-go-no-go-preflight.mjs --json    JSON samenvatting
  node scripts/owner-go-no-go-preflight.mjs --strict  Exit 1 bij NO-GO
  node scripts/owner-go-no-go-preflight.mjs --help    Toon dit helpscherm

GUARDS:
  - Geen netwerktoegang vereist
  - Leest geen .env
  - Raakt geen database, productiehost of externe provider
  - Voert geen push, tag, migratie of import uit`);
    process.exit(0);
  }

  const repoRoot = process.cwd();
  const releaseManifestPath = resolve(repoRoot, 'docs/RELEASE_MANIFEST_NL.md');
  const ownerHandoffPath = resolve(repoRoot, 'docs/OWNER_HANDOFF_NL.md');
  const existingDocs = REQUIRED_DOCS.filter((doc) => existsSync(resolve(repoRoot, doc)));

  const result = buildOwnerGoNoGoPreflight({
    branch: safeExec('git branch --show-current'),
    head: safeExec('git rev-parse --short HEAD'),
    gitStatus: safeExec('git status --short --branch'),
    existingDocs,
    releaseManifest: existsSync(releaseManifestPath)
      ? readFileSync(releaseManifestPath, 'utf-8')
      : '',
    ownerHandoff: existsSync(ownerHandoffPath)
      ? readFileSync(ownerHandoffPath, 'utf-8')
      : '',
  });

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    process.stdout.write(renderPreflightMarkdown(result));
  }

  if (isStrict && result.decision !== 'GO_FOR_OWNER_REVIEW') {
    process.exit(1);
  }
}
