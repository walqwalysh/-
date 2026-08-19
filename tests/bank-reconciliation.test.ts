import { describe, expect, it } from "vitest";

import {
  calculateReconciliationSummary,
  formatAccountingDate,
  matchLineToEntry,
  type BankReconciliation,
  type BankReconciliationJournalEntry,
  type BankStatementLine,
} from "../lib/bank-reconciliation";

const bankAccountId = "account-bank";
const entries: BankReconciliationJournalEntry[] = [
  {
    id: "entry-deposit",
    date: "2026-01-15",
    description: "تحصيل فاتورة العميل",
    documentReference: "RC-145",
    lines: [{ accountId: bankAccountId, debit: 100, credit: 0 }, { accountId: "receivable", debit: 0, credit: 100 }],
  },
  {
    id: "entry-payment",
    date: "2026-01-18",
    description: "سداد مورد",
    documentReference: "PV-74",
    lines: [{ accountId: bankAccountId, debit: 0, credit: 25 }, { accountId: "payable", debit: 25, credit: 0 }],
  },
];

const line = (overrides: Partial<BankStatementLine> = {}): BankStatementLine => ({
  id: "statement-line",
  date: "2026-01-15",
  description: "تحصيل فاتورة العميل",
  amount: 100,
  reference: "RC-145",
  status: "unmatched",
  ...overrides,
});

const reconciliation = (lines: BankStatementLine[]): BankReconciliation => ({
  id: "reconciliation-1",
  bankAccountId: "bank-1",
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
  openingBalance: 10,
  closingBalance: 85,
  lines,
  createdAt: "2026-01-31T00:00:00.000Z",
  updatedAt: "2026-01-31T00:00:00.000Z",
});

describe("المطابقة المصرفية", () => {
  it("يقترح القيد البنكي المتوافق مع المبلغ والتاريخ والمرجع من دون تعديل أي قيد", () => {
    const statementLine = line();

    expect(matchLineToEntry(statementLine, entries, bankAccountId)).toBe("entry-deposit");
    expect(statementLine.status).toBe("unmatched");
    expect(statementLine.matchedEntryId).toBeUndefined();
  });

  it("يمنع اقتراح قيد استُخدم فعلياً في سطر كشف آخر", () => {
    expect(matchLineToEntry(line(), entries, bankAccountId, ["entry-deposit"])).toBeNull();
  });

  it("يحسب سطور الكشف والفروق من دون اعتبار السطور المستثناة", () => {
    const summary = calculateReconciliationSummary(reconciliation([
      line({ status: "matched", matchedEntryId: "entry-deposit" }),
      line({ id: "withdrawal", date: "2026-01-18", description: "سداد مورد", amount: -25, reference: "PV-74" }),
      line({ id: "excluded", date: "2026-01-20", description: "رسوم معلقة", amount: 20, status: "excluded" }),
    ]), entries, bankAccountId);

    expect(summary).toMatchObject({
      matchedCount: 1,
      unmatchedCount: 1,
      excludedCount: 1,
      matchedAmount: 100,
      unmatchedAmount: -25,
      excludedAmount: 20,
      statementMovement: 75,
      expectedClosingBalance: 85,
      closingDifference: 0,
      ledgerPeriodMovement: 75,
      ledgerDifference: 0,
    });
  });

  it("يعيد ملخصاً صفرياً لكشف فارغ ويدعم عرض التاريخ العربي الواضح", () => {
    const summary = calculateReconciliationSummary({ ...reconciliation([]), openingBalance: 0, closingBalance: 0 }, [], bankAccountId);

    expect(summary).toMatchObject({ matchedCount: 0, unmatchedCount: 0, excludedCount: 0, statementMovement: 0, expectedClosingBalance: 0, closingDifference: 0, ledgerDifference: 0 });
    expect(formatAccountingDate("2026-01-15")).toContain("يناير");
    expect(formatAccountingDate("not-a-date")).toBe("—");
  });
});
