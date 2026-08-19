import { describe, expect, it } from "vitest";

import { replaceMatchingAccountCode, validateAccountUpdate } from "../lib/account-update";

const accounts = [
  { id: "cash", name: "الصندوق", code: "101", category: "asset" as const },
  { id: "bank", name: "البنك", code: "102", category: "asset" as const },
  { id: "sales", name: "المبيعات", code: "401", category: "revenue" as const },
];

describe("تعديل حساب الأستاذ العام", () => {
  it("يقبل الاسم والكود الجديدين بعد إزالة المسافات", () => {
    expect(validateAccountUpdate(accounts[0], { name: " صندوق الفرع ", code: " 103 " }, accounts, [])).toEqual({ name: "صندوق الفرع", code: "103" });
  });

  it("يرفض كوداً مستخدماً أو اسماً مكرراً ضمن الفئة نفسها", () => {
    expect(() => validateAccountUpdate(accounts[0], { name: "صندوق جديد", code: "102" }, accounts, [])).toThrow("كود الحساب مستخدم بالفعل");
    expect(() => validateAccountUpdate(accounts[0], { name: "البنك", code: "103" }, accounts, [])).toThrow("يوجد حساب آخر بالاسم نفسه");
  });

  it("يحمي الأكواد المحجوزة للنطاقات الفرعية", () => {
    const ranges = [{ id: "branch", name: "حسابات الفروع", category: "asset" as const, prefix: "", start: 150, end: 199, createdAt: "2026-08-19T00:00:00.000Z" }];
    expect(() => validateAccountUpdate(accounts[0], { name: "الصندوق", code: "160" }, accounts, ranges)).toThrow("محجوز للنطاق الفرعي");
  });

  it("يلزم الحساب المرتبط بالنطاق الفرعي بالبقاء ضمن مداه", () => {
    const ranges = [{ id: "branch", name: "حسابات الفروع", category: "asset" as const, prefix: "BR-", start: 1, end: 9, createdAt: "2026-08-19T00:00:00.000Z" }];
    const branchAccount = { ...accounts[0], subrangeId: "branch" };
    expect(validateAccountUpdate(branchAccount, { name: "صندوق الفرع", code: "BR-2" }, accounts, ranges)).toEqual({ name: "صندوق الفرع", code: "BR-2" });
    expect(() => validateAccountUpdate(branchAccount, { name: "صندوق الفرع", code: "BR-20" }, accounts, ranges)).toThrow("ضمن نطاق");
  });

  it("يحدّث مرجع الكود المطابق فقط دون حساسية لحالة الأحرف", () => {
    expect(replaceMatchingAccountCode("cash-01", "CASH-01", "CASH-02")).toBe("CASH-02");
    expect(replaceMatchingAccountCode("BANK-01", "CASH-01", "CASH-02")).toBe("BANK-01");
  });
});
