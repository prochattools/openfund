/**
 * OPS-011 — Phase 3 historical loading closeout evidence.
 *
 * Static/local guard for the RC4 closeout claim: historical loading is complete
 * for local/sanitized and owner-approved rehearsal paths, while production
 * execution remains owner-gated.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8');
const exists = (path: string) => existsSync(resolve(process.cwd(), path));

const implementationPlan = read('docs/IMPLEMENTATION_PLAN.md');
const roadmap = read('docs/ROADMAP.md');
const ownerCommandService = read('server/services/historicalOwnerImportCommandService.ts');
const localRehearsal = read('lib/import/historicalOwnerLocalRehearsal.ts');
const rehearsalWriter = read('server/services/historicalImportRehearsalService.ts');
const workbookParser = read('lib/import/historicalWorkbookParser.ts');
const importPlanner = read('lib/import/historicalImportPlanner.ts');

describe('Phase 3 historical loading closeout', () => {
  it('marks HIST-001 through HIST-004 complete locally and owner-gates production import', () => {
    expect(roadmap).toContain('Phase 3 — Historical loading and truth fixtures  COMPLETE_LOCAL_OWNER_GATED_PRODUCTION');
    expect(implementationPlan).toContain('Phase 3 local/sanitized historical loading: complete; production historical import remains owner-gated');

    for (const task of ['HIST-001', 'HIST-002', 'HIST-003', 'HIST-004']) {
      const section = implementationPlan.match(new RegExp(`### ${task}[\\s\\S]*?(?=\\n### |\\n## |$)`))?.[0] ?? '';
      expect(section, task).toContain('Status: `DONE_LOCAL_ONLY`');
    }
  });

  it('keeps owner files outside Git and validates exact retained-source hashes for local rehearsal', () => {
    expect(localRehearsal).toContain('path.isAbsolute(source.absolutePath)');
    expect(localRehearsal).toContain('Owner historical source must stay outside the Git repository');
    expect(localRehearsal).toContain('Owner historical source hash mismatch');
    expect(localRehearsal).toContain('retainedSourceContentBySha256');

    expect(rehearsalWriter).toContain('retainedSourceContentBySha256');
    expect(rehearsalWriter).toContain('hashSourceContent(content)');
    expect(rehearsalWriter).toContain('synthetic historical rehearsal source');
  });

  it('keeps the future production command blocked and sanitized by default', () => {
    expect(ownerCommandService).toContain("HistoricalOwnerImportCommandMode = 'dry-run' | 'rehearsal' | 'production-blocked'");
    expect(ownerCommandService).toContain("requestedMode === 'production' ? 'production-blocked' : requestedMode");
    expect(ownerCommandService).toContain('productionExecutionPerformed: false');
    expect(ownerCommandService).toContain('Production mode requires an explicit production command option.');
    expect(ownerCommandService).toContain('Production mode requires the source-bound production confirmation token.');
  });

  it('preserves historical parsing/planning semantics and has regression coverage in Git', () => {
    expect(workbookParser).toContain('rawRow');
    expect(workbookParser).toContain('date: Date');
    expect(workbookParser).toContain('categoryLabel');
    expect(importPlanner).toContain('sourceIsOpenPartial: coverageStatus ===');

    for (const testPath of [
      'tests/import/historicalWorkbookParser.test.ts',
      'tests/import/historicalImportPlanner.test.ts',
      'tests/import/historicalOwnerFileAdapter.test.ts',
      'tests/import/historicalControls.test.ts',
      'tests/services/historicalImportRehearsalService.test.ts',
      'tests/services/historicalOwnerImportCommandService.test.ts',
      'tests/services/historicalOwnerLocalRehearsal.test.ts',
    ]) {
      expect(exists(testPath), testPath).toBe(true);
    }
  });
});
