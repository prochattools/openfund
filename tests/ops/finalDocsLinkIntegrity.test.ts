/**
 * OPS-013 — Final docs link integrity guard.
 *
 * Verifies all local doc/script references in final owner-facing docs actually
 * exist. Does not execute referenced commands.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();

function readDoc(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf-8');
}

const pkg = JSON.parse(readDoc('package.json')) as { scripts: Record<string, string> };

const SOURCE_DOCS = [
  'docs/OWNER_REVIEW_INDEX_NL.md',
  'docs/OWNER_REVIEW_FINAL_PACKET_NL.md',
  'docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md',
  'docs/OWNER_DECISION_MENU_NL.md',
  'docs/OWNER_HANDOFF_NL.md',
  'docs/OWNER_DECISION_PACK_NL.md',
  'docs/OWNER_DECISION_READINESS_MATRIX_NL.md',
  'docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md',
  'docs/POST_APPROVAL_PROMPTS_NL.md',
  'docs/POST_PUSH_VERIFICATION_NL.md',
  'docs/PUSH_READINESS_CHECKLIST_NL.md',
  'docs/SAFE_COMMAND_INVENTORY_NL.md',
  'docs/DECISION_BRIEF_PDF_RENDERER_NL.md',
  'docs/DECISION_BRIEF_POSTGRES_VERSION_NL.md',
  'docs/DECISION_BRIEF_PRODUCTION_CUTOVER_NL.md',
  'docs/DECISION_BRIEF_HISTORICAL_IMPORT_NL.md',
  'docs/DECISION_BRIEF_EMAIL_PROVIDER_NL.md',
  'docs/DECISION_BRIEF_SECRET_ROTATION_NL.md',
  'docs/FINAL_READINESS_AUDIT_NL.md',
  'docs/RELEASE_MANIFEST_NL.md',
];

// These patterns check backtick-quoted path references (must start with a path separator to avoid warning prose)
const FORBIDDEN_BACKTICK_REF_PATTERNS = [
  { pattern: /`[^`]*\.(dump|backup|bak)[^`]*`/i, label: 'dump/backup file reference' },
  { pattern: /`dist\/[^`]+`|`\.next\/[^`]+`|`node_modules\/[^`]+`/i, label: 'build output path reference' },
];

function extractBacktickedDocRefs(content: string): string[] {
  const backtickPattern = /`(docs\/[^\s`]+\.md)`/g;
  const refs = Array.from(content.matchAll(backtickPattern), (match) => match[1]);
  return [...new Set(refs)];
}

function extractBacktickedScriptRefs(content: string): string[] {
  const backtickPattern = /`(scripts\/[^\s`]+\.mjs)`/g;
  const refs = Array.from(content.matchAll(backtickPattern), (match) => match[1]);
  return [...new Set(refs)];
}

function extractNpmScriptRefs(content: string): string[] {
  const npmPattern = /`npm run ([a-z:_-]+)`/g;
  const refs = Array.from(content.matchAll(npmPattern), (match) => match[1]);
  return [...new Set(refs)];
}

describe('final docs link integrity — referenced docs exist', () => {
  for (const sourceDoc of SOURCE_DOCS) {
    it(`all docs/* refs in ${sourceDoc} exist`, () => {
      if (!existsSync(resolve(repoRoot, sourceDoc))) return;
      const content = readDoc(sourceDoc);
      const refs = extractBacktickedDocRefs(content);
      const missing = refs.filter((ref) => !existsSync(resolve(repoRoot, ref)));
      expect(
        missing,
        `Missing doc refs in ${sourceDoc}: ${missing.join(', ')}`,
      ).toHaveLength(0);
    });
  }
});

describe('final docs link integrity — referenced scripts exist', () => {
  for (const sourceDoc of SOURCE_DOCS) {
    it(`all scripts/* refs in ${sourceDoc} exist`, () => {
      if (!existsSync(resolve(repoRoot, sourceDoc))) return;
      const content = readDoc(sourceDoc);
      const refs = extractBacktickedScriptRefs(content);
      const missing = refs.filter((ref) => !existsSync(resolve(repoRoot, ref)));
      expect(
        missing,
        `Missing script refs in ${sourceDoc}: ${missing.join(', ')}`,
      ).toHaveLength(0);
    });
  }
});

describe('final docs link integrity — referenced npm scripts exist in package.json', () => {
  for (const sourceDoc of SOURCE_DOCS) {
    it(`all npm run refs in ${sourceDoc} resolve to package.json scripts`, () => {
      if (!existsSync(resolve(repoRoot, sourceDoc))) return;
      const content = readDoc(sourceDoc);
      const refs = extractNpmScriptRefs(content);
      const missing = refs.filter((ref) => !(ref in pkg.scripts));
      expect(
        missing,
        `Missing npm scripts in ${sourceDoc}: ${missing.join(', ')}`,
      ).toHaveLength(0);
    });
  }
});

describe('final docs link integrity — no forbidden backtick path references', () => {
  for (const sourceDoc of SOURCE_DOCS) {
    it(`${sourceDoc} contains no forbidden backtick path references`, () => {
      if (!existsSync(resolve(repoRoot, sourceDoc))) return;
      const content = readDoc(sourceDoc);
      const found: string[] = [];
      for (const { pattern, label } of FORBIDDEN_BACKTICK_REF_PATTERNS) {
        if (pattern.test(content)) {
          found.push(label);
        }
      }
      expect(found, `Forbidden backtick refs in ${sourceDoc}: ${found.join(', ')}`).toHaveLength(0);
    });
  }
});
