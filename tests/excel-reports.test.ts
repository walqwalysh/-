import { describe, expect, it } from "vitest";
import { defaultAccountNumbering } from "../lib/account-numbering";
import type { AccountingState } from "../lib/accounting";
import { buildReportSheets, createReportsWorkbook } from "../lib/excel-reports";

const emptyState: AccountingState = {
  accounts: [],
  journalEntries: [],
  contacts: [],
  accountingItems: [],
  installments: [],
  costCenters: [],
  vouchers: [],
  commercialDocuments: [],
  inventoryItems: [],
  inventoryMovements: [],
  employees: [],
  payrollRuns: [],
  fixedAssets: [],
  depreciationRecords: [],
  auditLog: [],
  currency: "د.ل",
  termsAccepted: false,
  numbering: defaultAccountNumbering(),
  subranges: [],
};

describe("Excel report export", () => {
  it("ينشئ مصنفاً يحوي جميع أوراق التقارير المالية والتشغيلية", () => {
    const workbook = createReportsWorkbook(emptyState);

    expect(workbook.SheetNames).toEqual([
      "ميزان المراجعة",
      "دفتر الأستاذ",
      "الميزانية العمومية",
      "المبيعات",
      "المشتريات",
      "المخزون",
      "الرواتب",
      "الأصول الثابتة",
      "التدفق النقدي",
      "الضرائب",
    ]);
  });

  it("يصدر الحالة الفارغة بقيم محسوبة صفرية ومن دون صفوف تشغيلية افتراضية", () => {
    const sheets = buildReportSheets(emptyState);
    const findSheet = (name: string) => sheets.find((sheet) => sheet.name === name)!;

    expect(findSheet("ميزان المراجعة").rows).toEqual([["", "الإجمالي", "", 0, 0]]);
    expect(findSheet("دفتر الأستاذ").rows).toEqual([]);
    expect(findSheet("المخزون").rows).toEqual([]);
    expect(findSheet("الأصول الثابتة").rows).toEqual([]);
    expect(findSheet("الميزانية العمومية").rows.map((row) => row[1])).toEqual([0, 0, 0, 0, 0]);
    expect(findSheet("المبيعات").rows.map((row) => row[1])).toEqual([0, 0, 0, 0]);
    expect(findSheet("الضرائب").rows.map((row) => row[1])).toEqual([0, 0, 0]);
  });
});
