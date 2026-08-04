#!/usr/bin/env node
/**
 * canonical-reference-audit.mjs
 *
 * Reads all XLSX/XLS files from the Administratie folder, extracts distinct
 * literals from bestemming/Categorie/Transaction type columns, then diffs
 * them against the production database.
 *
 * Usage:
 *   node scripts/canonical-reference-audit.mjs [--production] [--dry-run | --apply]
 *
 * Flags:
 *   --production   Load DATABASE_URL from .env.production (default: .env.local)
 *   --dry-run      Only print the diff report, never write (DEFAULT)
 *   --apply        Upsert missing canonical Categories and TransactionTypes;
 *                  report extras as "would deactivate" without deactivating
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ─── Parse CLI flags ──────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const isProduction = argv.includes('--production');
const isApply = argv.includes('--apply');
const isDryRun = !isApply; // default is dry-run

// ─── Load environment ─────────────────────────────────────────────────────────

const envFile = isProduction
  ? path.join(repoRoot, '.env.production')
  : path.join(repoRoot, '.env.local');

if (fs.existsSync(envFile)) {
  const dotenv = require('dotenv');
  dotenv.config({ path: envFile });
  console.log(`env loaded from: ${path.basename(envFile)}`);
} else {
  console.warn(`env file not found: ${envFile}`);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('STOP: DATABASE_URL is not set.');
  process.exit(1);
}

const DEFAULT_WORKSPACE_ID =
  process.env.DEFAULT_WORKSPACE_ID ?? '00000000-0000-4000-8000-000000000001';

// ─── Canonical reference sets (hardcoded from spec) ───────────────────────────

const CANONICAL_TYPES = new Set([
  'Beginstand',
  'Online Banking',
  'SEPA direct debit',
  'Transfer',
  'Various',
  'iDEAL',
]);

const CANONICAL_CATEGORIES = new Set([
  'Administratie & Organisatie',
  'Arbeid',
  'Blessings',
  'Evangelisatie',
  'Giften',
  'Huisgemeentes',
  'Inkomsten',
  'Noden',
  'Panden',
  'Projecten',
  'Projecten Blessings diversen',
  'Tienden',
  'Yeshua Academy',
]);

const CANONICAL_BESTEMMINGEN = new Set([
  'Aanschaf TV samenkomst',
  'Aanschaf bekabeling',
  'Aanschaf mengtafel',
  'Alg-Yeshua',
  'Algemeen',
  'Apparatuur',
  'Bankkosten',
  'Begrafenis',
  'Begrafenis Zambia',
  'Bijbels ZAF',
  'Blessing Caleb',
  'Blessing Kady en Renz',
  'Blessing Sifra',
  'Blessings diversen',
  'Boiler project Elizan',
  'Borg Randy & Kim',
  'Correctie',
  'Correctie betaalverzoek Texas',
  'Dirk de Haas',
  'Elizan van Noort',
  'Email- Domein & Webshosting',
  'F. van Breugel',
  'FS Renswoude',
  'Familie Korving',
  'Financiele administratie Steve',
  'Frankrijk',
  'Frankrijk M&D',
  'Gift Project 397',
  'Gift Szilard Texas',
  'Huisvesting Randy & Kim',
  'Huur Randy & Kim',
  'Huur diversen',
  'Jaarlijkse kosten adres',
  'Japan',
  'Kamer van koophandel',
  'Kerkelijke werkzaamheden Mark',
  'Kerkelijke werkzaamheden Pieter',
  'Kerstdinner',
  'Kickstart',
  'Kruisposten',
  'Licht & geluid apparatuur',
  'Mannenontbijt',
  'Marien',
  'Mark',
  'Missie DR Chris',
  'Missiereis Chris',
  'Mission Nepal',
  'Ond',
  'Ondersteuning Annerieke',
  'Ondersteuning Caleb',
  'Ondersteuning Dirk de Haas',
  'Ondersteuning Freek',
  'Ondersteuning Kady en Renz',
  'Ondersteuning Kevin',
  'Ondersteuning Mark',
  'Ondersteuning Selwyn',
  'Ondersteuning Sifra',
  'Ondersteuning Szilard',
  'Ondersteuning Zambia',
  'Ondersteuning familie Korving',
  'Ondersteuning studentenwerk project 397',
  'Onkostenvergoeding',
  'Pieters moeder',
  'Project Elizan',
  'Project Wales',
  'Project Zambi',
  'Remco de Boer',
  'Rente',
  'Sandra Letland',
  'Shahar & Kim',
  'Spaarrekening',
  'St Dienstbaar',
  'Stichting IJM',
  'Szilard',
  'Szilard Texas',
  'Taarten Pasen',
  'Test',
  'Tienden',
  'Vliegtickets',
  'Wales M&D',
  'Wasmachine Dirk',
  'Wasmachine Hesli & Lidewij',
  'Website kosten',
  'Welkomstcadeau Randy & Kim',
  'ZAF 2024',
]);

// ─── XLSX scanning ────────────────────────────────────────────────────────────

const ADMINISTRATIE_DIR =
  '/Users/Office/Documents/Church/Yeshua Academy/Administratie';

function findXlsxFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findXlsxFiles(fullPath));
    } else if (
      entry.isFile() &&
      /\.(xlsx|xls)$/i.test(entry.name) &&
      !entry.name.startsWith('~$')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Normalize a cell value: strip surrounding whitespace, collapse internal
 * tabs/multiple spaces to a single space.
 */
