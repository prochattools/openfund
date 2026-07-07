/**
 * OPS-010 — Roadmap status consistency checks.
 *
 * Guards the authoritative roadmap, implementation plan, final audit, release
 * manifest, and owner handoff against vague or stale phase status drift.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readDoc = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8');

const docs = {
  roadmap: readDoc('docs/ROADMAP.md'),
  implementationPlan: readDoc('docs/IMPLEMENTATION_PLAN.md'),
  finalAudit: readDoc('docs/FINAL_READINESS_AUDIT_NL.md'),
  releaseManifest: readDoc('docs/RELEASE_MANIFEST_NL.md'),
  ownerHandoff: readDoc('docs/OWNER_HANDOFF_NL.md'),
  ownerPreflight: readDoc('docs/OWNER_GO_NO_GO_PREFLIGHT_NL.md'),
  pushChecklist: readDoc('docs/PUSH_READINESS_CHECKLIST_NL.md'),
};

const allDocs = Object.entries(docs);

describe('roadmap status consistency — RC4 gate', () => {
  it('implementation plan and handoff docs identify RC4 owner review, not RC3', () => {
    expect(docs.implementationPlan).toContain('Current gate: owner decision selection after published RC4 owner-decision handoff');
    expect(docs.ownerHandoff).toContain('Eigenaaroverdracht (RC4)');
    expect(docs.ownerHandoff).toContain('### RC4-validatie in één stap');
    expect(docs.implementationPlan).not.toContain('Current gate: Release Candidate 3 owner handoff');
    expect(docs.ownerHandoff).not.toContain('### RC3-validatie in één stap');
  });

  it('RC4 local release evidence commits are recorded', () => {
    for (const commit of ['7ce6e6d', '43bfb90', '42a6f49', '43137b5', '33d08c4']) {
      expect(docs.implementationPlan).toContain(commit);
      expect(docs.finalAudit).toContain(commit);
      expect(docs.releaseManifest).toContain(commit);
    }
  });
});

describe('roadmap status consistency — phase status agreement', () => {
  it('Phase 3 is precise: local/sanitized machinery complete, production import owner-gated', () => {
    const status = 'COMPLETE_LOCAL_OWNER_GATED_PRODUCTION';
    expect(docs.roadmap).toContain(`Phase 3 — Historical loading and truth fixtures  ${status}`);
    expect(docs.implementationPlan).toContain('Phase 3 local/sanitized historical loading: complete');
    expect(docs.finalAudit).toContain('Phase 3 — Historisch laden | COMPLETE LOKAAL / PRODUCTIE-IMPORT OWNER-GATED');
    expect(docs.releaseManifest).toContain('Phase 3 — Historisch laden | COMPLETE LOKAAL / PRODUCTIE-IMPORT OWNER-GATED');
    expect(docs.roadmap).not.toContain('Phase 3 — Historical loading and truth fixtures  IN PROGRESS');
  });

  it('Phase 4 is precise: local/app monthly workflow complete', () => {
    const status = 'COMPLETE_LOCAL_APP_WORKFLOW';
    expect(docs.roadmap).toContain(`Phase 4 — Monthly import and review workflow     ${status}`);
    expect(docs.implementationPlan).toContain('Phase 4 monthly import/review workflow: complete for local/app behavior');
    expect(docs.finalAudit).toContain('Phase 4 — Maandelijkse import en review | COMPLETE LOKAAL / APP-WORKFLOW');
    expect(docs.releaseManifest).toContain('Phase 4 — Maandelijkse import en review | COMPLETE LOKAAL / APP-WORKFLOW');
    expect(docs.roadmap).not.toContain('Phase 4 — Monthly import and review workflow     IN PROGRESS');
  });

  it('Phase 8 and Phase 9 remain locally complete and production gated', () => {
    expect(docs.roadmap).toContain('Phase 8 — Infrastructure and deployment          COMPLETE (local readiness; production gated)');
    expect(docs.roadmap).toContain('Phase 9 — Operational hardening and handoff      COMPLETE (published RC4 handoff; owner decisions gated)');
    expect(docs.finalAudit).toContain('Phase 8 — Infrastructuur | COMPLETE');
    expect(docs.finalAudit).toContain('Phase 9 — Operationele hardening en overdracht | COMPLETE (local-only RC4)');
  });
});

describe('roadmap status consistency — blockers are explicit', () => {
  it('real PDF remains blocked and docs do not imply rendered PDF is complete', () => {
    expect(docs.roadmap).toContain('Generate HTML email and XLSX from the same snapshot; keep PDF as a placeholder until a PDF renderer is owner-approved.');
    expect(docs.roadmap).toContain('PDF placeholder artifacts include the same snapshot evidence; real rendered PDF output requires owner approval');
    expect(docs.releaseManifest).toContain('Echte PDF-renderer afhankelijkheid');
    expect(docs.releaseManifest).toContain('PDF_BLOCKER');
    expect(docs.roadmap).not.toContain('Generate HTML email, XLSX, and PDF from the same snapshot.');
  });

  it('real email remains blocked and dispatch is metadata-only', () => {
    expect(docs.roadmap).toContain('Store report and dispatch hashes, recipients, sender, time, and metadata-only result; real e-mail sending remains blocked.');
    expect(docs.ownerHandoff).toContain('Dispatch-metadata (e-mail wordt niet verzonden)');
    expect(docs.releaseManifest).toContain('Echte e-mailverzending');
  });

  it('every owner-facing blocker appears in handoff and preflight/checklist docs', () => {
    const blockers = [
      'Productiemigratie',
      'Historische productie-import',
      'Echte e-mail',
      'PDF',
      'PostgreSQL',
      'Push',
      'Geheimen',
    ];

    for (const blocker of blockers) {
      expect(docs.ownerHandoff).toContain(blocker);
      expect(docs.ownerPreflight).toContain(blocker);
      expect(docs.pushChecklist).toContain(blocker);
    }
  });

  it('no release docs claim blocked production actions occurred', () => {
    for (const [name, content] of allDocs) {
      expect(content, name).not.toMatch(/productie(?:migratie|overstap|cutover).*voltooid/i);
      expect(content, name).not.toMatch(/historische productie-import (?:is )?(?:voltooid|succesvol uitgevoerd)/i);
      expect(content, name).not.toMatch(/echte e-mail(?:verzending)? is (?:verzonden|geactiveerd)/i);
      expect(content, name).not.toMatch(/echte PDF (?:is )?(?:gegenereerd|geactiveerd)/i);
      expect(content, name).not.toMatch(/git push (?:is )?(?:uitgevoerd|voltooid)/i);
      expect(content, name).not.toMatch(/owner.*(?:Excel|CSV|PDF).*is in Git geplaatst/i);
    }
  });
});
