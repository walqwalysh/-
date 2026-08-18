export type CalculationCategory = "asset" | "liability" | "equity" | "revenue" | "expense";

export type CalculationEntry = {
  category: CalculationCategory;
  amount: number;
};

export type CategoryTotals = Record<CalculationCategory, number>;

export const zeroTotals = (): CategoryTotals => ({ asset: 0, liability: 0, equity: 0, revenue: 0, expense: 0 });

export function calculateCategoryTotals(entries: CalculationEntry[]): CategoryTotals {
  return entries.reduce<CategoryTotals>((totals, entry) => {
    if (Number.isFinite(entry.amount) && entry.amount > 0) totals[entry.category] += entry.amount;
    return totals;
  }, zeroTotals());
}

export function calculateNetIncome(totals: CategoryTotals) {
  return totals.revenue - totals.expense;
}

export function calculateFinancialPosition(totals: CategoryTotals) {
  return totals.asset - totals.liability - totals.equity;
}
