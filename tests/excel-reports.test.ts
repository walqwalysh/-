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
  cashBankAccounts: [],
  cashBankTransactions: [],
  budgets: [],
  budgetLines: [],
  auditLog: [],
  currency: "د.ل",
  currencies: [],
  numberLocale: "arabic",
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
      "عملات القيود",
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
    expect(findSheet("عملات القيود").rows).toEqual([]);
    expect(findSheet("المخزون").rows).toEqual([]);
    expect(findSheet("الأصول الثابتة").rows).toEqual([]);
    expect(findSheet("الميزانية العمومية").rows.map((row) => row[1])).toEqual([0, 0, 0, 0, 0]);
    expect(findSheet("المبيعات").rows.map((row) => row[1])).toEqual([0, 0, 0, 0]);
    expect(findSheet("الضرائب").rows.map((row) => row[1])).toEqual([0, 0, 0]);
  });

  it("يوثق عملة المستند وسعر الصرف المُدخل فقط في ورقة مستقلة", () => {
    const state: AccountingState = {
      ...emptyState,
      accounts: [
        { id: "cash", code: "1001", name: "الصندوق", category: "asset", nature: "debit", scope: "عام", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "capital", code: "3001", name: "رأس المال", category: "equity", nature: "credit", scope: "عام", createdAt: "2026-01-01T00:00:00.000Z" },
      ],
      journalEntries: [{ id: "entry-1", description: "إيداع نقدي", date: "2026-01-03", createdAt: "2026-01-03T00:00:00.000Z", currency: "USD", fxRate: 4.85, documentReference: "INV-7", lines: [{ id: "line-1", accountId: "cash", category: "asset", debit: 250, credit: 0 }, { id: "line-2", accountId: "capital", category: "equity", debit: 0, credit: 250 }] }],
    };
    const currencySheet = buildReportSheets(state).find((sheet) => sheet.name === "عملات القيود")!;

    expect(currencySheet.rows).toEqual([["2026-01-03", "إيداع نقدي", "INV-7", "USD", 4.85, 250]]);
  });
});
