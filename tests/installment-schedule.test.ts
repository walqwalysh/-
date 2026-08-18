// @ts-nocheck
import { describe, expect, it } from "vitest";
import { calculateInstallmentPeriods, dueInstallmentPeriods } from "../lib/installment-schedule";

describe("جدولة الأقساط الشهرية", () => {
  const schedule = {
    totalAmount: 250,
    installmentAmount: 100,
    startDate: "2026-01-31",
    endDate: "2026-03-31",
  };

  it("يولد المبالغ الشهرية ويحتفظ بالباقي في القسط الأخير", () => {
    expect(calculateInstallmentPeriods(schedule)).toEqual([
      { periodKey: "2026-01-31", dueDate: "2026-01-31", amount: 100 },
      { periodKey: "2026-02-28", dueDate: "2026-02-28", amount: 100 },
      { periodKey: "2026-03-31", dueDate: "2026-03-31", amount: 50 },
    ]);
  });

  it("يعيد فقط الأقساط المستحقة التي لم يسبق ترحيلها", () => {
    expect(dueInstallmentPeriods(schedule, "2026-03-31", ["2026-01-31", "2026-03-31"])).toEqual([
      { periodKey: "2026-02-28", dueDate: "2026-02-28", amount: 100 },
    ]);
  });

  it("لا ينشئ استحقاقاً لتاريخ مرجعي غير صالح", () => {
    expect(dueInstallmentPeriods(schedule, "31-03-2026")).toEqual([]);
  });
});
