import { describe, expect, it } from "vitest";

import { calculateGeneralLedger } from "../lib/accounting-calculations";

describe("calculateGeneralLedger", () => {
  const accounts = [
    { id: "cash", category: "asset" as const },
    { id: "capital", category: "equity" as const },
    { id: "revenue", category: "revenue" as const },
  ];

  it("يرتب الحركات المتوازنة زمنياً ويحسب الرصيد الجاري", () => {
    const ledger = calculateGeneralLedger(accounts, [
      { id: "sale", date: "2026-08-18", description: "بيع نقدي", lines: [{ accountId: "cash", category: "asset" as const, debit: 25, credit: 0 }, { accountId: "revenue", category: "revenue" as const, debit: 0, credit: 25 }] },
      { id: "opening", date: "2026-08-01", description: "رأس مال", lines: [{ accountId: "cash", category: "asset" as const, debit: 100, credit: 0 }, { accountId: "capital", category: "equity" as const, debit: 0, credit: 100 }] },
    ]);

    expect(ledger.cash).toEqual([
      expect.objectContaining({ journalId: "opening", runningDebit: 100, runningCredit: 0 }),
      expect.objectContaining({ journalId: "sale", runningDebit: 125, runningCredit: 0 }),
    ]);
    expect(ledger.revenue).toEqual([expect.objectContaining({ debit: 0, credit: 25, runningDebit: 0, runningCredit: 25 })]);
  });

  it("لا ينشئ أسطراً من قيد غير متوازن", () => {
    const ledger = calculateGeneralLedger(accounts, [
      { id: "invalid", date: "2026-08-18", lines: [{ accountId: "cash", category: "asset" as const, debit: 90, credit: 0 }, { accountId: "capital", category: "equity" as const, debit: 0, credit: 50 }] },
    ]);

    expect(ledger.cash).toEqual([]);
    expect(ledger.capital).toEqual([]);
  });
});
