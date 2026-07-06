/**
 * OPS-008 — Owner go/no-go preflight tests.
 *
 * Pure unit/CLI tests for the local-only owner handoff preflight. No database,
 * network, production host, provider, push, tag, migration, or import is used.
 */

import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';

import {
  buildOwnerGoNoGoPreflight,
  classifyDirtyPaths,
  extractManifestCommit,
  renderPreflightMarkdown,
} from '../../scripts/owner-go-no-go-preflight.mjs';

const requiredDocs = [
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

const manifest = `# Yeshua Academy Finance — Release Manifest

Status: Release Candidate 4 — final owner handoff polish

| Commit (volledig) | 0123456789abcdef0123456789abcdef01234567 |
| Commit (kort) | 0123456 |

| Release evidence validated through | 0123456789abcdef0123456789abcdef01234567 |

| 1 | Echte PDF-renderer afhankelijkheid | PDF_BLOCKER actief |
| 2 | Productiemigratie en cutover | Vereist eigenaargoedkeuring |
| 3 | Historische productie-import (2024/2025/2026) | Operator-gated |
| 4 | Echte e-mailverzending | RESEND_API_KEY niet geconfigureerd |
| 5 | PostgreSQL-productieversie bevestigen | Vereist verificatie |
| 6 | Push naar remote | Vereist expliciete eigenaargoedkeuring |
| 7 | Geheimen roteren | Vereist productievoorbereiding buiten Git |
`;

const ownerHandoff = `
| Actie | Reden |
| git push | Expliciete eigenaargoedkeuring vereist |
| Productiemigratie uitvoeren | Vereist eigenaargoedkeuring |
`;

const currentHead = execSync('git rev-parse HEAD', {
  encoding: 'utf-8',
  cwd: process.cwd(),
}).trim();
const currentHeadShort = execSync('git rev-parse --short HEAD', {
  encoding: 'utf-8',
  cwd: process.cwd(),
}).trim();

const currentManifest = manifest
  .replaceAll('0123456789abcdef0123456789abcdef01234567', currentHead)
  .replaceAll('0123456', currentHeadShort);

describe('owner go/no-go preflight — dirty path classification', () => {
  it('allows only Graphify artifacts', () => {
    const result = classifyDirtyPaths('## main...origin/main\n?? .graphifyignore\n?? graphify-out/\n');
    expect(result.onlyAllowedGraphify).toBe(true);
    expect(result.unexpected).toEqual([]);
  });

  it('rejects unexpected dirty files', () => {
    const result = classifyDirtyPaths('## main...origin/main\n M docs/OWNER_HANDOFF_NL.md\n?? graphify-out/\n');
    expect(result.onlyAllowedGraphify).toBe(false);
    expect(result.unexpected).toEqual(['docs/OWNER_HANDOFF_NL.md']);
  });
});

describe('owner go/no-go preflight — manifest parsing', () => {
  it('extracts manifest commit evidence', () => {
    expect(extractManifestCommit(manifest)).toEqual({
      full: '0123456789abcdef0123456789abcdef01234567',
      short: '0123456',
    });
  });
});

describe('owner go/no-go preflight — decision', () => {
  it('returns GO_FOR_OWNER_REVIEW when all local checks pass', () => {
    const result = buildOwnerGoNoGoPreflight({
      branch: 'main',
      head: currentHead,
      gitStatus: '## main...origin/main\n?? .graphifyignore\n?? graphify-out/\n',
      existingDocs: requiredDocs,
      releaseManifest: currentManifest,
      ownerHandoff,
    });

    expect(result.decision).toBe('GO_FOR_OWNER_REVIEW');
    expect(result.checks.every((check) => check.ok)).toBe(true);
  });

  it('returns NO_GO when a required document is missing', () => {
    const result = buildOwnerGoNoGoPreflight({
      branch: 'main',
      head: currentHead,
      gitStatus: '## main...origin/main\n',
      existingDocs: requiredDocs.slice(0, -1),
      releaseManifest: currentManifest,
      ownerHandoff,
    });

    expect(result.decision).toBe('NO_GO');
    expect(result.checks.some((check) => check.id === 'required_docs' && !check.ok)).toBe(true);
  });

  it('renders a sanitized Dutch markdown summary', () => {
    const result = buildOwnerGoNoGoPreflight({
      branch: 'main',
      head: currentHead,
      gitStatus: '## main...origin/main\n',
      existingDocs: requiredDocs,
      releaseManifest: currentManifest,
      ownerHandoff,
    });

    const output = renderPreflightMarkdown(result);
    expect(output).toContain('GO voor eigenaarsbeoordeling');
    expect(output).toContain(`Manifest commit: ${currentHeadShort}`);
    expect(output).not.toContain('local_dev_placeholder');
    expect(output).not.toContain('PGPASSWORD=');
    expect(output).not.toContain('DATABASE_URL=postgresql://');
  });
});

describe('owner go/no-go preflight — CLI guards', () => {
  it('--help exits 0 and documents guardrails', () => {
    const output = execSync('node scripts/owner-go-no-go-preflight.mjs --help', {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    expect(output).toContain('--json');
    expect(output).toContain('--strict');
    expect(output).toContain('Leest geen .env');
    expect(output).toContain('Voert geen push');
  });
});
