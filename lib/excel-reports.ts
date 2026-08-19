import * as XLSX from "xlsx";

import {
  calculateAccountBalances,
  calculateBalanceSheet,
  calculateCategoryTotals,
  calculateGeneralLedger,
  calculateTrialBalance,
} from "./accounting-calculations";
import type { AccountingState, AccountCategory } from "./accounting";
import { formatAccountingDate } from "./date-utils";
import { calculateOperationalReports } from "./operational-reports";

type CellValue = string | number;

export type ReportSheet = {
  name: string;
  headers: string[];
  rows: CellValue[][];
};

const categoryLabels: Record<AccountCategory, string> = {
  asset: "أصول",
  liability: "خصوم",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};

const toDateOnly = (value: string) => value.slice(0, 10);

const metricRows = (metrics: Array<[string, number]>): CellValue[][] => metrics.map(([label, value]) => [label, value]);

/**
 * يبني صفوف تقارير من الحالة المحلية الحالية فقط. لا يُدخل هذا المولد بيانات افتراضية
 * أو قيود غير متوازنة؛ وتبقى الأوراق التفصيلية فارغة عند غياب إدخال المستخدم.
 */
export function buildReportSheets(state: AccountingState): ReportSheet[] {
  const accounts = state.accounts;
  const journals = state.journalEntries;
  const balances = calculateAccountBalances(accounts, journals);
  const totals = calculateCategoryTotals(accounts, balances);
  const balanceSheet = calculateBalanceSheet(totals);
  const trialBalance = calculateTrialBalance(accounts, journals);
  const ledger = calculateGeneralLedger(
    accounts,
    journals.map((journal) => ({
      id: journal.id,
      date: journal.date,
      description: journal.description,
      reference: journal.documentReference,
      lines: journal.lines,
    })),
  );
  const operational = calculateOperationalReports({
    documents: state.commercialDocuments,
    inventoryItems: state.inventoryItems,
    inventoryMovements: state.inventoryMovements,
    payrollRuns: state.payrollRuns,
    fixedAssets: state.fixedAssets,
    depreciationRecords: state.depreciationRecords,
    vouchers: state.vouchers,
  });
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const journalById = new Map(journals.map((journal) => [journal.id, journal]));
  const bankAccountById = new Map(state.cashBankAccounts.map((account) => [account.id, account]));
  const reconciliationStatusLabel = { matched: "مطابق", unmatched: "غير مطابق", excluded: "مستثنى" } as const;
  const reconciliationRows = state.bankReconciliations.flatMap((reconciliation) => reconciliation.lines.map((line) => {
    const journal = line.matchedEntryId ? journalById.get(line.matchedEntryId) : undefined;
    return [
      bankAccountById.get(reconciliation.bankAccountId)?.name ?? "",
      `${formatAccountingDate(reconciliation.periodStart)} — ${formatAccountingDate(reconciliation.periodEnd)}`,
      formatAccountingDate(line.date),
      line.description,
      line.reference ?? "",
      line.amount,
      reconciliationStatusLabel[line.status],
      journal?.date ? formatAccountingDate(journal.date) : "",
      journal?.description ?? "",
      journal?.documentReference ?? "",
    ];
  }));
  const currencyRows = journals.map((journal) => [
    toDateOnly(journal.date),
    journal.description,
    journal.documentReference ?? "",
    journal.currency ?? state.currency,
    journal.fxRate ?? "",
    journal.lines.reduce((total, line) => total + line.debit, 0),
  ]);

  const trialRows = trialBalance.lines.map((line) => {
    const account = accountById.get(line.accountId);
    return [account?.code ?? "", account?.name ?? "", account ? categoryLabels[account.category] : "", line.debit, line.credit];
  });
  trialRows.push(["", "الإجمالي", "", trialBalance.totalDebit, trialBalance.totalCredit]);

  const ledgerRows = accounts.flatMap((account) =>
    (ledger[account.id] ?? []).map((line) => [
      account.code,
      account.name,
      toDateOnly(line.date),
      line.description,
      line.reference ?? "",
      line.debit,
      line.credit,
      line.runningDebit,
      line.runningCredit,
    ]),
  );

  return [
    {
      name: "ميزان المراجعة",
      headers: ["كود الحساب", "اسم الحساب", "الفئة", "مدين", "دائن"],
      rows: trialRows,
    },
    {
      name: "دفتر الأستاذ",
      headers: ["كود الحساب", "اسم الحساب", "التاريخ", "البيان", "المرجع", "مدين", "دائن", "رصيد مدين", "رصيد دائن"],
      rows: ledgerRows,
    },
    {
      name: "عملات القيود",
      headers: ["التاريخ", "البيان", "المرجع", "عملة المستند", "سعر الصرف", "قيمة القيد بدفتر الأستاذ"],
      rows: currencyRows,
    },
    {
      name: "كشف المطابقة المصرفية",
      headers: ["الحساب البنكي", "فترة الكشف", "التاريخ", "البيان", "مرجع كشف البنك", "المبلغ", "الحالة", "تاريخ القيد", "القيد المرتبط", "مرجع القيد"],
      rows: reconciliationRows,
    },
    {
      name: "الميزانية العمومية",
      headers: ["البند", "القيمة"],
      rows: metricRows([
        ["إجمالي الأصول", balanceSheet.totalAssets],
        ["إجمالي الخصوم", balanceSheet.totalLiabilities],
        ["إجمالي حقوق الملكية", balanceSheet.totalEquity],
        ["إجمالي الخصوم وحقوق الملكية", balanceSheet.totalLiabilitiesAndEquity],
        ["فارق التوازن", balanceSheet.difference],
      ]),
    },
    {
      name: "المبيعات",
      headers: ["المؤشر", "القيمة"],
      rows: metricRows([
        ["عدد الفواتير المرحلة", operational.sales.count],
        ["صافي المبيعات", operational.sales.net],
        ["ضريبة المخرجات", operational.sales.tax],
        ["إجمالي المبيعات", operational.sales.total],
      ]),
    },
    {
      name: "المشتريات",
      headers: ["المؤشر", "القيمة"],
      rows: metricRows([
        ["عدد الفواتير المرحلة", operational.purchases.count],
        ["صافي المشتريات", operational.purchases.net],
        ["ضريبة المدخلات", operational.purchases.tax],
        ["إجمالي المشتريات", operational.purchases.total],
      ]),
    },
    {
      name: "المخزون",
      headers: ["الصنف", "الوحدة", "الكمية", "القيمة", "دون حد إعادة الطلب"],
      rows: operational.inventory.map((item) => [item.name, item.unit, item.quantity, item.value, item.isBelowReorderLevel ? "نعم" : "لا"]),
    },
    {
      name: "الرواتب",
      headers: ["المؤشر", "القيمة"],
      rows: metricRows([
        ["عدد مسيرات الرواتب المرحلة", operational.payroll.count],
        ["إجمالي الرواتب", operational.payroll.gross],
        ["الاستقطاعات", operational.payroll.deductions],
        ["صافي الرواتب", operational.payroll.net],
      ]),
    },
    {
      name: "الأصول الثابتة",
      headers: ["الأصل", "التكلفة", "مجمع الإهلاك", "القيمة الدفترية"],
      rows: operational.assets.map((asset) => [asset.name, asset.cost, asset.accumulatedDepreciation, asset.carryingAmount]),
    },
    {
      name: "التدفق النقدي",
      headers: ["المؤشر", "القيمة"],
      rows: metricRows([
        ["عدد سندات القبض", operational.cashFlow.receiptCount],
        ["عدد سندات الصرف", operational.cashFlow.paymentCount],
        ["التدفقات الداخلة", operational.cashFlow.inflow],
        ["التدفقات الخارجة", operational.cashFlow.outflow],
        ["صافي التدفق النقدي", operational.cashFlow.net],
      ]),
    },
    {
      name: "الضرائب",
      headers: ["المؤشر", "القيمة"],
      rows: metricRows([
        ["ضريبة المخرجات", operational.tax.outputTax],
        ["ضريبة المدخلات", operational.tax.inputTax],
        ["صافي الضريبة المستحقة", operational.tax.netPayable],
      ]),
    },
  ];
}

/** ينشئ مصنف Excel كاملاً يمكن كتابته كملف xlsx أو مشاركته من الجهاز. */
export function createReportsWorkbook(state: AccountingState) {
  const workbook = XLSX.utils.book_new();
  buildReportSheets(state).forEach((sheet) => {
    const worksheet = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
    worksheet["!cols"] = sheet.headers.map((header) => ({ wch: Math.max(header.length + 2, 16) }));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });
  return workbook;
}

export const reportExportFilename = (date = new Date()) => `تقارير-المحاسب-الذكي-${date.toISOString().slice(0, 10)}.xlsx`;
