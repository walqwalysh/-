import { describe, expect, it } from "vitest";

import { calculateTrialBalance } from "../lib/accounting-calculations";

describe("calculateTrialBalance", () => {
  const accounts = [
    { id: "cash", category: "asset" as const },
    { id: "capital", category: "equity" as const },
    { id: "revenue", category: "revenue" as const },
  ];

  it("يعرض أرصدة مدينة ودائنة متساوية للقيود المتوازنة", () => {
    const result = calculateTrialBalance(accounts, [
      { lines: [{ accountId: "cash", category: "asset" as const, debit: 100, credit: 0 }, { accountId: "capital", category: "equity" as const, debit: 0, credit: 100 }] },
      { lines: [{ accountId: "cash", category: "asset" as const, debit: 25, credit: 0 }, { accountId: "revenue", category: "revenue" as const, debit: 0, credit: 25 }] },
    ]);
    expect(result.lines).toEqual([
      { accountId: "cash", debit: 125, credit: 0 },
      { accountId: "capital", debit: 0, credit: 100 },
      { accountId: "revenue", debit: 0, credit: 25 },
    ]);
    expect(result.totalDebit).toBe(125);
    expect(result.totalCredit).toBe(125);
    expect(result.isBalanced).toBe(true);
  });

  it("يتجاهل القيد غير المتوازن بالكامل", () => {
    const result = calculateTrialBalance(accounts, [
      { lines: [{ accountId: "cash", category: "asset" as const, debit: 50, credit: 0 }, { accountId: "capital", category: "equity" as const, debit: 0, credit: 40 }] },
    ]);
    expect(result.totalDebit).toBe(0);
    expect(result.totalCredit).toBe(0);
    expect(result.isBalanced).toBe(true);
  });
});
