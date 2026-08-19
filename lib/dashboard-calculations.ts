import type { Account, JournalEntry } from "./accounting";

export type MonthlyPerformance = { key: string; label: string; revenue: number; expense: number };

export type DashboardMetrics = {
  currentMonthRevenue: number;
  currentMonthExpense: number;
  currentMonthNet: number;
  postedInvoiceCount: number;
  recentEntryCount: number;
  monthlyPerformance: MonthlyPerformance[];
};

type DocumentLike = { status: "draft" | "posted" | "void"; date: string };

const arabicMonthFormatter = new Intl.DateTimeFormat("ar", { month: "short" });

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function accountEffect(account: Account | undefined, debit: number, credit: number) {
  if (!account) return { revenue: 0, expense: 0 };
  if (account.category === "revenue") return { revenue: credit - debit, expense: 0 };
  if (account.category === "expense") return { revenue: 0, expense: debit - credit };
  return { revenue: 0, expense: 0 };
}

/** يبني مؤشرات لوحة التحكم من القيود والعمليات المُدخلة فقط، بلا قيم نموذجية. */
export function calculateDashboardMetrics(input: { accounts: Account[]; journalEntries: JournalEntry[]; commercialDocuments: DocumentLike[]; referenceDate?: Date }): DashboardMetrics {
  const referenceDate = input.referenceDate ?? new Date();
  const accountById = new Map(input.accounts.map((account) => [account.id, account]));
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - (5 - index), 1));
    return { key: monthKey(date), label: arabicMonthFormatter.format(date), revenue: 0, expense: 0 };
  });
  const byMonth = new Map(months.map((month) => [month.key, month]));

  for (const entry of input.journalEntries) {
    const bucket = byMonth.get(entry.date.slice(0, 7));
    if (!bucket) continue;
    for (const line of entry.lines) {
      const effect = accountEffect(accountById.get(line.accountId), Number(line.debit) || 0, Number(line.credit) || 0);
      bucket.revenue += effect.revenue;
      bucket.expense += effect.expense;
    }
  }

  const currentMonth = byMonth.get(monthKey(referenceDate)) ?? { revenue: 0, expense: 0 };
  return {
    currentMonthRevenue: Number(currentMonth.revenue.toFixed(2)),
    currentMonthExpense: Number(currentMonth.expense.toFixed(2)),
    currentMonthNet: Number((currentMonth.revenue - currentMonth.expense).toFixed(2)),
    postedInvoiceCount: input.commercialDocuments.filter((document) => document.status === "posted" && document.date.slice(0, 7) === monthKey(referenceDate)).length,
    recentEntryCount: input.journalEntries.filter((entry) => entry.date.slice(0, 7) === monthKey(referenceDate)).length,
    monthlyPerformance: months.map((month) => ({ ...month, revenue: Number(month.revenue.toFixed(2)), expense: Number(month.expense.toFixed(2)) })),
  };
}
