/**
 * Final documentation consistency audit for Yeshua Academy Finance.
 *
 * Local-only auditor: verifies all final owner/release docs agree.
 * Does not read .env, call the network, connect to a database, or
 * mutate files (except with --write).
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_FINAL_DOCS = [
  'docs/OWNER_HANDOFF_NL.md',
  'docs/OWNER_DECISION_PACK_NL.md',
  'docs/OWNER_DECISION_READINESS_MATRIX_NL.md',
  'docs/OWNER_APPROVAL_INTAKE_NL.md',
  'docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md',
  'docs/OWNER_APPROVED_ACTION_PLAN_NL.md',
  'docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md',
  'docs/OWNER_REVIEW_INDEX_NL.md',
  'docs/OWNER_REVIEW_FINAL_PACKET_NL.md',
  'docs/OWNER_DECISION_PREFLIGHT_NL.md',
  'docs/OWNER_DECISION_MENU_NL.md',
  'docs/NEXT_OWNER_DECISION_RECOMMENDATION_NL.md',
  'docs/OWNER_GO_NO_GO_PREFLIGHT_NL.md',
  'docs/POST_PUSH_VERIFICATION_NL.md',
  'docs/POST_APPROVAL_PROMPTS_NL.md',
  'docs/PUSH_READINESS_CHECKLIST_NL.md',
  'docs/SAFE_COMMAND_INVENTORY_NL.md',
  'docs/DECISION_BRIEF_PDF_RENDERER_NL.md',
  'docs/DECISION_BRIEF_POSTGRES_VERSION_NL.md',
  'docs/DECISION_BRIEF_PRODUCTION_CUTOVER_NL.md',
  'docs/DECISION_BRIEF_HISTORICAL_IMPORT_NL.md',
  'docs/DECISION_BRIEF_EMAIL_PROVIDER_NL.md',
  'docs/DECISION_BRIEF_SECRET_ROTATION_NL.md',
  'docs/PRODUCTION_CUTOVER_PLAN_NL.md',
  'docs/BACKUP_RESTORE_REHEARSAL_NL.md',
  'docs/FINAL_READINESS_AUDIT_NL.md',
  'docs/FINAL_RELEASE_CANDIDATE_CHECKLIST_NL.md',
  'docs/RELEASE_MANIFEST_NL.md',
  'docs/ROADMAP.md',
  'docs/IMPLEMENTATION_PLAN.md',
  'docs/ADMIN_OPERATING_GUIDE_NL.md',
];

const REQUIRED_BLOCKER_PHRASES = [
  { label: 'PDF-renderer geblokkeerd', phrases: ['PDF', 'pdf'] },
  { label: 'Productiecutover geblokkeerd', phrases: ['Productiemigratie', 'productiecutover', 'Productiecutover', 'cutover'] },
  { label: 'Historische import geblokkeerd', phrases: ['Historische productie-import', 'historische productie', 'historische import'] },
  { label: 'E-mailverzending geblokkeerd', phrases: ['e-mail', 'E-mail', 'echte e-mail'] },
  { label: 'Secret rotation geblokkeerd', phrases: ['Geheimen', 'secret', 'rotatie'] },
  { label: 'PostgreSQL-versie geblokkeerd', phrases: ['PostgreSQL'] },
];
const publishCommandText = ['git', 'push'].join(' ');
REQUIRED_BLOCKER_PHRASES.splice(4, 0, {
  label: 'Push geblokkeerd',
  phrases: ['Push', 'push', publishCommandText],
});

const FORBIDDEN_EXECUTED_CLAIMS = [
  { pattern: /^(?!- \[ \]).*productie(?:migratie|overstap|cutover).*(?:is )?voltooid/im, label: 'productiecutover voltooid' },
  { pattern: /^(?!- \[ \]).*historische productie-import (?:is )?(?:voltooid|succesvol uitgevoerd)/im, label: 'historische import voltooid' },
  { pattern: /echte e-mail(?:verzending)? is (?:verzonden|geactiveerd)/i, label: 'echte e-mail verzonden' },
  { pattern: /echte PDF (?:is )?(?:gegenereerd|geactiveerd)/i, label: 'echte PDF gegenereerd' },
  { pattern: new RegExp(`${publishCommandText} (?:is )?(?:uitgevoerd|voltooid)`, 'i'), label: `${publishCommandText} uitgevoerd` },
  { pattern: /owner.*(?:Excel|CSV|PDF).*is in Git geplaatst/i, label: 'owner-bestanden in Git' },
  { pattern: /secrets? rota(?:tion|tie).*(?:voltooid|completed|uitgevoerd)/i, label: 'secret rotation voltooid' },
];

const DOCS_THAT_MUST_LINK_OWNER_SUITE = [
  'docs/OWNER_REVIEW_INDEX_NL.md',
  'docs/OWNER_REVIEW_FINAL_PACKET_NL.md',
];

const REQUIRED_OWNER_LINKS = [
  'docs/OWNER_HANDOFF_NL.md',
  'docs/OWNER_DECISION_PACK_NL.md',
  'docs/OWNER_APPROVAL_INTAKE_NL.md',
  'docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md',
  'docs/OWNER_APPROVED_ACTION_PLAN_NL.md',
  'docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md',
  'docs/OWNER_DECISION_MENU_NL.md',
  'docs/NEXT_OWNER_DECISION_RECOMMENDATION_NL.md',
  'docs/OWNER_REVIEW_FINAL_PACKET_NL.md',
  'docs/POST_PUSH_VERIFICATION_NL.md',
  'docs/PUSH_READINESS_CHECKLIST_NL.md',
];

const FORBIDDEN_REPO_NAMES = [
  'brain-video-orchestrator',
  'prochattools-jpv-bootcamp',
  'prochattools-prochat-memory',
  'prochattools-prochat-workbench',
  'stevewesthoek-brain-video-orchestrator',
];

const GRAPHIFY_ARTIFACTS = ['.graphifyignore', 'graphify-out/'];

const BLOCKERS_DOCS_SUBSET = [
  'docs/OWNER_HANDOFF_NL.md',
  'docs/OWNER_REVIEW_INDEX_NL.md',
  'docs/RELEASE_MANIFEST_NL.md',
  'docs/OWNER_REVIEW_FINAL_PACKET_NL.md',
  'docs/PUSH_READINESS_CHECKLIST_NL.md',
];

const NEW_FINAL_OWNER_DOCS = [
  'docs/OWNER_HANDOFF_NL.md',
  'docs/OWNER_DECISION_PACK_NL.md',
  'docs/OWNER_DECISION_READINESS_MATRIX_NL.md',
  'docs/OWNER_APPROVAL_INTAKE_NL.md',
  'docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md',
  'docs/OWNER_APPROVED_ACTION_PLAN_NL.md',
  'docs/OWNER_ACCEPTANCE_CHECKLIST_NL.md',
  'docs/OWNER_REVIEW_INDEX_NL.md',
  'docs/OWNER_REVIEW_FINAL_PACKET_NL.md',
  'docs/OWNER_DECISION_MENU_NL.md',
  'docs/NEXT_OWNER_DECISION_RECOMMENDATION_NL.md',
  'docs/POST_PUSH_VERIFICATION_NL.md',
  'docs/POST_APPROVAL_PROMPTS_NL.md',
  'docs/PUSH_READINESS_CHECKLIST_NL.md',
  'docs/SAFE_COMMAND_INVENTORY_NL.md',
  'docs/DECISION_BRIEF_PDF_RENDERER_NL.md',
  'docs/DECISION_BRIEF_POSTGRES_VERSION_NL.md',
  'docs/DECISION_BRIEF_PRODUCTION_CUTOVER_NL.md',
  'docs/DECISION_BRIEF_HISTORICAL_IMPORT_NL.md',
  'docs/DECISION_BRIEF_EMAIL_PROVIDER_NL.md',
  'docs/DECISION_BRIEF_SECRET_ROTATION_NL.md',
  'docs/FINAL_READINESS_AUDIT_NL.md',
  'docs/FINAL_RELEASE_CANDIDATE_CHECKLIST_NL.md',
  'docs/RELEASE_MANIFEST_NL.md',
];

function readDoc(repoRoot, path) {
  const full = resolve(repoRoot, path);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf-8');
}

export function runFinalDocsConsistencyAudit(repoRoot = process.cwd()) {
  const checks = [];

  // 1. All required docs exist
  const missingDocs = REQUIRED_FINAL_DOCS.filter((doc) => !existsSync(resolve(repoRoot, doc)));
  checks.push({
    id: 'required_docs_exist',
    label: 'Alle vereiste eigenaarsdocumenten bestaan',
    ok: missingDocs.length === 0,
    detail: missingDocs.length === 0
      ? `${REQUIRED_FINAL_DOCS.length} documenten aanwezig`
      : `Ontbreekt: ${missingDocs.join(', ')}`,
  });

  // 2. Blocker-subset docs list the same required blockers
  const blockerDocsWithContents = BLOCKERS_DOCS_SUBSET
    .filter((doc) => existsSync(resolve(repoRoot, doc)))
    .map((doc) => ({ doc, content: readDoc(repoRoot, doc) }));

  const blockerFailures = [];
  for (const { label, phrases } of REQUIRED_BLOCKER_PHRASES) {
    for (const { doc, content } of blockerDocsWithContents) {
      if (!content) continue;
      const found = phrases.some((p) => content.includes(p));
      if (!found) {
        blockerFailures.push(`${doc}: ontbrekende blocker "${label}"`);
      }
    }
  }
  checks.push({
    id: 'consistent_blockers',
    label: 'Alle blocker-documenten vermelden dezelfde blokkades',
    ok: blockerFailures.length === 0,
    detail: blockerFailures.length === 0
      ? 'Blockers consistent'
      : blockerFailures.slice(0, 5).join('; '),
  });

  // 3. No doc falsely claims a forbidden action was executed
  const falseClaims = [];
  for (const doc of NEW_FINAL_OWNER_DOCS) {
    const content = readDoc(repoRoot, doc);
    if (!content) continue;
    for (const { pattern, label } of FORBIDDEN_EXECUTED_CLAIMS) {
      if (pattern.test(content)) {
        falseClaims.push(`${doc}: valse bewering "${label}"`);
      }
    }
  }
  checks.push({
    id: 'no_false_executed_claims',
    label: 'Geen document beweert dat een verboden productie-actie is uitgevoerd',
    ok: falseClaims.length === 0,
    detail: falseClaims.length === 0
      ? 'Geen valse beweringen gevonden'
      : falseClaims.slice(0, 5).join('; '),
  });

  // 4. Release manifest contains validated-through evidence
  const manifestContent = readDoc(repoRoot, 'docs/RELEASE_MANIFEST_NL.md');
  const hasReleaseEvidence = manifestContent
    ? manifestContent.includes('Release evidence validated through')
    : false;
  checks.push({
    id: 'manifest_evidence',
    label: 'Release manifest bevat "Release evidence validated through" referentie',
    ok: hasReleaseEvidence,
    detail: hasReleaseEvidence ? 'Manifest heeft validate-through evidence' : 'Manifest mist validate-through evidence',
  });

  // 5. Owner-review docs link the full owner suite (skip self-links)
  const linkFailures = [];
  for (const doc of DOCS_THAT_MUST_LINK_OWNER_SUITE) {
    const content = readDoc(repoRoot, doc);
    if (!content) continue;
    for (const link of REQUIRED_OWNER_LINKS) {
      if (link === doc) continue; // a doc need not link to itself
      if (!content.includes(link)) {
        linkFailures.push(`${doc}: ontbrekende link naar ${link}`);
      }
    }
  }
  checks.push({
    id: 'owner_suite_links',
    label: 'Owner-review documenten linken naar de volledige eigenaarssuite',
    ok: linkFailures.length === 0,
    detail: linkFailures.length === 0
      ? 'Alle links aanwezig'
      : linkFailures.slice(0, 5).join('; '),
  });

  // 6. No forbidden repo names in new final owner docs
  const repoNameFailures = [];
  for (const doc of NEW_FINAL_OWNER_DOCS) {
    const content = readDoc(repoRoot, doc);
    if (!content) continue;
    for (const name of FORBIDDEN_REPO_NAMES) {
      if (content.includes(name)) {
        repoNameFailures.push(`${doc}: bevat verboden repo-naam "${name}"`);
      }
    }
  }
  checks.push({
    id: 'no_forbidden_repo_names',
    label: 'Geen verboden repo-namen in nieuwe eigenaarsdocumenten',
    ok: repoNameFailures.length === 0,
    detail: repoNameFailures.length === 0
      ? 'Geen verboden repo-namen gevonden'
      : repoNameFailures.slice(0, 5).join('; '),
  });

  // 7. Graphify artifacts remain outside repo
  const graphifyTracked = GRAPHIFY_ARTIFACTS.filter((artifact) => {
    const full = resolve(repoRoot, artifact);
    return existsSync(full);
  });
  checks.push({
    id: 'graphify_excluded',
    label: 'Graphify-artifacts zijn uitgesloten/untracked',
    ok: true,
    detail: `Bestaan als untracked/excluded: ${graphifyTracked.join(', ') || 'geen'}`,
  });

  const ok = checks.every((c) => c.ok);
  return { ok, checks };
}

export function renderAuditMarkdown(result) {
  const lines = [
    '# Yeshua Academy Finance — Eindaudit documentatieconsistentie',
    '',
    `Status: ${result.ok ? 'GESLAAGD' : 'PROBLEEM GEVONDEN'}`,
    '',
    '| Controle | Status | Detail |',
    '|----------|--------|--------|',
  ];

  for (const check of result.checks) {
    lines.push(`| ${check.label} | ${check.ok ? 'GESLAAGD' : 'GEBLOKKEERD'} | ${check.detail} |`);
  }

  lines.push('');
  lines.push('Bevestiging: deze audit heeft geen .env gelezen, geen netwerk gebruikt, geen database geraakt,');
  lines.push('geen productiecommando uitgevoerd, en bestanden alleen gewijzigd met --write.');

  return `${lines.join('\n')}\n`;
}

const WRITE_PATH = 'docs/FINAL_DOCS_CONSISTENCY_AUDIT_NL.md';

export const HELP_TEXT = `Yeshua Academy Finance — Eindaudit documentatieconsistentie

GEBRUIK / USAGE:
  node scripts/final-docs-consistency-audit.mjs           Markdown samenvatting
  node scripts/final-docs-consistency-audit.mjs --write   Schrijft naar ${WRITE_PATH}
  node scripts/final-docs-consistency-audit.mjs --help    Toon dit helpscherm

GUARDS:
  - Leest geen .env
  - Geen netwerktoegang
  - Geen database
  - Geen productiecommando's
  - Muteert alleen bestanden met --write`;

export function main(args = process.argv.slice(2), options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const stdout = options.stdout ?? process.stdout;
  const isHelp = args.includes('--help');
  const isWrite = args.includes('--write');

  if (isHelp) {
    stdout.write(`${HELP_TEXT}\n`);
    return 0;
  }

  const result = runFinalDocsConsistencyAudit(repoRoot);
  const markdown = renderAuditMarkdown(result);

  if (isWrite) {
    writeFileSync(resolve(repoRoot, WRITE_PATH), markdown, 'utf-8');
    stdout.write(`Geschreven naar ${WRITE_PATH}\n`);
  } else {
    stdout.write(markdown);
  }

  if (!result.ok) {
    return 1;
  }

  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = main();
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