function normalizeCell(raw) {
  if (raw == null) return null;
  const s = String(raw)
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > 0 ? s : null;
}

/**
 * Extract distinct bestemming, categorie, and type literals from a workbook.
 * Returns { bestemmingen: Set, categories: Set, types: Set, triples: Set }
 */
function extractFromWorkbook(filePath, xlsx) {
  let workbook;
  try {
    workbook = xlsx.readFile(filePath, { cellText: false, cellDates: false });
  } catch (err) {
    console.warn(`  SKIP (read error): ${path.basename(filePath)}: ${err.message}`);
    return null;
  }

  const bestemmingen = new Set();
  const categories = new Set();
  const types = new Set();
  const triples = new Set();
  let rowsScanned = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert to array-of-arrays for column scanning
    const rows = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (rows.length === 0) continue;

    // Find header row: first row containing at least one recognized column name
    let headerRowIndex = -1;
    let colBestemming = -1;
    let colCategorie = -1;
    let colType = -1;

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      for (let c = 0; c < row.length; c++) {
        const val = normalizeCell(row[c]);
        if (!val) continue;
        const lower = val.toLowerCase();
        if (lower === 'bestemming' || lower === 'klant') colBestemming = c;
        if (lower === 'categorie' || lower === 'category') colCategorie = c;
        if (
          lower === 'transaction type' ||
          lower === 'transactiontype' ||
          lower === 'type'
        )
          colType = c;
      }
      if (colBestemming !== -1 || colCategorie !== -1 || colType !== -1) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) continue;

    // Scan data rows below header
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      const bestemming =
        colBestemming !== -1 ? normalizeCell(row[colBestemming]) : null;
      const categorie =
        colCategorie !== -1 ? normalizeCell(row[colCategorie]) : null;
      const type = colType !== -1 ? normalizeCell(row[colType]) : null;

      if (bestemming) bestemmingen.add(bestemming);
      if (categorie) categories.add(categorie);
      if (type) types.add(type);

      if (bestemming || categorie || type) {
        triples.add(JSON.stringify({ bestemming, categorie, type }));
        rowsScanned++;
      }
    }
  }

  return { bestemmingen, categories, types, triples, rowsScanned };
}

// ─── Database queries ─────────────────────────────────────────────────────────

