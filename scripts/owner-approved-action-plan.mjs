/**
 * Owner approved action planner for Yeshua Academy Finance.
 *
 * Dry-run plan generator only. It never executes owner-gated actions.
 *
 * Guards:
 * - Does NOT read .env.
 * - Does NOT require network access.
 * - Does NOT connect to any database.
 * - Does NOT call external providers.
 * - Does NOT push, tag, install dependencies, import owner data, send email, or rotate secrets.
 * - Writes docs/OWNER_APPROVED_ACTION_PLAN_NL.md only when --write is supplied.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export const OUTPUT_PATH = 'docs/OWNER_APPROVED_ACTION_PLAN_NL.md';

export const VALID_DECISIONS = [
  'pdf',
  'production-cutover',
  'historical-import',
  'email',
  'push',
  'secret-rotation',
  'postgres-version',
];

const HELP_TEXT = `Yeshua Academy Finance — owner approved action planner

GEBRUIK / USAGE:
  node scripts/owner-approved-action-plan.mjs --help
  node scripts/owner-approved-action-plan.mjs --decision pdf
  node scripts/owner-approved-action-plan.mjs --decision production-cutover
  node scripts/owner-approved-action-plan.mjs --decision historical-import
  node scripts/owner-approved-action-plan.mjs --decision email
  node scripts/owner-approved-action-plan.mjs --decision push
  node scripts/owner-approved-action-plan.mjs --decision secret-rotation
  node scripts/owner-approved-action-plan.mjs --decision postgres-version
  node scripts/owner-approved-action-plan.mjs --decision pdf --write

GUARDS:
  - DRY-RUN PLAN ONLY — GEEN UITVOERING
  - Leest geen .env
  - Raakt geen netwerk, database, productiehost of externe provider
  - Voert geen publicatie, tag, installatie, e-mail, import of secret-rotatie uit
  - Schrijft alleen docs/OWNER_APPROVED_ACTION_PLAN_NL.md met --write`;

const DECISION_PLANS = {
  pdf: {
    title: 'Echte PDF-renderer afgerond',
    approvalEvidence: ['Owner koos pdfkit.', 'Dependencywijziging is uitgevoerd binnen goedgekeurde scope.', 'Evidence is vastgelegd.'],
    preflight: ['node scripts/owner-decision-preflight.mjs --decision pdf', 'npm test -- --test-name-pattern "production blocker"'],
    futurePrompt: 'Geen PDF-prompt meer nodig; zie docs/REAL_PDF_RENDERER_EVIDENCE_NL.md.',
    validation: ['npm test -- --test-name-pattern "report artifact"', 'npm run build:server', 'npm run build', 'git diff --check'],
    rollback: ['Revert PDF dependency en renderer commits.', 'Laat report snapshots ongemoeid.'],
    stopRules: ['Build of rapportartifact-tests falen.', 'Scope raakt echte e-mail of productie.'],
  },
  'production-cutover': {
    title: 'Productiecutover voorbereiden of uitvoeren',
    approvalEvidence: ['Expliciete cutover-goedkeuring.', 'Productie-DB en hostdetails buiten Git.', 'Back-up en rollback zijn goedgekeurd.'],
    preflight: ['node scripts/owner-decision-preflight.mjs --decision production-cutover', 'npm run validate:release-candidate'],
    futurePrompt: 'Gebruik de productiecutover-prompt uit docs/POST_APPROVAL_PROMPTS_NL.md.',
    validation: ['Lokale release-candidate validatie opnieuw.', 'Production dry-run alleen met goedgekeurde gegevens buiten Git.'],
    rollback: ['Gebruik docs/PRODUCTION_CUTOVER_PLAN_NL.md rollback-sectie.', 'Geen force-push of geschiedenis herschrijven.'],
    stopRules: ['Geen productieversie bevestigd.', 'Geen back-up.', 'Geen expliciete owner-goedkeuring.'],
  },
  'historical-import': {
    title: 'Historische productie-import dry-run of uitvoering',
    approvalEvidence: ['Owner-bestanden zijn buiten Git beschikbaar.', 'Dry-run acceptatie is expliciet.', 'Scope voor jaren/periodes is exact.'],
    preflight: ['node scripts/owner-decision-preflight.mjs --decision historical-import', 'npm test -- --test-name-pattern "historical"'],
    futurePrompt: 'Gebruik de historische-importprompt uit docs/POST_APPROVAL_PROMPTS_NL.md.',
    validation: ['Dry-run samenvatting controleren.', 'Bronhashes en controlesaldi vergelijken.', 'Geen owner-bestanden in Git.'],
    rollback: ['Stop vóór productie-import bij enige mismatch.', 'Revert alleen code/docs; owner-bestanden blijven buiten Git.'],
    stopRules: ['Ontbrekende bronhash.', 'Onbalans.', 'Owner-bestand in repo.', 'Productie zonder expliciete token.'],
  },
  email: {
    title: 'Echte e-mailprovider configureren',
    approvalEvidence: ['Providerkeuze goedgekeurd.', 'Secret buiten Git beschikbaar.', 'Dry-run/no-send test akkoord.'],
    preflight: ['node scripts/owner-decision-preflight.mjs --decision email', 'npm test -- --test-name-pattern "report dispatch"'],
    futurePrompt: 'Gebruik de e-mailprompt uit docs/POST_APPROVAL_PROMPTS_NL.md.',
    validation: ['Metadata-only tests blijven slagen.', 'Geen echte verzending vóór aparte send-goedkeuring.'],
    rollback: ['Providerconfig verwijderen.', 'No-op/metadata-only modus herstellen.'],
    stopRules: ['Secret ontbreekt.', 'Echte verzending dreigt zonder toestemming.', 'Provider-call in tests.'],
  },
  push: {
    title: 'Remote publish na owner-goedkeuring',
    approvalEvidence: ['Owner heeft push expliciet goedgekeurd.', 'Branch en commit zijn bevestigd.', 'Worktree is schoon behalve toegestane Graphify-artifacts.'],
    preflight: ['node scripts/push-readiness-preflight.mjs --strict', 'npm run validate:release-candidate'],
    futurePrompt: 'Gebruik de push-prompt uit docs/PUSH_READINESS_CHECKLIST_NL.md.',
    validation: ['git status --short --branch', 'node scripts/push-readiness-preflight.mjs --strict'],
    rollback: ['Geen force-push.', 'Revert commit bij probleem na publicatie.'],
    stopRules: ['Geen expliciete push-goedkeuring.', 'Unexpected dirty files.', 'Validatie faalt.'],
  },
  'secret-rotation': {
    title: 'Geheimen roteren buiten Git',
    approvalEvidence: ['Welke geheimen roteren is exact bepaald.', 'Nieuwe waarden blijven buiten Git.', 'Rollback/eigenaarcontact is beschikbaar.'],
    preflight: ['node scripts/owner-decision-preflight.mjs --decision secret-rotation'],
    futurePrompt: 'Gebruik de secret-rotation prompt uit docs/POST_APPROVAL_PROMPTS_NL.md.',
    validation: ['Geen geheim in Git.', 'Applicatieconfig validatie buiten Git.'],
    rollback: ['Oude geheimen alleen via veilige beheeromgeving herstellen.', 'Geen geheimen in logs of docs.'],
    stopRules: ['Secret zou in Git of output komen.', 'Scope is onduidelijk.'],
  },
  'postgres-version': {
    title: 'PostgreSQL-productieversie bevestigen',
    approvalEvidence: ['Hostingprovider bevestigt versie.', 'Prisma-compatibiliteit is opnieuw gecontroleerd.', 'Cutover blijft apart geblokkeerd.'],
    preflight: ['node scripts/owner-decision-preflight.mjs --decision postgres-version', 'npx prisma validate'],
    futurePrompt: 'Gebruik de PostgreSQL-versieprompt uit docs/POST_APPROVAL_PROMPTS_NL.md.',
    validation: ['Prisma validate/generate lokaal.', 'Geen productieconnectie.'],
    rollback: ['Geen schemawijziging zonder aparte migratie.', 'Documenteer alleen bevestigde versie.'],
    stopRules: ['Versie niet bevestigd.', 'Providerinformatie onzeker.', 'Productieconnectie nodig.'],
  },
};

function readDoc(path, repoRoot) {
  const absolutePath = resolve(repoRoot, path);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf-8') : '';
}

export function buildApprovedActionPlan({ decision = 'pdf', repoRoot = process.cwd() } = {}) {
  if (!VALID_DECISIONS.includes(decision)) {
    return {
      ok: false,
      decision,
      title: 'Onbekende eigenaarsbeslissing',
      missingDocs: [],
      plan: null,
    };
  }

  const requiredDocs = [
    'docs/OWNER_APPROVAL_INTAKE_NL.md',
    'docs/OWNER_DECISION_READINESS_MATRIX_NL.md',
    'docs/OWNER_DECISION_PACK_NL.md',
    'docs/POST_APPROVAL_PROMPTS_NL.md',
    'docs/OWNER_HANDOFF_NL.md',
    'docs/RELEASE_MANIFEST_NL.md',
  ];
  const missingDocs = requiredDocs.filter((path) => !existsSync(resolve(repoRoot, path)));
  const manifest = readDoc('docs/RELEASE_MANIFEST_NL.md', repoRoot);

  return {
    ok: missingDocs.length === 0,
    decision,
    title: DECISION_PLANS[decision].title,
    missingDocs,
    plan: DECISION_PLANS[decision],
    releaseStatus: manifest.includes('Release Candidate') ? 'Release-evidence aanwezig' : 'Release-evidence ontbreekt',
  };
}

function list(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

export function renderApprovedActionPlan(result) {
  if (!result.ok && !result.plan) {
    return `# Yeshua Academy Finance — Owner-approved action plan\n\nDRY-RUN PLAN ONLY — GEEN UITVOERING\n\nOnbekende beslissing: \`${result.decision}\`\n\nGeldige beslissingen: ${VALID_DECISIONS.join(', ')}\n`;
  }

  const plan = result.plan;
  return `# Yeshua Academy Finance — Owner-approved action plan\n\nDRY-RUN PLAN ONLY — GEEN UITVOERING\nTaal: Nederlands\nBeslissing: \`${result.decision}\`\nTitel: ${result.title}\nStatus: ${result.ok ? 'PLAN GEREED VOOR REVIEW' : 'PLAN ONVOLLEDIG — DOCUMENTEN ONTBREKEN'}\nRelease-status: ${result.releaseStatus}\n\n## Guards\n\n- Dit script leest geen \`.env\`.\n- Dit script gebruikt geen netwerk, database, productiehost of externe provider.\n- Dit script voert geen publicatie, tag, dependency-installatie, e-mail, import of secret-rotatie uit.\n- Dit script schrijft alleen \`docs/OWNER_APPROVED_ACTION_PLAN_NL.md\` wanneer \`--write\` is meegegeven.\n\n## Ontbrekende documenten\n\n${result.missingDocs.length ? list(result.missingDocs) : '- Geen'}\n\n## Vereiste approval evidence\n\n${list(plan.approvalEvidence)}\n\n## Vereiste preflights\n\n${list(plan.preflight)}\n\n## Exacte toekomstige prompt/uitvoering\n\n- ${plan.futurePrompt}\n\n## Validatiepoorten\n\n${list(plan.validation)}\n\n## Rollback\n\n${list(plan.rollback)}\n\n## Stopregels\n\n${list(plan.stopRules)}\n`;
}

function parseArgs(argv) {
  const args = new Set(argv);
  const decisionIndex = argv.indexOf('--decision');
  return {
    help: args.has('--help') || args.has('-h'),
    write: args.has('--write'),
    decision: decisionIndex >= 0 ? argv[decisionIndex + 1] : 'pdf',
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(HELP_TEXT);
    return 0;
  }

  const result = buildApprovedActionPlan({ decision: args.decision });
  const output = renderApprovedActionPlan(result);
  if (args.write) {
    writeFileSync(resolve(process.cwd(), OUTPUT_PATH), output);
  }
  console.log(output);
  return result.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}
