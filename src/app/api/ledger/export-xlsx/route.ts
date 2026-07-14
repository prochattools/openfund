import { NextResponse } from 'next/server';
import { resolveRequestActor } from '@/../server/auth/requestContext';
import * as XLSX from 'xlsx';
import prisma from '@/libs/prisma';
import {
  HEADERS,
  buildLedgerBackupContentDisposition,
  buildLedgerSheetName,
  deriveDebitCredit,
  ensureRawRecord,
  formatDateAsNumeric,
  parseAmount,
  readRawValue,
  splitCategoryLabel,
} from './exportHelpers';

export async function GET(request: Request) {
  const resolution = await resolveRequestActor(request.headers.get('cookie'));
  if (!resolution.actor) {
    const status = resolution.error === 'forbidden' ? 403 : resolution.error === 'misconfigured' ? 503 : 401;
    return NextResponse.json(
      {
        error:
          resolution.error === 'forbidden'
            ? 'Geen toegang tot deze financiële werkruimte.'
            : resolution.error === 'misconfigured'
              ? 'Authenticatie is tijdelijk niet beschikbaar.'
              : 'Authenticatie vereist.',
      },
      { status },
    );
  }
  const { userId } = resolution.actor;

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      categoryId: {
        not: null,
      },
    },
    include: {
      account: true,
      category: true,
    },
    orderBy: {
      date: 'asc',
    },
  });

  const rows = transactions.map((tx) => {
    const rawRecord = ensureRawRecord(tx.rawRow);
    const safeDate =
      readRawValue(rawRecord, 'Date') ??
      formatDateAsNumeric(tx.date instanceof Date ? tx.date : new Date(tx.date));
    const description =
      readRawValue(rawRecord, 'Name / Description') ?? tx.description ?? '';
    const accountValue =
      readRawValue(rawRecord, 'Account') ??
      tx.account?.identifier ??
      tx.account?.name ??
      '';
    const counterparty =
      readRawValue(rawRecord, 'Counterparty') ??
      tx.counterparty ??
      tx.reference ??
      '';
    const code = readRawValue(rawRecord, 'Code') ?? '';
    const debitCredit = readRawValue(rawRecord, 'Debit/credit') ?? deriveDebitCredit(tx.direction);
    const rawAmount = parseAmount(readRawValue(rawRecord, 'Amount (EUR)'));
    const amount =
      rawAmount ?? Math.abs(Number(tx.amountMinor) / 100);
    const transactionType =
      readRawValue(rawRecord, 'Transaction type') ?? tx.source ?? 'Unknown';
    const rawCategory = readRawValue(rawRecord, 'Categorie');
    const rawSubCategory = readRawValue(rawRecord, 'bestemming');
    const derivedCategories = splitCategoryLabel(tx.category?.name ?? null);
    const mainCategory = rawCategory ?? derivedCategories.main ?? '';
    const subCategory = rawSubCategory ?? derivedCategories.sub ?? '';
    const notifications =
      readRawValue(rawRecord, 'Notifications') ??
      tx.reference ??
      tx.description ??
      '';

    return [
      safeDate,
      description,
      accountValue,
      counterparty,
      code,
      debitCredit,
      Number(amount.toFixed(2)),
      transactionType,
      mainCategory,
      subCategory,
      notifications,
    ];
  });

  const worksheetData = [HEADERS, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, buildLedgerSheetName());
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': buildLedgerBackupContentDisposition(),
    },
  });
}
