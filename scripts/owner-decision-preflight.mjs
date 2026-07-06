/**
 * Owner decision readiness preflight for Yeshua Academy Finance.
 *
 * Local-only report generator. It checks whether an owner-gated decision is
 * documented and ready for review while keeping the decision itself blocked.
 *
 * Guards:
 * - Does NOT read .env.
 * - Does NOT require network access.
 * - Does NOT mutate files unless --write is supplied.
 * - Does NOT run production commands, push, tag, install, email, or import.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export const OUTPUT_PATH = 'docs/OWNER_DECISION_PREFLIGHT_NL.md';

export const REQUIRED_DOCS = [
  'docs/OWNER_DECISION_PACK_NL.md',
  'docs/OWNER_DECISION_READINESS_MATRIX_NL.md',
  'docs/OWNER_HANDOFF_NL.md',
  'docs/OWNER_GO_NO_GO_PREFLIGHT_NL.md',
  'docs/PUSH_READINESS_CHECKLIST_NL.md',
  'docs/PRODUCTION_CUTOVER_PLAN_NL.md',
  'docs/BACKUP_RESTORE_REHEARSAL_NL.md',
  'docs/RELEASE_MANIFEST_NL.md',
];

const HELP_TEXT = `Yeshua Academy Finance — Owner decision preflight

GEBRUIK / USAGE:
  node scripts/owner-decision-preflight.mjs --help
  node scripts/owner-decision-preflight.mjs
  node scripts/owner-decision-preflight.mjs --decision pdf
  node scripts/owner-decision-preflight.mjs --decision production-cutover
  node scripts/owner-decision-preflight.mjs --decision historical-import
  node scripts/owner-decision-preflight.mjs --decision email
  node scripts/owner-decision-preflight.mjs --decision push
  node scripts/owner-decision-preflight.mjs --decision secret-rotation
  node scripts/owner-decision-preflight.mjs --decision postgres-version
  node scripts/owner-decision-preflight.mjs --decision pdf --write

GUARDS:
  - Leest geen .env
  - Raakt geen netwerk, database, productiehost of externe provider
  - Voert geen productiecommando, push, tag, installatie, e-mail of import uit
  - Schrijft alleen docs/OWNER_DECISION_PREFLIGHT_NL.md met --write`;

const DECISIONS = {
  pdf: {
    label: 'Echte PDF-renderer afhankelijkheid',
    status: 'GEBLOKKEERD TOT EIGENAAR PDF-KEUZE GOEDKEURT',
    readyNow: [
      'HTML- en XLSX-rapporten gebruiken dezelfde gesloten snapshot.',
      'PDF-placeholder blijft zichtbaar als expliciete blocker.',
      'Package-safety tests bewaken dat er geen PDF-afhankelijkheid stil wordt toegevoegd.',
    ],
    blocked: [
      'Geen echte PDF-renderer is geselecteerd of geïnstalleerd.',
      'Geen dependencywijziging is toegestaan in deze preflight.',
    ],
    ownerInputs: [
      'Naam van de gekozen PDF-bibliotheek.',
      'Bevestiging van licentie, runtimegrootte en serverbelasting.',
      'Akkoord dat dependency-installatie pas in een apart goedgekeurd packet gebeurt.',
    ],
    secrets: ['Geen geheim vereist.'],
    preflightCommand: 'node scripts/owner-decision-preflight.mjs --decision pdf',
    safeDryRunCommand: 'npm test -- --test-name-pattern "production blocker"',
    executionAfterApproval: 'Gebruik de PDF-sectie in docs/POST_APPROVAL_PROMPTS_NL.md; deze preflight voert niets uit.',
    rollback: 'Revert de dependency- en rendererwijziging als build, tests of audit falen.',
    stopRules: ['Stop bij ontbrekende bibliotheekkeuze.', 'Stop bij dependency-, audit-, build- of testtwijfel.'],
    nextPrompt: 'Gebruik de prompt "Approve and implement real PDF renderer" uit docs/POST_APPROVAL_PROMPTS_NL.md.',
  },
  'production-cutover': {
    label: 'Productiemigratie en cutover',
    status: 'GEBLOKKEERD TOT EXPLICIETE CUTOVER-GOEDKEURING',
    readyNow: [
      'Productiecutoverplan is documentatie-only aanwezig.',
      'Lokale release-candidate validatie is beschikbaar.',
      'Backup/restore rehearsal guard bestaat en blijft local-only.',
    ],
    blocked: [
      'Geen productiehost of productie-DB mag worden aangeraakt.',
      'Geen productiesecret mag in Git of output verschijnen.',
    ],
    ownerInputs: [
      'Expliciete cutover-goedkeuring.',
      'Productiehost- en databasegegevens buiten Git.',
      'Back-upvenster, rollback-eigenaar en onderhoudsvenster.',
    ],
    secrets: ['DATABASE_URL, auth-secrets, provider-secrets buiten Git en logs.'],
    preflightCommand: 'node scripts/owner-decision-preflight.mjs --decision production-cutover',
    safeDryRunCommand: 'npm run validate:release-candidate',
    executionAfterApproval: 'Gebruik uitsluitend het goedgekeurde cutoverplan; deze preflight bevat geen productiecommando.',
    rollback: 'Herstel productiedatabase uit vooraf gemaakte back-up en leg reden vast in docs/finance-rebuild-run.md.',
    stopRules: ['Stop bij ontbrekende back-up.', 'Stop bij niet-lokale DB in een lokale rehearsal.', 'Stop bij ontbrekende eigenaar-go.'],
    nextPrompt: 'Gebruik de prompt "Run production cutover preparation, documentation-only first" uit docs/POST_APPROVAL_PROMPTS_NL.md.',
  },
  'historical-import': {
    label: 'Historische productie-import',
    status: 'GEBLOKKEERD TOT OWNER-FILES EN DRY-RUN ZIJN GOEDGEKEURD',
    readyNow: [
      'Lokale/sanitized loader en owner-local rehearsal adapter zijn geïmplementeerd.',
      'Productiepad blijft production-blocked.',
      'Owner-bronbestanden blijven buiten Git.',
    ],
    blocked: [
      'Geen owner Excel/CSV/PDF-bestanden mogen worden gekopieerd naar Git.',
      'Geen historische productie-import mag worden uitgevoerd.',
    ],
    ownerInputs: [
      'Absolute owner-bestandspaden buiten Git.',
      'Verwachte SHA-256-hashes.',
      'Acceptatie van sanitized dry-run samenvatting.',
    ],
    secrets: ['Geen geheim in Git; eventuele bestandspaden alleen lokaal/operator-owned.'],
    preflightCommand: 'node scripts/owner-decision-preflight.mjs --decision historical-import',
    safeDryRunCommand: 'npm test -- --test-name-pattern "Phase 3 historical loading closeout"',
    executionAfterApproval: 'Gebruik de historische-import prompt in docs/POST_APPROVAL_PROMPTS_NL.md; deze preflight importeert niets.',
    rollback: 'Herstel database uit back-up als een later goedgekeurde productie-import faalt.',
    stopRules: ['Stop bij owner-bestanden binnen repo.', 'Stop bij hash mismatch.', 'Stop bij non-local DB voor rehearsal.'],
    nextPrompt: 'Gebruik de prompt "Run historical production import dry-run with owner files outside Git" uit docs/POST_APPROVAL_PROMPTS_NL.md.',
  },
  email: {
    label: 'Echte e-mailverzending',
    status: 'GEBLOKKEERD TOT PROVIDER EN SLEUTEL BUITEN GIT GOEDGEKEURD ZIJN',
    readyNow: [
      'Report dispatch metadata bestaat.',
      'Huidige dispatch stuurt geen echte e-mail.',
      'Recipient hashes worden opgeslagen zonder platte ontvangerlijst in bewijsvelden.',
    ],
    blocked: [
      'Geen provider-call of echte e-mail mag worden uitgevoerd.',
      'Geen API-sleutel mag in Git, output of docs verschijnen.',
    ],
    ownerInputs: [
      'Providerkeuze en geverifieerd domein.',
      'Secretbeheer buiten Git.',
      'Testontvangers en dry-run acceptatie.',
    ],
    secrets: ['E-mailprovider API-key buiten Git en buiten logs.'],
    preflightCommand: 'node scripts/owner-decision-preflight.mjs --decision email',
    safeDryRunCommand: 'npm test -- --test-name-pattern "production blocker"',
    executionAfterApproval: 'Gebruik de e-mail prompt in docs/POST_APPROVAL_PROMPTS_NL.md; deze preflight verzendt niets.',
    rollback: 'Deactiveer provider-key buiten Git en herstel metadata-only modus.',
    stopRules: ['Stop bij ontbrekende provider-goedkeuring.', 'Stop bij geheim in diff.', 'Stop bij echte ontvanger zonder dry-run.'],
    nextPrompt: 'Gebruik de prompt "Configure real email provider, no sending until dry-run approved" uit docs/POST_APPROVAL_PROMPTS_NL.md.',
  },
  push: {
    label: 'Push naar remote',
    status: 'GEBLOKKEERD TOT EXPLICIETE PUSH-GOEDKEURING',
    readyNow: [
      'Push checklist bestaat.',
      'Owner go/no-go preflight bestaat.',
      'Graphify artifacts blijven de enige toegestane untracked paden.',
    ],
    blocked: [
      'Deze preflight publiceert niets.',
      'Geen tag of remote update is toegestaan.',
    ],
    ownerInputs: [
      'Expliciete push-goedkeuring.',
      'Bevestiging van doel-remote en branch buiten dit document.',
      'Bevestiging dat alle validaties opnieuw zijn gedraaid.',
    ],
    secrets: ['Geen geheim vereist.'],
    preflightCommand: 'node scripts/owner-decision-preflight.mjs --decision push',
    safeDryRunCommand: 'node scripts/owner-go-no-go-preflight.mjs --strict',
    executionAfterApproval: 'Gebruik de push-sectie in docs/POST_APPROVAL_PROMPTS_NL.md; deze preflight publiceert niets.',
    rollback: 'Gebruik normale Git revert/PR-procedure; geen force-push op main.',
    stopRules: ['Stop bij onverwachte dirty files.', 'Stop bij ontbrekende owner-go.', 'Stop bij falende release-validatie.'],
    nextPrompt: 'Gebruik de prompt "Push to remote after owner approval" uit docs/POST_APPROVAL_PROMPTS_NL.md.',
  },
  'secret-rotation': {
    label: 'Geheimen roteren',
    status: 'GEBLOKKEERD TOT PRODUCTIEVOORBEREIDING BUITEN GIT',
    readyNow: [
      'Docs benoemen secret rotation als owner-gated blocker.',
      'Release tooling bevat negatieve secret-output assertions.',
    ],
    blocked: [
      'Geen geheim mag in Git worden gezet.',
      'Geen .env wijziging is toegestaan in deze repo-sessie.',
    ],
    ownerInputs: [
      'Lijst van te roteren geheimen buiten Git.',
      'Secret-vault bestemming.',
      'Cutovervolgorde en rollback-contact.',
    ],
    secrets: ['Alle echte geheimen blijven buiten Git, docs en terminaloutput.'],
    preflightCommand: 'node scripts/owner-decision-preflight.mjs --decision secret-rotation',
    safeDryRunCommand: 'git diff --check',
    executionAfterApproval: 'Gebruik de secret-rotation prompt in docs/POST_APPROVAL_PROMPTS_NL.md; deze preflight roteert niets.',
    rollback: 'Herroep nieuwe secrets buiten Git en herstel vorige werkende secretset volgens eigenaarproces.',
    stopRules: ['Stop bij geheim in diff.', 'Stop bij .env wijziging.', 'Stop bij ontbrekende vault-bestemming.'],
    nextPrompt: 'Gebruik de prompt "Secret rotation checklist" uit docs/POST_APPROVAL_PROMPTS_NL.md.',
  },
  'postgres-version': {
    label: 'PostgreSQL-productieversie bevestigen',
    status: 'GEBLOKKEERD TOT HOSTINGVERSIE BUITEN GIT IS BEVESTIGD',
    readyNow: [
      'Lokale Prisma validate/generate controles slagen.',
      'Migratieketen is lokaal gevalideerd.',
      'Cutoverplan noemt versiecontrole als vereiste.',
    ],
    blocked: [
      'Geen hostingprovider of productiehost mag worden geraadpleegd vanuit deze preflight.',
      'Geen productie-DB URL mag worden ingevoerd.',
    ],
    ownerInputs: [
      'PostgreSQL major/minor versie uit hostingdashboard.',
      'Bevestiging van Prisma-compatibiliteit.',
      'Besluit of upgrade nodig is voor cutover.',
    ],
    secrets: ['Geen geheim; alleen versienummer en compatibiliteitsbevestiging.'],
    preflightCommand: 'node scripts/owner-decision-preflight.mjs --decision postgres-version',
    safeDryRunCommand: 'npx prisma validate met uitsluitend een lokale placeholder DATABASE_URL buiten dit rapport',
    executionAfterApproval: 'Gebruik de PostgreSQL-versie prompt in docs/POST_APPROVAL_PROMPTS_NL.md; deze preflight verbindt niet met productie.',
    rollback: 'Als versie incompatibel is: stop cutover en plan provider-upgrade of alternatieve database.',
    stopRules: ['Stop bij onbekende productieversie.', 'Stop bij incompatibiliteit.', 'Stop bij productie-URL in lokale commandoregel.'],
    nextPrompt: 'Gebruik de prompt "Confirm production PostgreSQL version" uit docs/POST_APPROVAL_PROMPTS_NL.md.',
  },
};

export const VALID_DECISIONS = Object.keys(DECISIONS);

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '(onbekend)';
  }
}

function classifyDirtyPaths(statusOutput) {
  return statusOutput
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => !line.startsWith('## '))
    .map((line) => line.slice(3).trim());
}

function requiredDocStatus(repoRoot) {
  return REQUIRED_DOCS.map((path) => ({
    path,
    exists: existsSync(resolve(repoRoot, path)),
  }));
}

function hasOwnerApprovalOutsideGit() {
  return false;
}

function renderList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

export function buildDecisionPreflight(input = {}) {
  const repoRoot = input.repoRoot ?? process.cwd();
  const decision = input.decision ?? null;
  if (decision && !DECISIONS[decision]) {
    return {
      ok: false,
      error: `Onbekende eigenaarsbeslissing: ${decision}`,
      decisions: [],
    };
  }

  const selected = decision ? [decision] : VALID_DECISIONS;
  const docs = requiredDocStatus(repoRoot);
  const missingDocs = docs.filter((doc) => !doc.exists).map((doc) => doc.path);
  const gitStatus = input.gitStatus ?? safeExec('git status --short --branch');
  const dirtyPaths = classifyDirtyPaths(gitStatus);
  const currentHead = input.head ?? safeExec('git rev-parse --short HEAD');
  const branch = input.branch ?? safeExec('git branch --show-current');
  const approvalRecordedOutsideGit = hasOwnerApprovalOutsideGit();

  return {
    ok: missingDocs.length === 0,
    branch,
    currentHead,
    dirtyPaths,
    missingDocs,
    approvalRecordedOutsideGit,
    decisions: selected.map((key) => ({
      key,
      ...DECISIONS[key],
      remainsBlocked: !approvalRecordedOutsideGit,
    })),
  };
}

export function renderDecisionPreflight(result) {
  if (result.error) {
    return `[owner-decision] ${result.error}\nGeldige beslissingen: ${VALID_DECISIONS.join(', ')}\n`;
  }

  const lines = [
    '# Yeshua Academy Finance — Eigenaarsbeslissing preflight',
    '',
    `Branch: ${result.branch}`,
    `HEAD: ${result.currentHead}`,
    `Besluitstatus: ${result.ok ? 'GEREED VOOR EIGENAARSREVIEW' : 'NIET GEREED'}`,
    `Goedkeuring buiten Git geregistreerd: ${result.approvalRecordedOutsideGit ? 'JA' : 'NEE'}`,
    '',
    '## Guards',
    '',
    '- Deze preflight leest geen `.env`.',
    '- Deze preflight gebruikt geen productie, verboden productiehosts, MCP bridge, database, netwerk of externe provider.',
    '- Deze preflight voert geen push, tag, dependency-installatie, e-mailverzending, historische import of secret-rotatie uit.',
    '- Deze preflight schrijft alleen `docs/OWNER_DECISION_PREFLIGHT_NL.md` wanneer `--write` is meegegeven.',
    '',
    '## Documentstatus',
    '',
  ];

  if (result.missingDocs.length) {
    lines.push(...result.missingDocs.map((doc) => `- ONTBREEKT: \`${doc}\``));
  } else {
    lines.push(`- Alle ${REQUIRED_DOCS.length} vereiste owner-review documenten zijn aanwezig.`);
  }

  lines.push('');
  lines.push('## Worktree');
  lines.push('');
  lines.push(result.dirtyPaths.length ? `- Dirty paths: ${result.dirtyPaths.join(', ')}` : '- Worktree schoon.');

  for (const decision of result.decisions) {
    lines.push('');
    lines.push(`## ${decision.label}`);
    lines.push('');
    lines.push(`Sleutel: \`${decision.key}\``);
    lines.push(`Status: ${decision.status}`);
    lines.push(`Blijft geblokkeerd zonder owner-goedkeuring: ${decision.remainsBlocked ? 'JA' : 'NEE'}`);
    lines.push('');
    lines.push('### Wat is nu klaar');
    lines.push(renderList(decision.readyNow));
    lines.push('');
    lines.push('### Wat blijft geblokkeerd');
    lines.push(renderList(decision.blocked));
    lines.push('');
    lines.push('### Vereiste eigenaarinput');
    lines.push(renderList(decision.ownerInputs));
    lines.push('');
    lines.push('### Geheimen of externe details');
    lines.push(renderList(decision.secrets));
    lines.push('');
    lines.push('### Veilige commando\'s');
    lines.push(`- Preflight: \`${decision.preflightCommand}\``);
    lines.push(`- Safe dry-run: \`${decision.safeDryRunCommand}\``);
    lines.push(`- Uitvoering na goedkeuring: ${decision.executionAfterApproval}`);
    lines.push('');
    lines.push('### Terugrolplan');
    lines.push(`- ${decision.rollback}`);
    lines.push('');
    lines.push('### Stopregels');
    lines.push(renderList(decision.stopRules));
    lines.push('');
    lines.push('### Exacte volgende prompt na goedkeuring');
    lines.push(`- ${decision.nextPrompt}`);
  }

  return `${lines.join('\n')}\n`;
}

const args = process.argv.slice(2);
const isHelp = args.includes('--help');
const isWrite = args.includes('--write');
const decisionArgIndex = args.indexOf('--decision');
const decision = decisionArgIndex >= 0 ? args[decisionArgIndex + 1] : null;

if (import.meta.url === `file://${process.argv[1]}`) {
  if (isHelp) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const result = buildDecisionPreflight({ decision });
  const output = renderDecisionPreflight(result);
  if (result.error) {
    process.stderr.write(output);
    process.exit(1);
  }

  if (isWrite) {
    writeFileSync(OUTPUT_PATH, output, 'utf-8');
    console.log(`[owner-decision] Geschreven naar ${OUTPUT_PATH}`);
  } else {
    process.stdout.write(output);
  }
}
