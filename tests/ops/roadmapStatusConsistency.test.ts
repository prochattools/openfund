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

describe('roadmap status consistency — RC7 gate', () => {
  it('implementation plan marks the superseded Phase 17 gate as historical', () => {
    expect(docs.implementationPlan).toContain('Historical RC7 release-evidence gate: Phase 17 complete; superseded');
    expect(docs.ownerHandoff).toContain('Eigenaaroverdracht (RC7)');
    expect(docs.implementationPlan).not.toContain('Current gate: Release Candidate 3 owner handoff');
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
  it('Phase 3 current status records the later Phase 11 production import', () => {
    expect(docs.roadmap).toContain('Phase 3 — Historical loading and truth fixtures  COMPLETE (historical local gate superseded by Phase 11 production import)');
    expect(docs.roadmap).toContain('Phase 11 — Production historical import          COMPLETE');
    expect(docs.roadmap).toContain('Historical implementation status (superseded by Phase 11)');
    expect(docs.implementationPlan).toContain('Phase 3 local/sanitized historical loading: complete');
    expect(docs.finalAudit).toContain('Phase 3 — Historisch laden | COMPLETE LOKAAL / PRODUCTIE-IMPORT OWNER-GATED');
    expect(docs.releaseManifest).toContain('Phase 3 — Historisch laden | COMPLETE LOKAAL / PRODUCTIE-IMPORT OWNER-GATED');
    expect(docs.roadmap).not.toContain('Phase 3 — Historical loading and truth fixtures  IN PROGRESS');
    expect(docs.roadmap).not.toContain('COMPLETE_LOCAL_OWNER_GATED_PRODUCTION');
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

  it('Phase 17 is complete with formula-based monthly chaining model and production audit passed', () => {
    expect(docs.roadmap).toContain('Phase 17 — Month-by-month accounting reconciliation and administrator reporting COMPLETE');
    expect(docs.roadmap).toContain('read-only production audit passed');
    expect(docs.implementationPlan).toContain('Phase 17 — Month-by-month accounting reconciliation and administrator reporting: COMPLETE');
    expect(docs.implementationPlan).toContain('production audit passed');
    expect(docs.finalAudit).toContain('read-only production audit passed on 2026-07-09');
    expect(docs.finalAudit).toContain('2024 closing 1218415 confirmed');
  });
});

describe('roadmap status consistency — blockers are explicit', () => {
  it('real PDF renderer is complete and docs keep email blocked', () => {
    expect(docs.roadmap).toContain('Generate HTML, XLSX, and PDF artifacts from the same immutable snapshot.');
    expect(docs.roadmap).toContain('UI, HTML, XLSX, and PDF artifacts include the same snapshot evidence.');
    expect(docs.releaseManifest).toContain('Echte PDF-renderer');
    expect(docs.releaseManifest).toContain('pdfkit');
    expect(docs.releaseManifest).toContain('Echte e-mailverzending');
  });

  it('real email sending is complete and dispatch works', () => {
    expect(docs.roadmap).toContain('Store report and dispatch hashes, recipients, sender, time, and metadata-only result; real e-mail sending completed 2026-07-08.');
    expect(docs.releaseManifest).toContain('Echte e-mailverzending');
    expect(docs.releaseManifest).toContain('AFGEROND 2026-07-08');
  });

  it('completed items appear in handoff doc and preflight reflects all-hardening-done', () => {
    const completed = [
      'Productiemigratie',
      'Echte PDF',
      'Echte e-mailverzending',
      'Historische productie-import',
      'Geheimen roteren',
    ];

    for (const item of completed) {
      expect(docs.ownerHandoff).toContain(item);
    }
    expect(docs.ownerPreflight).toContain('AFGEROND');
    expect(docs.ownerPreflight).toContain('Push blijft');
    expect(docs.pushChecklist).toContain('Push');
  });

  it('no release docs claim blocked production actions occurred', () => {
    for (const [name, content] of allDocs) {
      expect(content, name).not.toMatch(/productie(?:migratie|overstap|cutover).*voltooid/i);
      expect(content, name).not.toMatch(/historische productie-import (?:is )?(?:voltooid|succesvol uitgevoerd)/i);
      expect(content, name).not.toMatch(/echte e-mail(?:verzending)? is (?:verzonden|geactiveerd)/i);
      expect(content, name).not.toMatch(/git push (?:is )?(?:uitgevoerd|voltooid)/i);
      expect(content, name).not.toMatch(/owner.*(?:Excel|CSV|PDF).*is in Git geplaatst/i);
    }
  });
});
