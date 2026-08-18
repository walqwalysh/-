import type { CommercialDocument, DepreciationRecord, FixedAsset, InventoryItem, InventoryMovement, PayrollRun, Voucher } from "@/lib/accounting";

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const safeNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export type DocumentTotals = { count: number; net: number; tax: number; total: number };
export type InventoryPosition = { itemId: string; name: string; unit: string; quantity: number; value: number; isBelowReorderLevel: boolean };
export type PayrollTotals = { count: number; gross: number; deductions: number; net: number };
export type AssetPosition = { assetId: string; name: string; cost: number; accumulatedDepreciation: number; carryingAmount: number };
export type CashFlowTotals = { receiptCount: number; paymentCount: number; inflow: number; outflow: number; net: number };

export type OperationalReports = {
  sales: DocumentTotals;
  purchases: DocumentTotals;
  tax: { outputTax: number; inputTax: number; netPayable: number };
  inventory: InventoryPosition[];
  payroll: PayrollTotals;
  assets: AssetPosition[];
  cashFlow: CashFlowTotals;
};

const zeroDocuments = (): DocumentTotals => ({ count: 0, net: 0, tax: 0, total: 0 });

function documentTotals(documents: CommercialDocument[], type: CommercialDocument["type"]): DocumentTotals {
  return documents
    .filter((document) => document.status === "posted" && document.type === type)
    .reduce<DocumentTotals>((total, document) => ({
      count: total.count + 1,
      net: money(total.net + safeNumber(document.netAmount)),
      tax: money(total.tax + safeNumber(document.taxAmount)),
      total: money(total.total + safeNumber(document.totalAmount)),
    }), zeroDocuments());
}

function inventoryPositions(items: InventoryItem[], movements: InventoryMovement[]): InventoryPosition[] {
  return items
    .map((item) => {
      const position = movements
        .filter((movement) => movement.inventoryItemId === item.id)
        .reduce(
          (total, movement) => {
            const quantity = safeNumber(movement.quantity);
            const direction = movement.type === "receipt" ? 1 : -1;
            const unitCost = safeNumber(movement.unitCost) || safeNumber(item.standardCost);
            return { quantity: money(total.quantity + direction * quantity), value: money(total.value + direction * quantity * unitCost) };
          },
          { quantity: 0, value: 0 },
        );
      const reorderLevel = safeNumber(item.reorderLevel);
      return {
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        quantity: position.quantity,
        value: position.value,
        isBelowReorderLevel: reorderLevel > 0 && position.quantity <= reorderLevel,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "ar"));
}

function payrollTotals(runs: PayrollRun[]): PayrollTotals {
  return runs.filter((run) => run.status === "posted").reduce<PayrollTotals>(
    (total, run) => ({
      count: total.count + 1,
      gross: money(total.gross + safeNumber(run.basicSalary) + safeNumber(run.allowances)),
      deductions: money(total.deductions + safeNumber(run.deductions)),
      net: money(total.net + safeNumber(run.netAmount)),
    }),
    { count: 0, gross: 0, deductions: 0, net: 0 },
  );
}

function assetPositions(assets: FixedAsset[], records: DepreciationRecord[]): AssetPosition[] {
  return assets
    .filter((asset) => asset.status === "active")
    .map((asset) => {
      const accumulatedDepreciation = money(
        records.filter((record) => record.assetId === asset.id).reduce((sum, record) => sum + safeNumber(record.amount), 0),
      );
      const cost = safeNumber(asset.cost);
      const carryingAmount = money(Math.max(safeNumber(asset.salvageValue), cost - accumulatedDepreciation));
      return { assetId: asset.id, name: asset.name, cost, accumulatedDepreciation, carryingAmount };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "ar"));
}

function voucherCashFlow(vouchers: Voucher[]): CashFlowTotals {
  return vouchers.reduce<CashFlowTotals>(
    (total, voucher) => {
      const amount = safeNumber(voucher.amount);
      if (voucher.type === "receipt") {
        return { ...total, receiptCount: total.receiptCount + 1, inflow: money(total.inflow + amount), net: money(total.net + amount) };
      }
      return { ...total, paymentCount: total.paymentCount + 1, outflow: money(total.outflow + amount), net: money(total.net - amount) };
    },
    { receiptCount: 0, paymentCount: 0, inflow: 0, outflow: 0, net: 0 },
  );
}

/**
 * يلخص بيانات التشغيل المدخلة فعلياً فقط؛ المسودات والمستندات الملغاة لا تدخل في النتائج.
 */
export function calculateOperationalReports(input: {
  documents: CommercialDocument[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  payrollRuns: PayrollRun[];
  fixedAssets: FixedAsset[];
  depreciationRecords: DepreciationRecord[];
  vouchers: Voucher[];
}): OperationalReports {
  const sales = documentTotals(input.documents, "sales_invoice");
  const purchases = documentTotals(input.documents, "purchase_invoice");
  return {
    sales,
    purchases,
    tax: { outputTax: sales.tax, inputTax: purchases.tax, netPayable: money(sales.tax - purchases.tax) },
    inventory: inventoryPositions(input.inventoryItems, input.inventoryMovements),
    payroll: payrollTotals(input.payrollRuns),
    assets: assetPositions(input.fixedAssets, input.depreciationRecords),
    cashFlow: voucherCashFlow(input.vouchers),
  };
}
