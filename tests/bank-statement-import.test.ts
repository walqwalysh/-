import { parseStatementAmount, parseStatementDate, previewBankStatementRows } from "../lib/bank-statement-import";
import { describe, expect, it } from "vitest";

describe("استيراد كشف البنك من Excel", () => {
  it("يقرأ العناوين العربية وتاريخ Excel الرقمي والمبلغ العربي والمرجع", () => {
    const preview = previewBankStatementRows([
      { التاريخ: 46037, البيان: "تحصيل فاتورة", المبلغ: "١٬٢٥٠٫٥٠", "رقم المرجع": "RC-145" },
    ], { periodStart: "2026-01-01", periodEnd: "2026-01-31" });

    expect(preview.issues).toEqual([]);
    expect(preview.lines).toEqual([{ date: "2026-01-15", description: "تحصيل فاتورة", amount: 1250.5, reference: "RC-145" }]);
  });

  it("يحوّل الدائن إلى إيداع موجب والمدين إلى سحب سالب عند غياب عمود المبلغ", () => {
    const preview = previewBankStatementRows([
      { Date: "15/01/2026", Description: "إيداع نقدي", Credit: "400.00", Debit: "" },
      { Date: "16/01/2026", Description: "رسوم بنك", Credit: "", Debit: "25,50" },
    ]);

    expect(preview.issues).toEqual([]);
    expect(preview.lines.map((line) => line.amount)).toEqual([400, -25.5]);
  });

  it("يرفض الملف عندما لا توجد الأعمدة الأساسية ولا ينشئ سطوراً بديلة", () => {
    const preview = previewBankStatementRows([{ التاريخ: "2026-01-15", المبلغ: 100 }]);

    expect(preview.hasRequiredColumns).toBe(false);
    expect(preview.lines).toEqual([]);
    expect(preview.issues[0].message).toContain("البيان أو الوصف");
  });

  it("يمنع أي حفظ جزئي عندما يقع أحد السطور خارج فترة كشف المطابقة", () => {
    const preview = previewBankStatementRows([
      { التاريخ: "2026-01-15", البيان: "تحصيل", المبلغ: 100 },
      { التاريخ: "2026-02-01", البيان: "تحصيل لاحق", المبلغ: 200 },
    ], { periodStart: "2026-01-01", periodEnd: "2026-01-31" });

    expect(preview.lines).toHaveLength(1);
    expect(preview.issues).toEqual([{ rowNumber: 3, message: "تاريخ الحركة يقع خارج فترة كشف المطابقة المختار." }]);
  });

  it("يطبع القيم والتواريخ غير الصالحة بصورة آمنة", () => {
    expect(parseStatementAmount("(1,250.75)")).toBe(-1250.75);
    expect(parseStatementAmount("غير رقمي")).toBeNull();
    expect(parseStatementDate("31/02/2026")).toBeNull();
    expect(parseStatementDate("١٥/٠١/٢٠٢٦")).toBe("2026-01-15");
  });
});
