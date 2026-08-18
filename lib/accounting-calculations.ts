export type CalculationCategory = "asset" | "liability" | "equity" | "revenue" | "expense";

export type CalculationAccount = {
  id: string;
  category: CalculationCategory;
};

export type CalculationLine = {
  accountId: string;
  category: CalculationCategory;
  debit: number;
  credit: number;
};

export type CalculationJournal = { lines: CalculationLine[] };
export type CategoryTotals = Record<CalculationCategory, number>;
export type BalanceSheet = {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  difference: number;
  isBalanced: boolean;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const safeMoney = (value: number) => Number.isFinite(value) && value > 0 ? roundMoney(value) : 0;
const debitNormalCategories: CalculationCategory[] = ["asset", "expense"];

export const zeroTotals = (): CategoryTotals => ({ asset: 0, liability: 0, equity: 0, revenue: 0, expense: 0 });

export function validateJournalLines(lines: CalculationLine[]) {
  const debitTotal = roundMoney(lines.reduce((total, line) => total + safeMoney(line.debit), 0));
  const creditTotal = roundMoney(lines.reduce((total, line) => total + safeMoney(line.credit), 0));
  const difference = roundMoney(debitTotal - creditTotal);
  const hasInvalidLine = lines.some((line) => {
    const debit = safeMoney(line.debit);
    const credit = safeMoney(line.credit);
    return !line.accountId || (debit === 0 && credit === 0) || (debit > 0 && credit > 0);
  });
  return {
    debitTotal,
    creditTotal,
    difference,
    isBalanced: lines.length >= 2 && !hasInvalidLine && Math.abs(difference) < 0.01,
  };
}

export function calculateAccountBalances(accounts: CalculationAccount[], journals: CalculationJournal[]) {
  const balances = Object.fromEntries(accounts.map((account) => [account.id, 0])) as Record<string, number>;
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  journals.forEach((journal) => {
    if (!validateJournalLines(journal.lines).isBalanced) return;
    journal.lines.forEach((line) => {
      const account = accountsById.get(line.accountId);
      if (!account) return;
      const netMovement = debitNormalCategories.includes(account.category)
        ? safeMoney(line.debit) - safeMoney(line.credit)
        : safeMoney(line.credit) - safeMoney(line.debit);
      balances[account.id] = roundMoney((balances[account.id] ?? 0) + netMovement);
    });
  });
  return balances;
}

export function calculateCategoryTotals(accounts: CalculationAccount[], accountBalances: Record<string, number>): CategoryTotals {
  return accounts.reduce<CategoryTotals>((totals, account) => {
    totals[account.category] = roundMoney(totals[account.category] + (accountBalances[account.id] ?? 0));
    return totals;
  }, zeroTotals());
}

export function calculateNetIncome(totals: CategoryTotals) {
  return roundMoney(totals.revenue - totals.expense);
}

export function calculateBalanceSheet(totals: CategoryTotals): BalanceSheet {
  const totalAssets = roundMoney(totals.asset);
  const totalLiabilities = roundMoney(totals.liability);
  const totalEquity = roundMoney(totals.equity + calculateNetIncome(totals));
  const totalLiabilitiesAndEquity = roundMoney(totalLiabilities + totalEquity);
  const difference = roundMoney(totalAssets - totalLiabilitiesAndEquity);
  return { totalAssets, totalLiabilities, totalEquity, totalLiabilitiesAndEquity, difference, isBalanced: Math.abs(difference) < 0.01 };
}
