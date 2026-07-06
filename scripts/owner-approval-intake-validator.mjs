/**
 * Owner approval intake validator for Yeshua Academy Finance.
 *
 * Static guidance generator only. It does not execute owner-gated actions,
 * read .env, use network, connect to a database, mutate remote state, install
 * dependencies, send email, import data, rotate secrets, or touch production.
 * It writes docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md only with --write.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

export const OUTPUT_PATH = 'docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md';

export const VALID_DECISIONS = [
  'pdf',
  'postgres-version',
  'production-cutover',
  'historical-import',
  'email',
  'secret-rotation',
  'push',
];

export const DECISION_GUIDANCE = {
  pdf: {
    label: 'PDF-renderer',
    minimumFields: [
      'Gekozen bibliotheeknaam.',
      'Licentie- en runtime-impact akkoord.',
      'Dependencywijziging expliciet toegestaan.',
      'Rollback-eigenaar bevestigd.',
    ],
    forbiddenAmbiguousApprovals: [
      'Maak PDF maar zonder bibliotheekkeuze.',
      'Installeer wat nodig is.',
      'Maak het live zonder validatie.',
    ],
    preflightCommands: [
      'node scripts/owner-decision-preflight.mjs --decision pdf',
      'node scripts/owner-approved-action-plan.mjs --decision pdf',
    ],
    validationCommands: [
      'npm test -- --test-name-pattern "report artifact"',
      'npm run build:server',
      'npm run build',
      'git diff --check',
    ],
    stopRules: [
      'Stop bij ontbrekende bibliotheekkeuze.',
      'Stop bij dependency-, licentie-, build- of testtwijfel.',
    ],
    evidenceToReport: [
      'Bibliotheeknaam.',
      'Commit hash.',
      'Test/build/high-risk scan resultaten.',
      'Finale git status.',
    ],
  },
  'postgres-version': {
    label: 'PostgreSQL-versiebevestiging',
    minimumFields: [
      'Provider/eigenaar bevestigt major/minor versie buiten Git.',
      'Bronsoort en datum zijn bekend.',
      'Prisma-compatibiliteit is beoordeeld.',
      'Cutover blijft apart geblokkeerd.',
    ],
    forbiddenAmbiguousApprovals: [
      'Controleer productie maar gebruik geen details.',
      'Neem aan dat de versie goed is.',
      'Ga door met cutover.',
    ],
    preflightCommands: [
      'node scripts/owner-decision-preflight.mjs --decision postgres-version',
      'npx prisma validate',
    ],
    validationCommands: [
      'npx prisma validate',
      'npx prisma generate',
      'node scripts/final-docs-consistency-audit.mjs',
    ],
    stopRules: [
      'Stop bij onbekende versie.',
      'Stop bij productieconnection string in input.',
      'Stop bij incompatibiliteit.',
    ],
    evidenceToReport: [
      'Bevestigde versie, zonder secrets.',
      'Compatibiliteitsbeoordeling.',
      'Docs audit resultaat.',
      'Finale git status.',
    ],
  },
  'production-cutover': {
    label: 'Productiecutover',
    minimumFields: [
      'Expliciete scope: voorbereiding-only of uitvoering.',
      'Back-upvenster bevestigd.',
      'Rollback-eigenaar bevestigd.',
      'Productiegegevens blijven buiten Git.',
    ],
    forbiddenAmbiguousApprovals: [
      'Zet productie maar over.',
      'Gebruik de bekende gegevens.',
      'Voer alles uit wat nodig is.',
    ],
    preflightCommands: [
      'node scripts/owner-decision-preflight.mjs --decision production-cutover',
      'node scripts/owner-approved-action-plan.mjs --decision production-cutover',
      'npm run validate:release-candidate',
    ],
    validationCommands: [
      'npm test',
      'npm run build:server',
      'npm run build',
      'npx prisma validate',
      'git diff --check',
    ],
    stopRules: [
      'Stop bij ontbrekende back-up.',
      'Stop bij ontbrekende rollback-eigenaar.',
      'Stop bij secret in output.',
    ],
    evidenceToReport: [
      'Goedgekeurde cutover scope.',
      'Preflight resultaten.',
      'Rollback readiness.',
      'Gesanitiseerde status.',
    ],
  },
  'historical-import': {
    label: 'Historische import',
    minimumFields: [
      'Periodes/jaren exact in scope.',
      'Owner-bestanden blijven buiten Git.',
      'Hashes en control totals zijn bekend.',
      'Dry-run acceptatie is vereist vóór write.',
    ],
    forbiddenAmbiguousApprovals: [
      'Importeer de historische bestanden.',
      'Gebruik de bestanden die je vindt.',
      'Schrijf direct naar productie.',
    ],
    preflightCommands: [
      'node scripts/owner-decision-preflight.mjs --decision historical-import',
      'npm test -- --test-name-pattern "historical"',
    ],
    validationCommands: [
      'npm test -- --test-name-pattern "production blocker"',
      'npm test -- --test-name-pattern "historical"',
      'git diff --check',
    ],
    stopRules: [
      'Stop bij owner-bestanden binnen repo.',
      'Stop bij hash mismatch.',
      'Stop bij ruwe rijen in output.',
    ],
    evidenceToReport: [
      'Gesanitiseerde totalen.',
      'Hash/control-total status.',
      'Dry-run acceptatie.',
      'Finale git status.',
    ],
  },
  email: {
    label: 'E-mailprovider',
    minimumFields: [
      'Providerkeuze.',
      'Secretbeheer buiten Git.',
      'No-send of send-scope exact bevestigd.',
      'Testontvangers goedgekeurd.',
    ],
    forbiddenAmbiguousApprovals: [
      'Zet e-mail aan.',
      'Gebruik een provider naar keuze.',
      'Stuur een test zonder ontvangerscope.',
    ],
    preflightCommands: [
      'node scripts/owner-decision-preflight.mjs --decision email',
      'node scripts/owner-approved-action-plan.mjs --decision email',
    ],
    validationCommands: [
      'npm test -- --test-name-pattern "report dispatch"',
      'npm test -- --test-name-pattern "production blocker"',
      'npm run build:server',
    ],
    stopRules: [
      'Stop bij secret in diff of output.',
      'Stop bij echte verzending zonder send-go.',
      'Stop bij provider-call in preflight.',
    ],
    evidenceToReport: [
      'No-send/send scope.',
      'Dispatch test resultaten.',
      'Secret redaction confirmation.',
      'Finale git status.',
    ],
  },
  'secret-rotation': {
    label: 'Secret rotation',
    minimumFields: [
      'Exacte secretlijst buiten Git.',
      'Beheerlocatie buiten Git.',
      'Rollback-eigenaar.',
      'Validatieplan zonder secret-output.',
    ],
    forbiddenAmbiguousApprovals: [
      'Roteer alle secrets.',
      'Werk .env bij.',
      'Print de nieuwe waarden ter controle.',
    ],
    preflightCommands: [
      'node scripts/owner-decision-preflight.mjs --decision secret-rotation',
      'git diff --check',
    ],
    validationCommands: [
      'npm test -- --test-name-pattern "production blocker"',
      'git diff --check',
    ],
    stopRules: [
      'Stop bij secret in diff of output.',
      'Stop bij .env wijziging.',
      'Stop bij onduidelijke secret scope.',
    ],
    evidenceToReport: [
      'Gesanitiseerde rotatiestatus.',
      'Validatieresultaten.',
      'Rollback readiness.',
      'Finale git status.',
    ],
  },
  push: {
    label: 'Remote publish',
    minimumFields: [
      'Exacte push-goedkeuring.',
      'Doelremote en branch.',
      'Commit hash.',
      'Validatie opnieuw gedraaid.',
    ],
    forbiddenAmbiguousApprovals: [
      'Publiceer alles.',
      'Push wanneer klaar.',
      'Maak ook een tag.',
    ],
    preflightCommands: [
      'npm run preflight:push-readiness',
      'npm run validate:release-candidate',
    ],
    validationCommands: [
      'git status --short --branch',
      'npm run preflight:push-readiness',
      'npm run validate:release-candidate',
    ],
    stopRules: [
      'Stop bij onverwachte dirty files.',
      'Stop bij falende validatie.',
      'Stop bij tag- of force-scope.',
    ],
    evidenceToReport: [
      'Remote en branch.',
      'Pushed commit hash.',
      'Validatieresultaten.',
      'Finale git status.',
    ],
  },
};

const HELP_TEXT = `Yeshua Academy Finance — owner approval intake validator

GEBRUIK / USAGE:
  node scripts/owner-approval-intake-validator.mjs --help
  node scripts/owner-approval-intake-validator.mjs
  node scripts/owner-approval-intake-validator.mjs --decision pdf
  node scripts/owner-approval-intake-validator.mjs --decision postgres-version
  node scripts/owner-approval-intake-validator.mjs --decision production-cutover
  node scripts/owner-approval-intake-validator.mjs --decision historical-import
  node scripts/owner-approval-intake-validator.mjs --decision email
  node scripts/owner-approval-intake-validator.mjs --decision secret-rotation
  node scripts/owner-approval-intake-validator.mjs --decision push
  node scripts/owner-approval-intake-validator.mjs --json
  node scripts/owner-approval-intake-validator.mjs --write

GUARDS:
  - Static guidance only
  - Leest geen .env
  - Geen netwerk, database, productiehost of externe provider
  - Geen push, tag, dependency-installatie, e-mail, import of secret rotation
  - Schrijft alleen docs/OWNER_APPROVAL_INTAKE_VALIDATION_NL.md met --write`;

function list(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function parseArgs(argv) {
  const decisionIndex = argv.indexOf('--decision');
  return {
    help: argv.includes('--help') || argv.includes('-h'),
    json: argv.includes('--json'),
    write: argv.includes('--write'),
    decision: decisionIndex >= 0 ? argv[decisionIndex + 1] : null,
  };
}

export function buildApprovalIntakeValidation({ decision = null } = {}) {
  if (decision && !VALID_DECISIONS.includes(decision)) {
    return {
      ok: false,
      status: 'UNKNOWN_DECISION',
      decision,
      decisions: [],
      error: `Onbekende beslissing: ${decision}`,
    };
  }

  const selected = decision ? [decision] : VALID_DECISIONS;
  return {
    ok: true,
    status: 'OWNER_APPROVAL_INTAKE_VALIDATION_READY',
    decision: decision ?? 'all',
    guards: [
      'Deze validator voert geen owner-gated actie uit.',
      'Deze validator leest geen .env.',
      'Deze validator gebruikt geen netwerk, database, productiehost of externe provider.',
      'Deze validator schrijft alleen het validatiedocument wanneer --write is meegegeven.',
    ],
    decisions: selected.map((key) => ({
      key,
      ...DECISION_GUIDANCE[key],
    })),
  };
}

export function renderApprovalIntakeValidation(result) {
  if (!result.ok) {
    return `# Yeshua Academy Finance — Owner approval intake validation\n\nStatus: ONBEKENDE BESLISSING\n\n${result.error}\n\nGeldige beslissingen: ${VALID_DECISIONS.join(', ')}\n`;
  }

  const lines = [
    '# Yeshua Academy Finance — Owner approval intake validation',
    '',
    'Status: gereed voor statische owner-approval beoordeling — geen uitvoering',
    'Taal: Nederlands',
    '',
    '## Guards',
    '',
    list(result.guards),
    '',
    '## Beslissingen',
  ];

  for (const decision of result.decisions) {
    lines.push('');
    lines.push(`### ${decision.label}`);
    lines.push('');
    lines.push(`Sleutel: \`${decision.key}\``);
    lines.push('');
    lines.push('Minimum required approval fields:');
    lines.push(list(decision.minimumFields));
    lines.push('');
    lines.push('Forbidden ambiguous approvals:');
    lines.push(list(decision.forbiddenAmbiguousApprovals));
    lines.push('');
    lines.push('Required preflight commands:');
    lines.push(list(decision.preflightCommands));
    lines.push('');
    lines.push('Required validation commands:');
    lines.push(list(decision.validationCommands));
    lines.push('');
    lines.push('Stop rules:');
    lines.push(list(decision.stopRules));
    lines.push('');
    lines.push('Evidence to report back:');
    lines.push(list(decision.evidenceToReport));
  }

  lines.push('');
  lines.push('## Bevestiging');
  lines.push('');
  lines.push('- Deze validator voert niets uit.');
  lines.push('- Deze validator registreert geen approval in Git.');
  lines.push('- Owner-gated acties blijven geblokkeerd tot een aparte expliciete prompt.');

  return `${lines.join('\n')}\n`;
}

export function main(argv = process.argv.slice(2), options = {}) {
  const stdout = options.stdout ?? process.stdout;
  const repoRoot = options.repoRoot ?? process.cwd();
  const args = parseArgs(argv);

  if (args.help) {
    stdout.write(`${HELP_TEXT}\n`);
    return 0;
  }

  const result = buildApprovalIntakeValidation({ decision: args.decision });
  if (args.json) {
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }

  const output = renderApprovalIntakeValidation(result);
  if (args.write && result.ok) {
    const outputFile = resolve(repoRoot, OUTPUT_PATH);
    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, output, 'utf-8');
    stdout.write(`Geschreven naar ${OUTPUT_PATH}\n`);
    return 0;
  }

  stdout.write(output);
  return result.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}
