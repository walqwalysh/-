import { describe, expect, it } from "vitest";
import { calculateAccountBalances, calculateBalanceSheet, calculateCategoryTotals, calculateNetIncome, validateJournalLines, zeroTotals } from "../lib/accounting-calculations";

const accounts = [
  { id: "cash", category: "asset" as const }, { id: "capital", category: "equity" as const }, { id: "sales", category: "revenue" as const }, { id: "rent", category: "expense" as const },
];

describe("منطق القيود المزدوجة", () => {
  it("يبدأ من أرصدة وميزانية صفرية", () => {
    const totals = zeroTotals();
    expect(totals).toEqual({ asset: 0, liability: 0, equity: 0, revenue: 0, expense: 0 });
    expect(calculateBalanceSheet(totals)).toMatchObject({ totalAssets: 0, totalLiabilitiesAndEquity: 0, difference: 0, isBalanced: true });
  });
  it("يرفض القيد عندما يختلف المدين عن الدائن", () => {
    expect(validateJournalLines([{ accountId: "cash", category: "asset", debit: 100, credit: 0 }, { accountId: "capital", category: "equity", debit: 0, credit: 90 }]).isBalanced).toBe(false);
  });
  it("يحسب الأرصدة والميزانية العمومية من القيود المتوازنة فقط", () => {
    const journals = [
      { lines: [{ accountId: "cash", category: "asset" as const, debit: 1500, credit: 0 }, { accountId: "capital", category: "equity" as const, debit: 0, credit: 1500 }] },
      { lines: [{ accountId: "cash", category: "asset" as const, debit: 850, credit: 0 }, { accountId: "sales", category: "revenue" as const, debit: 0, credit: 850 }] },
      { lines: [{ accountId: "rent", category: "expense" as const, debit: 125, credit: 0 }, { accountId: "cash", category: "asset" as const, debit: 0, credit: 125 }] },
      { lines: [{ accountId: "cash", category: "asset" as const, debit: 10, credit: 0 }, { accountId: "capital", category: "equity" as const, debit: 0, credit: 9 }] },
    ];
    const balances = calculateAccountBalances(accounts, journals);
    const totals = calculateCategoryTotals(accounts, balances);
    expect(balances).toMatchObject({ cash: 2225, capital: 1500, sales: 850, rent: 125 });
    expect(calculateNetIncome(totals)).toBe(725);
    expect(calculateBalanceSheet(totals)).toMatchObject({ totalAssets: 2225, totalLiabilitiesAndEquity: 2225, difference: 0, isBalanced: true });
  });
});