async function queryProduction() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

  try {
    const [dbCategories, dbTypes, dbProjects] = await Promise.all([
      prisma.category.findMany({
        where: { workspaceId: DEFAULT_WORKSPACE_ID },
        select: { id: true, name: true, isActive: true, isHistorical: true },
        orderBy: { name: 'asc' },
      }),
      prisma.transactionType.findMany({
        where: { workspaceId: DEFAULT_WORKSPACE_ID },
        select: {
          id: true,
          literalName: true,
          isActive: true,
          isHistorical: true,
        },
        orderBy: { literalName: 'asc' },
      }),
      prisma.project.findMany({
        where: { workspaceId: DEFAULT_WORKSPACE_ID },
        select: { id: true, code: true, name: true, isActive: true, isHistorical: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { dbCategories, dbTypes, dbProjects };
  } finally {
    await prisma.$disconnect();
  }
}

// ─── Upsert helpers ───────────────────────────────────────────────────────────

async function upsertMissingCategories(missing) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  const results = [];
  try {
    for (const name of missing) {
      const record = await prisma.category.upsert({
        where: {
          workspaceId_name: { workspaceId: DEFAULT_WORKSPACE_ID, name },
        },
        create: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          name,
          isActive: true,
          isHistorical: false,
        },
        update: {
          isActive: true,
          isHistorical: false,
        },
      });
      results.push({ name, id: record.id, action: 'upserted' });
    }
  } finally {
    await prisma.$disconnect();
  }
  return results;
}

async function upsertMissingTypes(missing) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  const results = [];
  try {
    for (const literalName of missing) {
      const record = await prisma.transactionType.upsert({
        where: {
          workspaceId_literalName: {
            workspaceId: DEFAULT_WORKSPACE_ID,
            literalName,
          },
        },
        create: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          literalName,
          isActive: true,
          isHistorical: false,
        },
        update: {
          isActive: true,
          isHistorical: false,
        },
      });
      results.push({ literalName, id: record.id, action: 'upserted' });
    }
  } finally {
    await prisma.$disconnect();
  }
  return results;
}

async function upsertMissingBestemmingen(missing) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  const results = [];
  try {
    for (const name of missing) {
      const record = await prisma.project.upsert({
        where: {
          workspaceId_code: { workspaceId: DEFAULT_WORKSPACE_ID, code: name },
        },
        create: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          code: name,
          name,
          isActive: true,
          isHistorical: false,
        },
        update: {
          isActive: true,
          isHistorical: false,
        },
      });
      results.push({ name, id: record.id, action: 'upserted' });
    }
  } finally {
    await prisma.$disconnect();
  }
  return results;
}

// ─── Report helpers ───────────────────────────────────────────────────────────

function section(title) {
  const bar = '─'.repeat(60);
  console.log(`\n${bar}`);
  console.log(title);
  console.log(bar);
}

