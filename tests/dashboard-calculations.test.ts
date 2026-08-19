import { describe, expect, it } from "vitest";

import { calculateDashboardMetrics } from "../lib/dashboard-calculations";

const accounts = [
  { id: "revenue", code: "410", name: "إيراد", category: "revenue", nature: "credit", scope: "عام", createdAt: "2026-01-01" },
  { id: "expense", code: "510", name: "مصروف", category: "expense", nature: "debit", scope: "عام", createdAt: "2026-01-01" },
  { id: "cash", code: "110", name: "صندوق", category: "asset", nature: "debit", scope: "عام", createdAt: "2026-01-01" },
] as const;

describe("calculateDashboardMetrics", () => {
  it("يبدأ بمؤشرات صفرية ولا ينشئ نشاطاً افتراضياً عند غياب إدخالات المستخدم", () => {
    const result = calculateDashboardMetrics({ accounts: [...accounts], journalEntries: [], commercialDocuments: [], referenceDate: new Date("2026-08-19T00:00:00.000Z") });
    expect(result.currentMonthRevenue).toBe(0);
    expect(result.currentMonthExpense).toBe(0);
    expect(result.currentMonthNet).toBe(0);
    expect(result.postedInvoiceCount).toBe(0);
    expect(result.recentEntryCount).toBe(0);
    expect(result.monthlyPerformance).toHaveLength(6);
    expect(result.monthlyPerformance.every((month) => month.revenue === 0 && month.expense === 0)).toBe(true);
  });

  it("يحسب اتجاه الدخل والمصروف والنتيجة من القيود المتوازنة الفعلية فقط", () => {
    const result = calculateDashboardMetrics({
      accounts: [...accounts],
      commercialDocuments: [{ status: "posted", date: "2026-08-10" }, { status: "draft", date: "2026-08-10" }],
      referenceDate: new Date("2026-08-19T00:00:00.000Z"),
      journalEntries: [
        { id: "j1", description: "بيع نقدي", date: "2026-08-10", createdAt: "2026-08-10", lines: [{ id: "l1", accountId: "cash", category: "asset", debit: 150, credit: 0 }, { id: "l2", accountId: "revenue", category: "revenue", debit: 0, credit: 150 }] },
        { id: "j2", description: "مصروف", date: "2026-08-12", createdAt: "2026-08-12", lines: [{ id: "l3", accountId: "expense", category: "expense", debit: 40, credit: 0 }, { id: "l4", accountId: "cash", category: "asset", debit: 0, credit: 40 }] },
      ],
    });
    expect(result.currentMonthRevenue).toBe(150);
    expect(result.currentMonthExpense).toBe(40);
    expect(result.currentMonthNet).toBe(110);
    expect(result.postedInvoiceCount).toBe(1);
    expect(result.recentEntryCount).toBe(2);
    expect(result.monthlyPerformance.at(-1)).toMatchObject({ revenue: 150, expense: 40 });
  });
});
