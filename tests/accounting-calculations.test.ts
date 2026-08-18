import { describe, expect, it } from "vitest";
import { calculateCategoryTotals, calculateFinancialPosition, calculateNetIncome, zeroTotals } from "../lib/accounting-calculations";

describe("منطق المحاسب الذكي", () => {
  it("يبدأ جميع الأرصدة والصافي من الصفر دون أي بيانات افتراضية", () => {
    const totals = zeroTotals();
    expect(totals).toEqual({ asset: 0, liability: 0, equity: 0, revenue: 0, expense: 0 });
    expect(calculateNetIncome(totals)).toBe(0);
    expect(calculateFinancialPosition(totals)).toBe(0);
  });

  it("يجمع الحركات المدخلة فقط حسب الفئة ويحسب التقارير بشكل صحيح", () => {
    const totals = calculateCategoryTotals([
      { category: "asset", amount: 1500 },
      { category: "liability", amount: 300 },
      { category: "equity", amount: 200 },
      { category: "revenue", amount: 850 },
      { category: "expense", amount: 125 },
    ]);
    expect(totals).toEqual({ asset: 1500, liability: 300, equity: 200, revenue: 850, expense: 125 });
    expect(calculateNetIncome(totals)).toBe(725);
    expect(calculateFinancialPosition(totals)).toBe(1000);
  });
});