function printList(label, items, prefix = '  ') {
  if (items.length === 0) {
    console.log(`${prefix}${label}: (none)`);
  } else {
    console.log(`${prefix}${label} (${items.length}):`);
    for (const item of [...items].sort()) {
      console.log(`${prefix}  - ${item}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('=== Canonical Reference Audit ===');
  console.log(`mode      : ${isDryRun ? 'dry-run (default)' : 'apply'}`);
  console.log(`env       : ${isProduction ? 'production' : 'local'}`);
  console.log(`workspaceId: ${DEFAULT_WORKSPACE_ID}`);

  // ── Step 1: Scan XLSX files ──────────────────────────────────────────────────

  section('1. Scanning XLSX/XLS files');
  const xlsx = require('xlsx');
  const xlsxFiles = findXlsxFiles(ADMINISTRATIE_DIR);
  console.log(`Found ${xlsxFiles.length} file(s) in ${ADMINISTRATIE_DIR}`);

  const observedBestemmingen = new Set();
  const observedCategories = new Set();
  const observedTypes = new Set();
  const observedTriples = new Set();
  let totalRowsScanned = 0;

  for (const filePath of xlsxFiles) {
    const relPath = path.relative(ADMINISTRATIE_DIR, filePath);
    const result = extractFromWorkbook(filePath, xlsx);
    if (!result) continue;

    const { bestemmingen, categories, types, triples, rowsScanned } = result;
    console.log(
      `  ${relPath}: ${rowsScanned} data rows | ` +
        `b=${bestemmingen.size} c=${categories.size} t=${types.size}`,
    );

    for (const v of bestemmingen) observedBestemmingen.add(v);
    for (const v of categories) observedCategories.add(v);
    for (const v of types) observedTypes.add(v);
    for (const v of triples) observedTriples.add(v);
    totalRowsScanned += rowsScanned;
  }

  console.log('');
  console.log(`Total rows scanned      : ${totalRowsScanned}`);
  console.log(`Observed bestemmingen   : ${observedBestemmingen.size}`);
  console.log(`Observed categories     : ${observedCategories.size}`);
  console.log(`Observed types          : ${observedTypes.size}`);
  console.log(`Observed unique triples : ${observedTriples.size}`);

  // ── Step 2: Print canonical sets ────────────────────────────────────────────

  section('2. Canonical sets (from spec)');
  console.log(`  Canonical Types        : ${CANONICAL_TYPES.size}`);
  for (const v of [...CANONICAL_TYPES].sort()) console.log(`    - ${v}`);
  console.log(`  Canonical Categories   : ${CANONICAL_CATEGORIES.size}`);
  for (const v of [...CANONICAL_CATEGORIES].sort()) console.log(`    - ${v}`);
  console.log(`  Canonical Bestemmingen : ${CANONICAL_BESTEMMINGEN.size}`);
  for (const v of [...CANONICAL_BESTEMMINGEN].sort()) console.log(`    - ${v}`);

  // ── Step 3: Cross-check observed vs canonical ────────────────────────────────

  section('3. Observed vs canonical cross-check');

  const typesInCanonicalNotObserved = [...CANONICAL_TYPES].filter(
    (v) => !observedTypes.has(v),
  );
  const typesObservedNotInCanonical = [...observedTypes].filter(
    (v) => !CANONICAL_TYPES.has(v),
  );
  printList('Types in canonical but NOT observed in XLSX', typesInCanonicalNotObserved);
  printList('Types observed in XLSX but NOT in canonical', typesObservedNotInCanonical);

  const catsInCanonicalNotObserved = [...CANONICAL_CATEGORIES].filter(
    (v) => !observedCategories.has(v),
  );
  const catsObservedNotInCanonical = [...observedCategories].filter(
    (v) => !CANONICAL_CATEGORIES.has(v),
  );
  printList('Categories in canonical but NOT observed in XLSX', catsInCanonicalNotObserved);
  printList('Categories observed in XLSX but NOT in canonical', catsObservedNotInCanonical);

  const bestInCanonicalNotObserved = [...CANONICAL_BESTEMMINGEN].filter(
    (v) => !observedBestemmingen.has(v),
  );
  const bestObservedNotInCanonical = [...observedBestemmingen].filter(
    (v) => !CANONICAL_BESTEMMINGEN.has(v),
  );
  printList(
    'Bestemmingen in canonical but NOT observed in XLSX',
    bestInCanonicalNotObserved,
  );
  printList(
    'Bestemmingen observed in XLSX but NOT in canonical',
    bestObservedNotInCanonical,
  );

  // ── Step 4: Query production DB ─────────────────────────────────────────────

  section('4. Querying production database');
  let dbCategories, dbTypes, dbProjects;
  try {
    ({ dbCategories, dbTypes, dbProjects } = await queryProduction());
  } catch (err) {
    console.error(`STOP: database query failed: ${err.message}`);
    process.exit(1);
  }
  console.log(`  DB categories       : ${dbCategories.length} total`);
  console.log(
    `    active/non-historical : ${dbCategories.filter((c) => c.isActive && !c.isHistorical).length}`,
  );
  console.log(`    historical           : ${dbCategories.filter((c) => c.isHistorical).length}`);
  console.log(`  DB transaction types : ${dbTypes.length} total`);
  console.log(
    `    active/non-historical : ${dbTypes.filter((t) => t.isActive && !t.isHistorical).length}`,
  );
  console.log(`    historical           : ${dbTypes.filter((t) => t.isHistorical).length}`);
  console.log(`  DB projects (Klant)  : ${dbProjects.length} total`);
  console.log(
    `    active/non-historical : ${dbProjects.filter((p) => p.isActive && !p.isHistorical).length}`,
  );
  console.log(`    historical           : ${dbProjects.filter((p) => p.isHistorical).length}`);

  // ── Step 5: Compute diffs ────────────────────────────────────────────────────

  section('5. Diff: canonical vs production');

  // Categories diff
  const dbCategoryNames = new Set(dbCategories.map((c) => c.name));
  const canonicalCatsMissingFromDB = [...CANONICAL_CATEGORIES].filter(
    (v) => !dbCategoryNames.has(v),
  );
  const dbCatsNotInCanonical = dbCategories
    .filter((c) => !c.isHistorical && !CANONICAL_CATEGORIES.has(c.name))
    .map((c) => c.name);

  console.log('\n  Categories:');
  printList('  Missing from DB (canonical → add)', canonicalCatsMissingFromDB, '  ');
  printList(
    '  In DB but NOT in canonical (non-historical extras)',
    dbCatsNotInCanonical,
    '  ',
  );
  if (dbCatsNotInCanonical.length > 0) {
    console.log('  NOTE: extras listed above are present in DB but not in canonical set.');
    console.log(
      '        They will NOT be deactivated automatically (report only).',
    );
  }

  // TransactionTypes diff
  const dbTypeLiteralNames = new Set(dbTypes.map((t) => t.literalName));
  const canonicalTypesMissingFromDB = [...CANONICAL_TYPES].filter(
    (v) => !dbTypeLiteralNames.has(v),
  );
  const dbTypesNotInCanonical = dbTypes
    .filter((t) => !t.isHistorical && !CANONICAL_TYPES.has(t.literalName))
    .map((t) => t.literalName);

  console.log('\n  TransactionTypes:');
  printList('  Missing from DB (canonical → add)', canonicalTypesMissingFromDB, '  ');
  printList(
    '  In DB but NOT in canonical (non-historical extras)',
    dbTypesNotInCanonical,
    '  ',
  );
  if (dbTypesNotInCanonical.length > 0) {
    console.log('  NOTE: extras listed above are present in DB but not in canonical set.');
    console.log('        Would deactivate (not applied in dry-run).');
  }

  // Projects (Bestemmingen) diff — note these are a completely different set
  // from the workspace-level projects (FTK/FR/WLJ/YA/VS/Algemeen).
  // We only report canonical bestemmingen vs projects that have code=name
  // (i.e., reference data items), not the structural workspace projects.
  const dbProjectByCode = new Map(dbProjects.map((p) => [p.code, p]));
  const canonicalBestMissingFromDB = [...CANONICAL_BESTEMMINGEN].filter(
    (v) => !dbProjectByCode.has(v),
  );
  // Workspace structural projects (those NOT matching any canonical bestemming
  // AND not having code=name pattern typical of reference data)
  const dbProjectsMatchingCanonical = dbProjects.filter((p) =>
    CANONICAL_BESTEMMINGEN.has(p.code),
  );
  const dbProjectsNotInCanonical = dbProjects
    .filter((p) => !p.isHistorical && !CANONICAL_BESTEMMINGEN.has(p.code))
    .map((p) => `${p.code} / ${p.name}`);

  console.log('\n  Projects/Klant (Bestemmingen reference data):');
  printList(
    '  Canonical bestemmingen missing from DB',
    canonicalBestMissingFromDB,
    '  ',
  );
  console.log(
    `  Canonical bestemmingen already in DB  : ${dbProjectsMatchingCanonical.length}`,
  );
  printList(
    '  In DB but NOT in canonical (non-historical, code listed)',
    dbProjectsNotInCanonical,
    '  ',
  );
  console.log(
    '  NOTE: DB projects not in canonical may be structural workspace projects',
  );
  console.log(
    '        (FTK/FR/WLJ/YA/VS/Algemeen) — do NOT deactivate these.',
  );

  // ── Step 6: Apply or report ──────────────────────────────────────────────────

  section(`6. Action (${isDryRun ? 'DRY-RUN — no writes' : 'APPLY — writing to DB'})`);

  if (isDryRun) {
    console.log('  dry-run: no database writes will occur.');
    if (canonicalCatsMissingFromDB.length > 0) {
      console.log(
        `  Would upsert ${canonicalCatsMissingFromDB.length} canonical category/ies:`,
      );
      for (const v of canonicalCatsMissingFromDB) console.log(`    + ${v}`);
    }
    if (dbCatsNotInCanonical.length > 0) {
      console.log(
        `  Would report ${dbCatsNotInCanonical.length} extra category/ies (no deactivation):`,
      );
      for (const v of dbCatsNotInCanonical) console.log(`    ~ ${v}`);
    }
    if (canonicalTypesMissingFromDB.length > 0) {
      console.log(
        `  Would upsert ${canonicalTypesMissingFromDB.length} canonical type(s):`,
      );
      for (const v of canonicalTypesMissingFromDB) console.log(`    + ${v}`);
    }
    if (dbTypesNotInCanonical.length > 0) {
      console.log(
        `  Would report ${dbTypesNotInCanonical.length} extra type(s) as "would deactivate" (not applied):`,
      );
      for (const v of dbTypesNotInCanonical) console.log(`    ~ ${v}`);
    }
    if (canonicalBestMissingFromDB.length > 0) {
      console.log(
        `  Would upsert ${canonicalBestMissingFromDB.length} canonical bestemming(en) as Project records:`,
      );
      for (const v of canonicalBestMissingFromDB) console.log(`    + ${v}`);
    }
  } else {
    // --apply mode
    let appliedCount = 0;

    if (canonicalCatsMissingFromDB.length > 0) {
      console.log(
        `  Upserting ${canonicalCatsMissingFromDB.length} missing canonical category/ies...`,
      );
      const results = await upsertMissingCategories(canonicalCatsMissingFromDB);
      for (const r of results) {
        console.log(`    + Category upserted: "${r.name}" (id: ${r.id})`);
        appliedCount++;
      }
    } else {
      console.log('  Categories: nothing to upsert.');
    }

    if (dbCatsNotInCanonical.length > 0) {
      console.log(
        `  Extra categories (would deactivate — NOT applied):`,
      );
      for (const v of dbCatsNotInCanonical) console.log(`    ~ ${v}`);
    }

    if (canonicalTypesMissingFromDB.length > 0) {
      console.log(
        `  Upserting ${canonicalTypesMissingFromDB.length} missing canonical type(s)...`,
      );
      const results = await upsertMissingTypes(canonicalTypesMissingFromDB);
      for (const r of results) {
        console.log(`    + TransactionType upserted: "${r.literalName}" (id: ${r.id})`);
        appliedCount++;
      }
    } else {
      console.log('  TransactionTypes: nothing to upsert.');
    }

    if (dbTypesNotInCanonical.length > 0) {
      console.log(
        `  Extra types (would deactivate — NOT applied):`,
      );
      for (const v of dbTypesNotInCanonical) console.log(`    ~ ${v}`);
    }

    if (canonicalBestMissingFromDB.length > 0) {
      console.log(
        `  Upserting ${canonicalBestMissingFromDB.length} missing canonical bestemming(en) as Project records...`,
      );
      const results = await upsertMissingBestemmingen(canonicalBestMissingFromDB);
      for (const r of results) {
        console.log(`    + Project upserted: "${r.name}" (id: ${r.id})`);
        appliedCount++;
      }
    } else {
      console.log('  Bestemmingen/Projects: nothing to upsert.');
    }

    console.log('');
    console.log(`  Applied ${appliedCount} upsert(s) total.`);
  }

  // ── Step 7: Observed triples summary ────────────────────────────────────────

  section('7. Observed triples summary (bestemming, categorie, type)');
  console.log(`  Total unique triples observed across all files: ${observedTriples.size}`);
  console.log('  (Use --verbose to print all triples — not shown by default)');

  if (argv.includes('--verbose')) {
    const parsed = [...observedTriples]
      .map((s) => JSON.parse(s))
      .sort((a, b) => {
        const ac = a.categorie ?? '';
        const bc = b.categorie ?? '';
        if (ac < bc) return -1;
        if (ac > bc) return 1;
        const ab = a.bestemming ?? '';
        const bb = b.bestemming ?? '';
        if (ab < bb) return -1;
        if (ab > bb) return 1;
        return 0;
      });
    console.log('');
    for (const triple of parsed) {
      console.log(
        `  bestemming="${triple.bestemming ?? ''}" | categorie="${triple.categorie ?? ''}" | type="${triple.type ?? ''}"`,
      );
    }
  }

  section('Done');
  console.log(
    `  Run with --apply --production to upsert missing canonical entries.\n`,
  );
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
