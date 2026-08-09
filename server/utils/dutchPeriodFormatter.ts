const DUTCH_MONTHS = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
] as const;

export const formatDutchMonthYear = (year: number, month: number): string => {
  if (month < 1 || month > 12) throw new Error(`Ongeldige maand: ${month}`);
  return `${DUTCH_MONTHS[month - 1]} ${year}`;
};

export const formatReportSubject = (year: number, month: number): string =>
  `Maandrapport ${formatDutchMonthYear(year, month)}`;

export const formatReportTitle = (year: number, month: number): string =>
  `Financieel Rapport — ${formatDutchMonthYear(year, month)}`;
