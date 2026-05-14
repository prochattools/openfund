# Yeshua Academy Finance — ING Import Contract

Status: confirmed from sample export and current parser  
Date: 2026-05-14  
Sample inspected: `sheets/NL89INGB0006369960_2025-06-01_2025-06-30.csv`

## 1. Confirmed format

The provided ING export is a semicolon-delimited CSV file with quoted headers and values.

Example structure:

```csv
"Date";"Name / Description";"Account";"Counterparty";"Code";"Debit/credit";"Amount (EUR)";"Transaction type";"Notifications";"Resulting balance";"Tag"
```

## 2. Confirmed columns

The sample contains these columns:

1. `Date`
2. `Name / Description`
3. `Account`
4. `Counterparty`
5. `Code`
6. `Debit/credit`
7. `Amount (EUR)`
8. `Transaction type`
9. `Notifications`
10. `Resulting balance`
11. `Tag`

## 3. Required columns for import

The current parser requires at least:

- `Date`
- `Name / Description`
- `Account`
- `Amount (EUR)`
- `Debit/credit`

The app should reject files that do not contain the ING column structure with a Dutch message:

```text
Dit bestand kan niet worden ingelezen. Upload een ING-exportbestand in het juiste formaat.
```

## 4. Column meanings

| Column | Meaning | Current handling |
|---|---|---|
| `Date` | Booking date as `YYYYMMDD` | Parsed into transaction date. |
| `Name / Description` | Counterparty/display description | Used as main description and matching input. |
| `Account` | Own ING account IBAN/account identifier | Used for account matching/creation. |
| `Counterparty` | Counterparty IBAN/account | Stored as counterparty/account metadata. |
| `Code` | ING transaction code | Preserved in raw row. |
| `Debit/credit` | Direction | Used to derive income/expense sign. |
| `Amount (EUR)` | Amount with Dutch comma decimal | Parsed to cents/minor units. |
| `Transaction type` | ING transaction type | Preserved as source/type metadata. |
| `Notifications` | Full transaction details | Used for reference/details and raw row. |
| `Resulting balance` | Balance after transaction | Present in sample; should be used later for stronger reconciliation. |
| `Tag` | Optional ING tag | Preserved in raw row if present. |

## 5. Amount and direction

The amount column is positive text such as `138,00`. Direction comes from `Debit/credit`:

- `Credit` = income / positive movement.
- `Debit` = expense / negative movement.

The UI should show this in Dutch as:

- `Inkomsten`
- `Uitgaven`

## 6. Duplicate behavior

The same file or month may be imported repeatedly.

Required behavior:

- duplicate transactions are ignored automatically;
- the import must not corrupt totals;
- the user receives a Dutch summary such as:

```text
Import voltooid. 0 transacties toegevoegd. 28 dubbele transacties genegeerd.
```

## 7. Wrong-file behavior

If a wrong or malformed file is uploaded:

- do not crash;
- do not partially corrupt data;
- return a natural Dutch error;
- import zero rows unless explicitly safe to import valid rows with warnings.

Preferred message:

```text
Dit bestand kan niet worden ingelezen. Upload een ING-exportbestand in het juiste formaat.
```

## 8. Reconciliation note

The sample includes `Resulting balance`. This should become part of a later import-hardening phase:

- parse resulting balance into minor units;
- compare computed running balance with bank-provided resulting balance;
- show a Dutch warning if totals do not match;
- use this as a guardrail before trusting monthly reports.

This is not fully implemented in the current import parser yet.

## 9. Implementation status

Already present:

- semicolon CSV parser in `lib/import/csv_ING.ts`;
- duplicate hash/fingerprint flow;
- import batch summary;
- account handling;
- category/rule matching;
- raw row preservation.

Updated in this phase:

- `server/routes/upload.ts` now returns Dutch natural-language upload/import messages;
- duplicate/import counts are included in the response message;
- malformed/unsupported/empty files receive Dutch errors.

Still needed later:

- explicit required-column validation before row parsing;
- resulting-balance parsing and reconciliation;
- tests for wrong file, duplicate file, duplicate row, and Dutch messages;
- original ING export file storage/download model if current metadata is not enough.
