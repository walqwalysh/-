import { describe, expect, it } from "vitest";

import { calculateOperationalReports } from "../lib/operational-reports";

describe("calculateOperationalReports", () => {
  it("يبدأ من أرقام صفرية ولا ينشئ بيانات تشغيلية افتراضية", () => {
    const reports = calculateOperationalReports({
      documents: [],
      inventoryItems: [],
      inventoryMovements: [],
      payrollRuns: [],
      fixedAssets: [],
      depreciationRecords: [],
      vouchers: [],
    });

    expect(reports.sales).toEqual({ count: 0, net: 0, tax: 0, total: 0 });
    expect(reports.purchases).toEqual({ count: 0, net: 0, tax: 0, total: 0 });
    expect(reports.tax).toEqual({ outputTax: 0, inputTax: 0, netPayable: 0 });
    expect(reports.inventory).toEqual([]);
    expect(reports.payroll).toEqual({ count: 0, gross: 0, deductions: 0, net: 0 });
    expect(reports.assets).toEqual([]);
    expect(reports.cashFlow).toEqual({ receiptCount: 0, paymentCount: 0, inflow: 0, outflow: 0, net: 0 });
  });

  it("يتجاهل المسودات ويحسب الضريبة والتدفق النقدي من السجلات الفعلية فقط", () => {
    const reports = calculateOperationalReports({
      documents: [
        { id: "sale", number: "S-1", type: "sales_invoice", status: "posted", description: "بيع", date: "2026-08-18", lines: [], netAmount: 100, taxAmount: 15, totalAmount: 115, primaryAccountId: "revenue", settlementAccountId: "customer", createdAt: "2026-08-18" },
        { id: "purchase", number: "P-1", type: "purchase_invoice", status: "posted", description: "شراء", date: "2026-08-18", lines: [], netAmount: 40, taxAmount: 6, totalAmount: 46, primaryAccountId: "expense", settlementAccountId: "supplier", createdAt: "2026-08-18" },
        { id: "draft", number: "S-2", type: "sales_invoice", status: "draft", description: "مسودة", date: "2026-08-18", lines: [], netAmount: 900, taxAmount: 135, totalAmount: 1035, primaryAccountId: "revenue", settlementAccountId: "customer", createdAt: "2026-08-18" },
      ],
      inventoryItems: [{ id: "item", name: "صنف", unit: "قطعة", standardCost: 4, reorderLevel: 5, createdAt: "2026-08-18" }],
      inventoryMovements: [{ id: "receipt", inventoryItemId: "item", type: "receipt", quantity: 8, date: "2026-08-18", createdAt: "2026-08-18" }, { id: "issue", inventoryItemId: "item", type: "issue", quantity: 4, date: "2026-08-18", createdAt: "2026-08-18" }],
      payrollRuns: [{ id: "payroll", employeeId: "employee", date: "2026-08-18", basicSalary: 100, allowances: 20, deductions: 10, netAmount: 110, status: "posted", expenseAccountId: "expense", paymentAccountId: "cash", createdAt: "2026-08-18" }],
      fixedAssets: [{ id: "asset", name: "معدة", acquisitionDate: "2026-01-01", cost: 200, salvageValue: 20, usefulLifeMonths: 10, status: "active", assetAccountId: "asset", depreciationExpenseAccountId: "expense", accumulatedDepreciationAccountId: "accumulated", createdAt: "2026-01-01" }],
      depreciationRecords: [{ id: "dep", assetId: "asset", date: "2026-08-01", amount: 30, journalEntryId: "journal", createdAt: "2026-08-01" }],
      vouchers: [{ id: "receipt", voucherNumber: "R-1", type: "receipt", paymentMethod: "cash", partyName: "عميل", amount: 80, date: "2026-08-18", description: "تحصيل", cashAccountId: "cash", counterpartAccountId: "customer", journalEntryId: "j1", createdAt: "2026-08-18" }, { id: "payment", voucherNumber: "P-1", type: "payment", paymentMethod: "cash", partyName: "مورد", amount: 25, date: "2026-08-18", description: "دفع", cashAccountId: "cash", counterpartAccountId: "supplier", journalEntryId: "j2", createdAt: "2026-08-18" }],
    });

    expect(reports.sales).toEqual({ count: 1, net: 100, tax: 15, total: 115 });
    expect(reports.purchases).toEqual({ count: 1, net: 40, tax: 6, total: 46 });
    expect(reports.tax).toEqual({ outputTax: 15, inputTax: 6, netPayable: 9 });
    expect(reports.inventory[0]).toMatchObject({ quantity: 4, value: 16, isBelowReorderLevel: true });
    expect(reports.payroll).toEqual({ count: 1, gross: 120, deductions: 10, net: 110 });
    expect(reports.assets[0]).toMatchObject({ accumulatedDepreciation: 30, carryingAmount: 170 });
    expect(reports.cashFlow).toEqual({ receiptCount: 1, paymentCount: 1, inflow: 80, outflow: 25, net: 55 });
  });
});
