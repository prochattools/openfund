import FinanceReportsPage from '@/ui/FinanceReportsPage';

type ReportsPageProps = {
  searchParams?: {
    year?: string;
    month?: string;
  };
};

const parseYear = (value?: string): number | undefined => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 2000 ? parsed : undefined;
};

const parseMonth = (value?: string): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
};

export default function ReportsPage({ searchParams }: ReportsPageProps) {
  return <FinanceReportsPage initialYear={parseYear(searchParams?.year)} initialMonth={parseMonth(searchParams?.month)} />;
}
