/**
 * Static owner decision menu for Yeshua Academy Finance.
 *
 * Local-only menu generator. It does not read .env, use network, connect to a
 * database, install dependencies, push, tag, send email, import data, or touch
 * production. It writes docs/OWNER_DECISION_MENU_NL.md only with --write.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

export const OUTPUT_PATH = 'docs/OWNER_DECISION_MENU_NL.md';

export const DECISION_MENU = [
  {
    key: 'pdf',
    label: 'Echte PDF-renderer',
    status: 'GEBLOKKEERD TOT EXPLICIETE PDF-GOEDKEURING',
    requiredApproval: 'Owner kiest de PDF-bibliotheek en keurt dependency, licentie en runtime-impact goed.',
    safePreflightCommand: 'node scripts/owner-decision-preflight.mjs --decision pdf',
    nextPromptDoc: 'docs/POST_APPROVAL_PROMPTS_NL.md',
    stopRules: [
      'Stop bij ontbrekende bibliotheekkeuze.',
      'Stop bij dependency- of licentietwijfel.',
      'Stop als echte PDF-output wordt gevraagd zonder aparte approval.',
    ],
  },
  {
    key: 'production-cutover',
    label: 'Productiecutover',
    status: 'GEBLOKKEERD TOT EXPLICIETE CUTOVER-GOEDKEURING',
    requiredApproval: 'Owner keurt cutover-scope, backupvenster, rollback-eigenaar en productiegegevens buiten Git goed.',
    safePreflightCommand: 'node scripts/owner-decision-preflight.mjs --decision production-cutover',
    nextPromptDoc: 'docs/POST_APPROVAL_PROMPTS_NL.md',
    stopRules: [
      'Stop bij ontbrekende backup- of rollbackbevestiging.',
      'Stop bij productiecredentials in Git of output.',
      'Stop bij non-local DB in een local-only stap.',
    ],
  },
  {
    key: 'historical-import',
    label: 'Historische productie-import',
    status: 'GEBLOKKEERD TOT OWNER-FILES EN DRY-RUN ACCEPTATIE ZIJN GOEDGEKEURD',
    requiredApproval: 'Owner levert bronbestanden buiten Git, verwachte hashes en dry-run acceptatie.',
    safePreflightCommand: 'node scripts/owner-decision-preflight.mjs --decision historical-import',
    nextPromptDoc: 'docs/POST_APPROVAL_PROMPTS_NL.md',
    stopRules: [
      'Stop bij owner-bestanden binnen de repo.',
      'Stop bij hash mismatch of onbalans.',
      'Stop als productie-import wordt gevraagd zonder aparte owner-go.',
    ],
  },
  {
    key: 'email',
    label: 'Echte e-mailverzending',
    status: 'GEBLOKKEERD TOT PROVIDER, SECRET EN SEND-GOEDKEURING ZIJN GOEDGEKEURD',
    requiredApproval: 'Owner keurt provider, domein, secretbeheer buiten Git, testontvangers en send-scope goed.',
    safePreflightCommand: 'node scripts/owner-decision-preflight.mjs --decision email',
    nextPromptDoc: 'docs/POST_APPROVAL_PROMPTS_NL.md',
    stopRules: [
      'Stop bij ontbrekende provider-goedkeuring.',
      'Stop bij geheim in diff of output.',
      'Stop bij echte verzending zonder expliciete send-go.',
    ],
  },
  {
    key: 'push',
    label: 'Push naar remote',
    status: 'GEBLOKKEERD TOT EXPLICIETE PUSH-GOEDKEURING',
    requiredApproval: 'Owner bevestigt remote, branch, commit, validaties en publicatie zonder tags of force.',
    safePreflightCommand: 'node scripts/push-readiness-preflight.mjs --strict',
    nextPromptDoc: 'docs/PUSH_READINESS_CHECKLIST_NL.md',
    stopRules: [
      'Stop bij onverwachte dirty files.',
      'Stop bij falende release-candidate validatie.',
      'Stop bij ontbrekende expliciete push-goedkeuring.',
    ],
  },
  {
    key: 'secret-rotation',
    label: 'Secret rotation',
    status: 'GEBLOKKEERD TOT VAULT- EN CUTOVER-SCOPE BUITEN GIT ZIJN GOEDGEKEURD',
    requiredApproval: 'Owner bepaalt welke geheimen buiten Git roteren, waar ze worden beheerd en wat de rollback is.',
    safePreflightCommand: 'node scripts/owner-decision-preflight.mjs --decision secret-rotation',
    nextPromptDoc: 'docs/POST_APPROVAL_PROMPTS_NL.md',
    stopRules: [
      'Stop bij geheim in Git, docs of output.',
      'Stop bij `.env` wijziging.',
      'Stop bij ontbrekende vault-bestemming.',
    ],
  },
  {
    key: 'postgres-version',
    label: 'Productie PostgreSQL-versie bevestigen',
    status: 'GEBLOKKEERD TOT HOSTINGVERSIE BUITEN GIT IS BEVESTIGD',
    requiredApproval: 'Owner bevestigt major/minor versie uit hostingdashboard en Prisma-compatibiliteit buiten Git.',
    safePreflightCommand: 'node scripts/owner-decision-preflight.mjs --decision postgres-version',
    nextPromptDoc: 'docs/POST_APPROVAL_PROMPTS_NL.md',
    stopRules: [
      'Stop bij onbekende productieversie.',
      'Stop bij productie-DB URL in lokale commands.',
      'Stop bij incompatibiliteit of onzeker providerbewijs.',
    ],
  },
];

export const HELP_TEXT = `Yeshua Academy Finance — owner decision menu

GEBRUIK / USAGE:
  node scripts/owner-decision-menu.mjs --help
  node scripts/owner-decision-menu.mjs
  node scripts/owner-decision-menu.mjs --json
  node scripts/owner-decision-menu.mjs --write

GUARDS:
  - Leest geen .env
  - Geen netwerk, database, productiehost of externe provider
  - Geen push, tag, dependency-installatie, e-mail, import of secret rotation
  - Schrijft alleen docs/OWNER_DECISION_MENU_NL.md met --write`;

function list(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

export function buildOwnerDecisionMenu() {
  return {
    ok: true,
    status: 'OWNER_DECISION_SELECTION_READY',
    guards: [
      'Geen .env lezen.',
      'Geen netwerk, database, productiehost of externe provider gebruiken.',
      'Geen push, tags, dependency-installatie, e-mail, import of secret rotation uitvoeren.',
      'Geen mutatie behalve docs/OWNER_DECISION_MENU_NL.md met --write.',
    ],
    entries: DECISION_MENU,
  };
}

export function renderOwnerDecisionMenu(menu) {
  const lines = [
    '# Yeshua Academy Finance — Owner decision menu',
    '',
    'Status: owner decision selection ready — geen owner-gated actie uitgevoerd',
    'Taal: Nederlands',
    '',
    '## Guards',
    '',
    list(menu.guards),
    '',
    '## Beslissingsmenu',
    '',
    '| Sleutel | Beslissing | Status | Veilige preflight | Promptdocument |',
    '|---------|------------|--------|-------------------|----------------|',
  ];

  for (const entry of menu.entries) {
    lines.push(`| \`${entry.key}\` | ${entry.label} | ${entry.status} | \`${entry.safePreflightCommand}\` | \`${entry.nextPromptDoc}\` |`);
  }

  for (const entry of menu.entries) {
    lines.push('');
    lines.push(`## ${entry.label}`);
    lines.push('');
    lines.push(`Sleutel: \`${entry.key}\``);
    lines.push(`Status: ${entry.status}`);
    lines.push(`Vereiste approval: ${entry.requiredApproval}`);
    lines.push(`Veilige preflight: \`${entry.safePreflightCommand}\``);
    lines.push(`Volgende prompt doc: \`${entry.nextPromptDoc}\``);
    lines.push('');
    lines.push('Stopregels:');
    lines.push(list(entry.stopRules));
  }

  lines.push('');
  lines.push('## Stopregels voor alle keuzes');
  lines.push('');
  lines.push('- Stop bij productie, verboden productiehost, MCP bridge, externe provider, echte e-mail, PDF dependency, owner-bestanden, historische productie-import, push, tags, `.env` wijziging of geheim in output.');
  lines.push('- Stop bij falende validatie na één bounded repair attempt.');
  lines.push('- Gebruik `docs/OWNER_APPROVAL_INTAKE_NL.md` vóór elke goedgekeurde uitvoering.');

  return `${lines.join('\n')}\n`;
}

function parseArgs(args) {
  const set = new Set(args);
  return {
    help: set.has('--help') || set.has('-h'),
    json: set.has('--json'),
    write: set.has('--write'),
  };
}

export function main(args = process.argv.slice(2), options = {}) {
  const parsed = parseArgs(args);
  const stdout = options.stdout ?? process.stdout;
  const repoRoot = options.repoRoot ?? process.cwd();

  if (parsed.help) {
    stdout.write(`${HELP_TEXT}\n`);
    return 0;
  }

  const menu = buildOwnerDecisionMenu();
  if (parsed.json) {
    stdout.write(`${JSON.stringify(menu, null, 2)}\n`);
    return 0;
  }

  const markdown = renderOwnerDecisionMenu(menu);
  if (parsed.write) {
    const outputFile = resolve(repoRoot, OUTPUT_PATH);
    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, markdown, 'utf-8');
    stdout.write(`Geschreven naar ${OUTPUT_PATH}\n`);
    return 0;
  }

  stdout.write(markdown);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}
