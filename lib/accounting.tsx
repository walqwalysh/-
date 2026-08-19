import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { calculateAccountBalances, calculateBalanceSheet, calculateCategoryTotals, calculateNetIncome, validateJournalLines, type BalanceSheet, type CalculationLine } from "@/lib/accounting-calculations";
import { defaultAccountNumbering, isCodeInSubrange, nextAccountCode, normaliseAccountNumbering, normaliseSubranges, subrangeForCode, type AccountNumbering, type AccountSubrange, type NewAccountSubrange } from "@/lib/account-numbering";
import { currencyOptionsForBase, normaliseCurrencyCode, type CurrencyOption } from "./currency-options";
import { normaliseDateOnly } from "@/lib/date-utils";
import { formatAmount, formatNumber, numberLocaleCode, setActiveNumberLocale, type NumberLocale } from "./number-formatting";
import { normaliseBankReconciliation, type BankReconciliation, type BankStatementLine, type BankStatementLineStatus, type NewBankStatementLine } from "./bank-reconciliation";

export { formatAmount, formatNumber, numberLocaleCode } from "./number-formatting";
export type { NumberLocale } from "./number-formatting";
export { currencyOptionsForBase, normaliseCurrencyCode } from "./currency-options";
export type { CurrencyOption } from "./currency-options";

export type AccountCategory = "asset" | "liability" | "equity" | "revenue" | "expense";
export type AccountNature = "debit" | "credit";
export type CurrencyDefinition = { id: string; code: string; name: string; createdAt: string };
export type Account = { id: string; code: string; name: string; category: AccountCategory; nature: AccountNature; scope: string; subrangeId?: string; createdAt: string };
export type JournalLine = CalculationLine & { id: string };
export type VoucherType = "receipt" | "payment";
export type PaymentMethod = "cash" | "cheque" | "bank_transfer" | "other";
export type JournalEntrySource =
  | { type: "installment"; installmentId: string; periodKey: string; externalEntryId: string }
  | { type: "voucher"; voucherId: string; voucherType: VoucherType }
  | { type: "commercial_document"; documentId: string; documentType: CommercialDocumentType }
  | { type: "payroll"; payrollRunId: string }
  | { type: "depreciation"; depreciationId: string; assetId: string }
  | { type: "reversal"; originalEntryId: string };
export type JournalEntry = { id: string; description: string; date: string; createdAt: string; lines: JournalLine[]; source?: JournalEntrySource; currency?: string; fxRate?: number; documentReference?: string; costCenterId?: string; reversalOfEntryId?: string };
export type CostCenter = { id: string; name: string; notes?: string; createdAt: string };
export type Voucher = { id: string; voucherNumber: string; type: VoucherType; paymentMethod: PaymentMethod; partyName: string; amount: number; date: string; description: string; cashAccountId: string; counterpartAccountId: string; journalEntryId: string; createdAt: string };
export type CashBankAccountType = "cash" | "bank";
export type CashBankAccount = { id: string; name: string; type: CashBankAccountType; accountId: string; bankName?: string; accountNumber?: string; notes?: string; createdAt: string };
export type CashBankTransactionType = "receipt" | "payment" | "transfer";
export type CashBankTransaction = { id: string; type: CashBankTransactionType; date: string; amount: number; description: string; cashBankAccountId?: string; counterpartAccountId?: string; fromCashBankAccountId?: string; toCashBankAccountId?: string; journalEntryId: string; createdAt: string };
export type Budget = { id: string; name: string; startDate: string; endDate: string; notes?: string; createdAt: string };
export type BudgetLine = { id: string; budgetId: string; accountId: string; plannedAmount: number; createdAt: string };
export type AuditAction = "account_created" | "journal_posted" | "journal_reversed" | "journal_imported" | "contact_created" | "contact_deleted" | "item_created" | "installment_created" | "voucher_created" | "cash_bank_account_created" | "cash_bank_transaction_posted" | "bank_reconciliation_created" | "bank_reconciliation_updated" | "bank_reconciliation_deleted" | "budget_created" | "budget_line_created" | "currency_created" | "currency_deleted" | "cost_center_created" | "cost_center_deleted" | "document_created" | "document_posted" | "inventory_item_created" | "inventory_movement_recorded" | "employee_created" | "payroll_created" | "payroll_posted" | "asset_created" | "depreciation_posted";
export type AuditLog = { id: string; action: AuditAction; description: string; entityId?: string; createdAt: string };
export type AccountingBackup = { format: "smart-accountant-backup"; version: 1; exportedAt: string; data: AccountingState };

export type ContactType = "customer" | "supplier" | "debtor" | "creditor";
export type Contact = { id: string; name: string; phone: string; type: ContactType; accountCode?: string; notes?: string; createdAt: string };
export type AccountingItem = { id: string; name: string; category: AccountCategory; accountCode?: string; defaultAmount?: number; notes?: string; createdAt: string };
export type InstallmentFrequency = "monthly";
export type InstallmentStatus = "active" | "paused" | "completed";
export type Installment = {
  id: string;
  contactId: string;
  title: string;
  totalAmount: number;
  installmentAmount: number;
  frequency: InstallmentFrequency;
  startDate: string;
  endDate: string;
  debitAccountCode: string;
  creditAccountCode: string;
  status: InstallmentStatus;
  lastProcessedDate?: string;
  cronTaskUid?: string;
  createdAt: string;
};

export type CommercialDocumentType = "sales_invoice" | "purchase_invoice";
export type CommercialDocumentStatus = "draft" | "posted" | "void";
export type CommercialDocumentLine = { id: string; description: string; inventoryItemId?: string; quantity: number; unitPrice: number; taxRate: number; lineTotal: number };
export type CommercialDocument = {
  id: string;
  number: string;
  type: CommercialDocumentType;
  status: CommercialDocumentStatus;
  contactId?: string;
  description: string;
  date: string;
  dueDate?: string;
  lines: CommercialDocumentLine[];
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  primaryAccountId: string;
  settlementAccountId: string;
  taxAccountId?: string;
  journalEntryId?: string;
  createdAt: string;
};
export type InventoryItem = { id: string; name: string; sku?: string; unit: string; standardCost?: number; reorderLevel?: number; createdAt: string };
export type InventoryMovementType = "receipt" | "issue";
export type InventoryMovement = { id: string; inventoryItemId: string; type: InventoryMovementType; quantity: number; unitCost?: number; date: string; reference?: string; commercialDocumentId?: string; createdAt: string };
export type Employee = { id: string; name: string; phone?: string; basicSalary?: number; notes?: string; createdAt: string };
export type PayrollStatus = "draft" | "posted";
export type PayrollRun = { id: string; employeeId: string; date: string; basicSalary: number; allowances: number; deductions: number; netAmount: number; status: PayrollStatus; expenseAccountId: string; paymentAccountId: string; deductionsAccountId?: string; journalEntryId?: string; createdAt: string };
export type FixedAssetStatus = "active" | "retired";
export type FixedAsset = { id: string; name: string; acquisitionDate: string; cost: number; salvageValue: number; usefulLifeMonths: number; status: FixedAssetStatus; assetAccountId: string; depreciationExpenseAccountId: string; accumulatedDepreciationAccountId: string; createdAt: string };
export type DepreciationRecord = { id: string; assetId: string; date: string; amount: number; journalEntryId: string; createdAt: string };

export type AccountingState = {
  accounts: Account[];
  journalEntries: JournalEntry[];
  contacts: Contact[];
  accountingItems: AccountingItem[];
  installments: Installment[];
  costCenters: CostCenter[];
  vouchers: Voucher[];
  commercialDocuments: CommercialDocument[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  employees: Employee[];
  payrollRuns: PayrollRun[];
  fixedAssets: FixedAsset[];
  depreciationRecords: DepreciationRecord[];
  cashBankAccounts: CashBankAccount[];
  cashBankTransactions: CashBankTransaction[];
  bankReconciliations: BankReconciliation[];
  budgets: Budget[];
  budgetLines: BudgetLine[];
  auditLog: AuditLog[];
  currency: string;
  currencies: CurrencyDefinition[];
  numberLocale: NumberLocale;
  termsAccepted: boolean;
  numbering: AccountNumbering;
  subranges: AccountSubrange[];
};
export type CategorySummary = Record<AccountCategory, number>;

const STORAGE_KEY = "smart-accountant:data:v9";
const PREVIOUS_V8_STORAGE_KEY = "smart-accountant:data:v8";
const PREVIOUS_V7_STORAGE_KEY = "smart-accountant:data:v7";
const PREVIOUS_V6_STORAGE_KEY = "smart-accountant:data:v6";
const PREVIOUS_V5_STORAGE_KEY = "smart-accountant:data:v5";
const PREVIOUS_STORAGE_KEY = "smart-accountant:data:v4";
const LEGACY_STORAGE_KEY = "smart-accountant:data:v3";
const OLDEST_STORAGE_KEY = "smart-accountant:data:v2";
const ANCIENT_STORAGE_KEY = "smart-accountant:data:v1";
const emptyState: AccountingState = { accounts: [], journalEntries: [], contacts: [], accountingItems: [], installments: [], costCenters: [], vouchers: [], commercialDocuments: [], inventoryItems: [], inventoryMovements: [], employees: [], payrollRuns: [], fixedAssets: [], depreciationRecords: [], cashBankAccounts: [], cashBankTransactions: [], bankReconciliations: [], budgets: [], budgetLines: [], auditLog: [], currency: "د.ل", currencies: [], numberLocale: "arabic", termsAccepted: false, numbering: defaultAccountNumbering(), subranges: [] };
const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const categoryIsValid = (value: unknown): value is AccountCategory => typeof value === "string" && value in categoryMeta;
const contactTypeIsValid = (value: unknown): value is ContactType => value === "customer" || value === "supplier" || value === "debtor" || value === "creditor";
const installmentStatusIsValid = (value: unknown): value is InstallmentStatus => value === "active" || value === "paused" || value === "completed";
const isDateOnly = (value: string) => normaliseDateOnly(value) === value;

export const accountNatureFor = (category: AccountCategory): AccountNature => (category === "asset" || category === "expense" ? "debit" : "credit");
export const accountNatureLabel = (nature: AccountNature) => (nature === "debit" ? "طبيعته مدينة" : "طبيعته دائنة");

type NewJournalLine = Omit<JournalLine, "id">;
type NewAccount = { name: string; code: string; category: AccountCategory; scope: string; subrangeId?: string };
export type NewContact = { name: string; phone: string; type: ContactType; accountCode?: string; notes?: string };
export type NewAccountingItem = { name: string; category: AccountCategory; accountCode?: string; defaultAmount?: number; notes?: string };
export type NewInstallment = { contactId: string; title?: string; totalAmount: number; installmentAmount: number; startDate: string; endDate: string; debitAccountCode: string; creditAccountCode: string };
export type NewCostCenter = { name: string; notes?: string };
export type NewVoucher = { type: VoucherType; paymentMethod: PaymentMethod; partyName: string; amount: number; date: string; description: string; cashAccountId: string; counterpartAccountId: string; currency?: string; fxRate?: number; costCenterId?: string };
export type NewCommercialDocument = { type: CommercialDocumentType; contactId?: string; number?: string; description: string; date: string; dueDate?: string; lines: Array<{ description: string; inventoryItemId?: string; quantity: number; unitPrice: number; taxRate?: number }>; primaryAccountId: string; settlementAccountId: string; taxAccountId?: string };
export type NewInventoryItem = { name: string; sku?: string; unit?: string; standardCost?: number; reorderLevel?: number };
export type NewInventoryMovement = { inventoryItemId: string; type: InventoryMovementType; quantity: number; unitCost?: number; date: string; reference?: string };
export type NewEmployee = { name: string; phone?: string; basicSalary?: number; notes?: string };
export type NewPayrollRun = { employeeId: string; date: string; basicSalary: number; allowances?: number; deductions?: number; expenseAccountId: string; paymentAccountId: string; deductionsAccountId?: string };
export type NewFixedAsset = { name: string; acquisitionDate: string; cost: number; salvageValue?: number; usefulLifeMonths: number; assetAccountId: string; depreciationExpenseAccountId: string; accumulatedDepreciationAccountId: string };
export type NewCashBankAccount = { name: string; type: CashBankAccountType; accountId: string; bankName?: string; accountNumber?: string; notes?: string };
export type NewCashBankTransaction = { type: Exclude<CashBankTransactionType, "transfer">; cashBankAccountId: string; counterpartAccountId: string; date: string; amount: number; description: string };
export type NewCashBankTransfer = { fromCashBankAccountId: string; toCashBankAccountId: string; date: string; amount: number; description: string };
export type NewBankReconciliation = { bankAccountId: string; periodStart: string; periodEnd: string; openingBalance: number; closingBalance: number };
export type BankReconciliationLinePatch = Partial<Pick<BankStatementLine, "date" | "description" | "amount" | "reference" | "matchedEntryId" | "status">>;
export type NewBudget = { name: string; startDate: string; endDate: string; notes?: string };
export type NewBudgetLine = { budgetId: string; accountId: string; plannedAmount: number };
export type NewCurrency = { code: string; name: string };
type ImportedJournal = { description: string; date: string; lines: Array<{ accountName: string; accountCode?: string; category: AccountCategory; debit: number; credit: number }> };

type AccountingContextValue = {
  state: AccountingState;
  isReady: boolean;
  summary: CategorySummary;
  accountBalances: Record<string, number>;
  netIncome: number;
  balanceSheet: BalanceSheet;
  addAccount: (input: NewAccount) => Promise<Account>;
  addJournalEntry: (input: { description: string; date: string; lines: NewJournalLine[]; source?: JournalEntrySource; currency?: string; fxRate?: number; documentReference?: string; costCenterId?: string }) => Promise<void>;
  importJournalEntries: (journals: ImportedJournal[]) => Promise<{ imported: number; skipped: number }>;
  addContact: (input: NewContact) => Promise<Contact>;
  deleteContact: (id: string) => Promise<void>;
  addAccountingItem: (input: NewAccountingItem) => Promise<AccountingItem>;
  deleteAccountingItem: (id: string) => Promise<void>;
  addInstallment: (input: NewInstallment) => Promise<Installment>;
  updateInstallmentStatus: (id: string, status: InstallmentStatus) => Promise<void>;
  updateInstallmentSchedule: (id: string, patch: { cronTaskUid?: string; lastProcessedDate?: string }) => Promise<void>;
  deleteInstallment: (id: string) => Promise<void>;
  addCostCenter: (input: NewCostCenter) => Promise<CostCenter>;
  deleteCostCenter: (id: string) => Promise<void>;
  createVoucher: (input: NewVoucher) => Promise<Voucher>;
  createCommercialDocument: (input: NewCommercialDocument) => Promise<CommercialDocument>;
  postCommercialDocument: (id: string) => Promise<void>;
  addInventoryItem: (input: NewInventoryItem) => Promise<InventoryItem>;
  recordInventoryMovement: (input: NewInventoryMovement) => Promise<InventoryMovement>;
  addEmployee: (input: NewEmployee) => Promise<Employee>;
  createPayrollRun: (input: NewPayrollRun) => Promise<PayrollRun>;
  postPayrollRun: (id: string) => Promise<void>;
  addFixedAsset: (input: NewFixedAsset) => Promise<FixedAsset>;
  recordMonthlyDepreciation: (assetId: string, date: string) => Promise<DepreciationRecord>;
  addCashBankAccount: (input: NewCashBankAccount) => Promise<CashBankAccount>;
  createCashBankTransaction: (input: NewCashBankTransaction) => Promise<CashBankTransaction>;
  transferCashBankFunds: (input: NewCashBankTransfer) => Promise<CashBankTransaction>;
  addBankReconciliation: (input: NewBankReconciliation) => Promise<BankReconciliation>;
  updateBankReconciliation: (id: string, input: NewBankReconciliation) => Promise<BankReconciliation>;
  addReconciliationLine: (reconciliationId: string, input: NewBankStatementLine) => Promise<BankStatementLine>;
  addReconciliationLines: (reconciliationId: string, inputs: NewBankStatementLine[]) => Promise<BankStatementLine[]>;
  updateReconciliationLine: (reconciliationId: string, lineId: string, patch: BankReconciliationLinePatch) => Promise<void>;
  deleteBankReconciliation: (id: string) => Promise<void>;
  addBudget: (input: NewBudget) => Promise<Budget>;
  addBudgetLine: (input: NewBudgetLine) => Promise<BudgetLine>;
  reverseJournalEntry: (id: string, date?: string) => Promise<void>;
  suggestAccountCode: (category: AccountCategory, subrangeId?: string) => string;
  updateAccountNumbering: (numbering: AccountNumbering) => Promise<void>;
  addSubrange: (input: NewAccountSubrange) => Promise<void>;
  deleteSubrange: (id: string) => Promise<void>;
  updateCurrency: (currency: string) => Promise<void>;
  addCurrency: (input: NewCurrency) => Promise<CurrencyDefinition>;
  deleteCurrency: (id: string) => Promise<void>;
  updateNumberLocale: (numberLocale: NumberLocale) => Promise<void>;
  acceptTerms: () => Promise<void>;
  exportBackup: () => Promise<string>;
  restoreBackup: (raw: string) => Promise<void>;
  clearAllData: () => Promise<void>;
};

const AccountingContext = createContext<AccountingContextValue | null>(null);

function normaliseAccount(value: unknown): Account | null {
  if (!value || typeof value !== "object") return null;
  const account = value as Partial<Account>;
  if (!account.id || !account.name || !categoryIsValid(account.category)) return null;
  const nature = account.nature === "debit" || account.nature === "credit" ? account.nature : accountNatureFor(account.category);
  return { id: account.id, code: typeof account.code === "string" ? account.code.trim() : "", name: account.name.trim(), category: account.category, nature, scope: typeof account.scope === "string" && account.scope.trim() ? account.scope.trim() : "عام", subrangeId: typeof account.subrangeId === "string" ? account.subrangeId : undefined, createdAt: typeof account.createdAt === "string" ? account.createdAt : new Date().toISOString() };
}

function normaliseContact(value: unknown): Contact | null {
  if (!value || typeof value !== "object") return null;
  const contact = value as Partial<Contact>;
  if (!contact.id || typeof contact.name !== "string" || !contact.name.trim() || typeof contact.phone !== "string" || !contact.phone.trim() || !contactTypeIsValid(contact.type)) return null;
  return { id: contact.id, name: contact.name.trim(), phone: contact.phone.trim(), type: contact.type, accountCode: typeof contact.accountCode === "string" && contact.accountCode.trim() ? contact.accountCode.trim() : undefined, notes: typeof contact.notes === "string" && contact.notes.trim() ? contact.notes.trim() : undefined, createdAt: typeof contact.createdAt === "string" ? contact.createdAt : new Date().toISOString() };
}

function normaliseAccountingItem(value: unknown): AccountingItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<AccountingItem>;
  const defaultAmount = Number(item.defaultAmount);
  if (!item.id || typeof item.name !== "string" || !item.name.trim() || !categoryIsValid(item.category)) return null;
  return { id: item.id, name: item.name.trim(), category: item.category, accountCode: typeof item.accountCode === "string" && item.accountCode.trim() ? item.accountCode.trim() : undefined, defaultAmount: Number.isFinite(defaultAmount) && defaultAmount > 0 ? Number(defaultAmount.toFixed(2)) : undefined, notes: typeof item.notes === "string" && item.notes.trim() ? item.notes.trim() : undefined, createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString() };
}

function normaliseInstallment(value: unknown): Installment | null {
  if (!value || typeof value !== "object") return null;
  const installment = value as Partial<Installment>;
  const totalAmount = Number(installment.totalAmount);
  const installmentAmount = Number(installment.installmentAmount);
  if (!installment.id || !installment.contactId || !Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(installmentAmount) || installmentAmount <= 0 || typeof installment.startDate !== "string" || !isDateOnly(installment.startDate) || typeof installment.endDate !== "string" || !isDateOnly(installment.endDate) || typeof installment.debitAccountCode !== "string" || !installment.debitAccountCode.trim() || typeof installment.creditAccountCode !== "string" || !installment.creditAccountCode.trim()) return null;
  return { id: installment.id, contactId: installment.contactId, title: typeof installment.title === "string" && installment.title.trim() ? installment.title.trim() : "قسط شهري", totalAmount: Number(totalAmount.toFixed(2)), installmentAmount: Number(installmentAmount.toFixed(2)), frequency: "monthly", startDate: installment.startDate, endDate: installment.endDate, debitAccountCode: installment.debitAccountCode.trim(), creditAccountCode: installment.creditAccountCode.trim(), status: installmentStatusIsValid(installment.status) ? installment.status : "active", lastProcessedDate: typeof installment.lastProcessedDate === "string" && isDateOnly(installment.lastProcessedDate) ? installment.lastProcessedDate : undefined, cronTaskUid: typeof installment.cronTaskUid === "string" && installment.cronTaskUid.trim() ? installment.cronTaskUid : undefined, createdAt: typeof installment.createdAt === "string" ? installment.createdAt : new Date().toISOString() };
}

function normaliseJournalEntrySource(value: unknown): JournalEntrySource | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Partial<JournalEntrySource>;
  if (source.type === "installment" && typeof source.installmentId === "string" && typeof source.periodKey === "string" && typeof source.externalEntryId === "string") return { type: "installment", installmentId: source.installmentId, periodKey: source.periodKey, externalEntryId: source.externalEntryId };
  if (source.type === "voucher" && typeof source.voucherId === "string" && (source.voucherType === "receipt" || source.voucherType === "payment")) return { type: "voucher", voucherId: source.voucherId, voucherType: source.voucherType };
  if (source.type === "commercial_document" && typeof source.documentId === "string" && (source.documentType === "sales_invoice" || source.documentType === "purchase_invoice")) return { type: "commercial_document", documentId: source.documentId, documentType: source.documentType };
  if (source.type === "payroll" && typeof source.payrollRunId === "string") return { type: "payroll", payrollRunId: source.payrollRunId };
  if (source.type === "depreciation" && typeof source.depreciationId === "string" && typeof source.assetId === "string") return { type: "depreciation", depreciationId: source.depreciationId, assetId: source.assetId };
  if (source.type === "reversal" && typeof source.originalEntryId === "string") return { type: "reversal", originalEntryId: source.originalEntryId };
  return undefined;
}

function normaliseJournalEntry(value: unknown): JournalEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<JournalEntry>;
  const journalDate = normaliseDateOnly(entry.date);
  if (!entry.id || typeof entry.description !== "string" || !entry.description.trim() || !journalDate || !Array.isArray(entry.lines) || !validateJournalLines(entry.lines).isBalanced) return null;
  const fxRate = Number(entry.fxRate);
  return { id: entry.id, description: entry.description.trim(), date: journalDate, createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(), lines: entry.lines as JournalLine[], source: normaliseJournalEntrySource(entry.source), currency: typeof entry.currency === "string" && entry.currency.trim() ? entry.currency.trim() : undefined, fxRate: Number.isFinite(fxRate) && fxRate > 0 ? fxRate : undefined, documentReference: typeof entry.documentReference === "string" && entry.documentReference.trim() ? entry.documentReference.trim() : undefined, costCenterId: typeof entry.costCenterId === "string" && entry.costCenterId.trim() ? entry.costCenterId : undefined, reversalOfEntryId: typeof entry.reversalOfEntryId === "string" && entry.reversalOfEntryId.trim() ? entry.reversalOfEntryId : undefined };
}

function normaliseCurrencyDefinition(value: unknown): CurrencyDefinition | null {
  if (!value || typeof value !== "object") return null;
  const currency = value as Partial<CurrencyDefinition>;
  const code = typeof currency.code === "string" ? currency.code.trim().toUpperCase() : "";
  const name = typeof currency.name === "string" ? currency.name.trim() : "";
  if (!currency.id || !/^[A-Z0-9._ -]{1,12}$/.test(code) || !name) return null;
  return { id: currency.id, code, name, createdAt: typeof currency.createdAt === "string" ? currency.createdAt : new Date().toISOString() };
}

function normaliseCostCenter(value: unknown): CostCenter | null {
  if (!value || typeof value !== "object") return null;
  const center = value as Partial<CostCenter>;
  if (!center.id || typeof center.name !== "string" || !center.name.trim()) return null;
  return { id: center.id, name: center.name.trim(), notes: typeof center.notes === "string" && center.notes.trim() ? center.notes.trim() : undefined, createdAt: typeof center.createdAt === "string" ? center.createdAt : new Date().toISOString() };
}

function normaliseVoucher(value: unknown): Voucher | null {
  if (!value || typeof value !== "object") return null;
  const voucher = value as Partial<Voucher>;
  const amount = Number(voucher.amount);
  const voucherDate = normaliseDateOnly(voucher.date);
  if (!voucher.id || typeof voucher.voucherNumber !== "string" || (voucher.type !== "receipt" && voucher.type !== "payment") || !voucher.partyName?.trim() || !Number.isFinite(amount) || amount <= 0 || !voucherDate || !voucher.description?.trim() || !voucher.cashAccountId || !voucher.counterpartAccountId || !voucher.journalEntryId) return null;
  return { id: voucher.id, voucherNumber: voucher.voucherNumber, type: voucher.type, paymentMethod: voucher.paymentMethod === "cash" || voucher.paymentMethod === "cheque" || voucher.paymentMethod === "bank_transfer" || voucher.paymentMethod === "other" ? voucher.paymentMethod : "cash", partyName: voucher.partyName.trim(), amount: Number(amount.toFixed(2)), date: voucherDate, description: voucher.description.trim(), cashAccountId: voucher.cashAccountId, counterpartAccountId: voucher.counterpartAccountId, journalEntryId: voucher.journalEntryId, createdAt: typeof voucher.createdAt === "string" ? voucher.createdAt : new Date().toISOString() };
}

function normaliseCashBankAccount(value: unknown, accountIds: Set<string>): CashBankAccount | null {
  if (!value || typeof value !== "object") return null;
  const account = value as Partial<CashBankAccount>;
  if (!account.id || typeof account.name !== "string" || !account.name.trim() || (account.type !== "cash" && account.type !== "bank") || !account.accountId || !accountIds.has(account.accountId)) return null;
  return { id: account.id, name: account.name.trim(), type: account.type, accountId: account.accountId, bankName: typeof account.bankName === "string" && account.bankName.trim() ? account.bankName.trim() : undefined, accountNumber: typeof account.accountNumber === "string" && account.accountNumber.trim() ? account.accountNumber.trim() : undefined, notes: typeof account.notes === "string" && account.notes.trim() ? account.notes.trim() : undefined, createdAt: typeof account.createdAt === "string" ? account.createdAt : new Date().toISOString() };
}

function normaliseBudget(value: unknown): Budget | null {
  if (!value || typeof value !== "object") return null;
  const budget = value as Partial<Budget>; const startDate = normaliseDateOnly(budget.startDate); const endDate = normaliseDateOnly(budget.endDate);
  if (!budget.id || typeof budget.name !== "string" || !budget.name.trim() || !startDate || !endDate || endDate < startDate) return null;
  return { id: budget.id, name: budget.name.trim(), startDate, endDate, notes: typeof budget.notes === "string" && budget.notes.trim() ? budget.notes.trim() : undefined, createdAt: typeof budget.createdAt === "string" ? budget.createdAt : new Date().toISOString() };
}

function normaliseBudgetLine(value: unknown, budgetIds: Set<string>, accountIds: Set<string>): BudgetLine | null {
  if (!value || typeof value !== "object") return null;
  const line = value as Partial<BudgetLine>; const plannedAmount = Number(line.plannedAmount);
  if (!line.id || !line.budgetId || !budgetIds.has(line.budgetId) || !line.accountId || !accountIds.has(line.accountId) || !Number.isFinite(plannedAmount) || plannedAmount <= 0) return null;
  return { id: line.id, budgetId: line.budgetId, accountId: line.accountId, plannedAmount: Number(plannedAmount.toFixed(2)), createdAt: typeof line.createdAt === "string" ? line.createdAt : new Date().toISOString() };
}

function normaliseCashBankTransaction(value: unknown, cashBankIds: Set<string>, accountIds: Set<string>, journalIds: Set<string>): CashBankTransaction | null {
  if (!value || typeof value !== "object") return null;
  const transaction = value as Partial<CashBankTransaction>; const amount = Number(transaction.amount); const date = normaliseDateOnly(transaction.date);
  const isReceiptOrPayment = transaction.type === "receipt" || transaction.type === "payment";
  const isTransfer = transaction.type === "transfer";
  if (!transaction.id || !date || !Number.isFinite(amount) || amount <= 0 || typeof transaction.description !== "string" || !transaction.description.trim() || !transaction.journalEntryId || !journalIds.has(transaction.journalEntryId)) return null;
  if (isReceiptOrPayment && (!transaction.cashBankAccountId || !cashBankIds.has(transaction.cashBankAccountId) || !transaction.counterpartAccountId || !accountIds.has(transaction.counterpartAccountId))) return null;
  if (isTransfer && (!transaction.fromCashBankAccountId || !cashBankIds.has(transaction.fromCashBankAccountId) || !transaction.toCashBankAccountId || !cashBankIds.has(transaction.toCashBankAccountId) || transaction.fromCashBankAccountId === transaction.toCashBankAccountId)) return null;
  if (!isReceiptOrPayment && !isTransfer) return null;
  return { id: transaction.id, type: transaction.type as CashBankTransactionType, date, amount: Number(amount.toFixed(2)), description: transaction.description.trim(), cashBankAccountId: isReceiptOrPayment ? transaction.cashBankAccountId : undefined, counterpartAccountId: isReceiptOrPayment ? transaction.counterpartAccountId : undefined, fromCashBankAccountId: isTransfer ? transaction.fromCashBankAccountId : undefined, toCashBankAccountId: isTransfer ? transaction.toCashBankAccountId : undefined, journalEntryId: transaction.journalEntryId, createdAt: typeof transaction.createdAt === "string" ? transaction.createdAt : new Date().toISOString() };
}

function normaliseAuditLog(value: unknown): AuditLog | null {
  if (!value || typeof value !== "object") return null;
  const audit = value as Partial<AuditLog>;
  const actions: AuditAction[] = ["account_created", "journal_posted", "journal_reversed", "journal_imported", "contact_created", "contact_deleted", "item_created", "installment_created", "voucher_created", "cash_bank_account_created", "cash_bank_transaction_posted", "bank_reconciliation_created", "bank_reconciliation_updated", "bank_reconciliation_deleted", "budget_created", "budget_line_created", "currency_created", "currency_deleted", "cost_center_created", "cost_center_deleted", "document_created", "document_posted", "inventory_item_created", "inventory_movement_recorded", "employee_created", "payroll_created", "payroll_posted", "asset_created", "depreciation_posted"];
  if (!audit.id || !actions.includes(audit.action as AuditAction) || typeof audit.description !== "string" || !audit.description.trim()) return null;
  return { id: audit.id, action: audit.action as AuditAction, description: audit.description.trim(), entityId: typeof audit.entityId === "string" ? audit.entityId : undefined, createdAt: typeof audit.createdAt === "string" ? audit.createdAt : new Date().toISOString() };
}

const newAuditLog = (action: AuditAction, description: string, entityId?: string): AuditLog => ({ id: createId("audit"), action, description, entityId, createdAt: new Date().toISOString() });

function normaliseCommercialDocument(value: unknown): CommercialDocument | null {
  if (!value || typeof value !== "object") return null;
  const document = value as Partial<CommercialDocument>;
  const date = normaliseDateOnly(document.date);
  const type = document.type === "sales_invoice" || document.type === "purchase_invoice" ? document.type : undefined;
  if (!document.id || !type || !date || typeof document.number !== "string" || !document.number.trim() || typeof document.description !== "string" || !document.description.trim() || !Array.isArray(document.lines) || !document.lines.length || !document.primaryAccountId || !document.settlementAccountId) return null;
  const candidateLines = document.lines.map((line) => {
    const candidate = line as Partial<CommercialDocumentLine>;
    const quantity = Number(candidate.quantity); const unitPrice = Number(candidate.unitPrice); const taxRate = Number(candidate.taxRate);
    if (!candidate.id || typeof candidate.description !== "string" || !candidate.description.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(taxRate) || taxRate < 0) return null;
    return { id: candidate.id, description: candidate.description.trim(), inventoryItemId: typeof candidate.inventoryItemId === "string" ? candidate.inventoryItemId : undefined, quantity: Number(quantity.toFixed(3)), unitPrice: Number(unitPrice.toFixed(2)), taxRate: Number(taxRate.toFixed(2)), lineTotal: Number((quantity * unitPrice).toFixed(2)) };
  });
  if (candidateLines.some((line) => line === null)) return null;
  const lines = candidateLines as CommercialDocumentLine[];
  const netAmount = Number(lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
  const taxAmount = Number(lines.reduce((sum, line) => sum + (line.lineTotal * line.taxRate / 100), 0).toFixed(2));
  return { id: document.id, number: document.number.trim(), type, status: document.status === "posted" || document.status === "void" ? document.status : "draft", contactId: typeof document.contactId === "string" ? document.contactId : undefined, description: document.description.trim(), date, dueDate: typeof document.dueDate === "string" ? normaliseDateOnly(document.dueDate) ?? undefined : undefined, lines, netAmount, taxAmount, totalAmount: Number((netAmount + taxAmount).toFixed(2)), primaryAccountId: document.primaryAccountId, settlementAccountId: document.settlementAccountId, taxAccountId: typeof document.taxAccountId === "string" ? document.taxAccountId : undefined, journalEntryId: typeof document.journalEntryId === "string" ? document.journalEntryId : undefined, createdAt: typeof document.createdAt === "string" ? document.createdAt : new Date().toISOString() };
}

function normaliseInventoryItem(value: unknown): InventoryItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<InventoryItem>; const standardCost = Number(item.standardCost); const reorderLevel = Number(item.reorderLevel);
  if (!item.id || typeof item.name !== "string" || !item.name.trim()) return null;
  return { id: item.id, name: item.name.trim(), sku: typeof item.sku === "string" && item.sku.trim() ? item.sku.trim() : undefined, unit: typeof item.unit === "string" && item.unit.trim() ? item.unit.trim() : "وحدة", standardCost: Number.isFinite(standardCost) && standardCost >= 0 ? Number(standardCost.toFixed(2)) : undefined, reorderLevel: Number.isFinite(reorderLevel) && reorderLevel >= 0 ? Number(reorderLevel.toFixed(3)) : undefined, createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString() };
}

function normaliseInventoryMovement(value: unknown, inventoryIds: Set<string>): InventoryMovement | null {
  if (!value || typeof value !== "object") return null;
  const movement = value as Partial<InventoryMovement>; const quantity = Number(movement.quantity); const unitCost = Number(movement.unitCost); const date = normaliseDateOnly(movement.date);
  if (!movement.id || !movement.inventoryItemId || !inventoryIds.has(movement.inventoryItemId) || (movement.type !== "receipt" && movement.type !== "issue") || !Number.isFinite(quantity) || quantity <= 0 || !date) return null;
  return { id: movement.id, inventoryItemId: movement.inventoryItemId, type: movement.type, quantity: Number(quantity.toFixed(3)), unitCost: Number.isFinite(unitCost) && unitCost >= 0 ? Number(unitCost.toFixed(2)) : undefined, date, reference: typeof movement.reference === "string" && movement.reference.trim() ? movement.reference.trim() : undefined, commercialDocumentId: typeof movement.commercialDocumentId === "string" ? movement.commercialDocumentId : undefined, createdAt: typeof movement.createdAt === "string" ? movement.createdAt : new Date().toISOString() };
}

function normaliseEmployee(value: unknown): Employee | null {
  if (!value || typeof value !== "object") return null;
  const employee = value as Partial<Employee>; const basicSalary = Number(employee.basicSalary);
  if (!employee.id || typeof employee.name !== "string" || !employee.name.trim()) return null;
  return { id: employee.id, name: employee.name.trim(), phone: typeof employee.phone === "string" && employee.phone.trim() ? employee.phone.trim() : undefined, basicSalary: Number.isFinite(basicSalary) && basicSalary >= 0 ? Number(basicSalary.toFixed(2)) : undefined, notes: typeof employee.notes === "string" && employee.notes.trim() ? employee.notes.trim() : undefined, createdAt: typeof employee.createdAt === "string" ? employee.createdAt : new Date().toISOString() };
}

function normalisePayrollRun(value: unknown, employeeIds: Set<string>): PayrollRun | null {
  if (!value || typeof value !== "object") return null;
  const run = value as Partial<PayrollRun>; const date = normaliseDateOnly(run.date); const basicSalary = Number(run.basicSalary); const allowances = Number(run.allowances); const deductions = Number(run.deductions);
  if (!run.id || !run.employeeId || !employeeIds.has(run.employeeId) || !date || !run.expenseAccountId || !run.paymentAccountId || !Number.isFinite(basicSalary) || basicSalary < 0 || !Number.isFinite(allowances) || allowances < 0 || !Number.isFinite(deductions) || deductions < 0) return null;
  return { id: run.id, employeeId: run.employeeId, date, basicSalary: Number(basicSalary.toFixed(2)), allowances: Number(allowances.toFixed(2)), deductions: Number(deductions.toFixed(2)), netAmount: Number((basicSalary + allowances - deductions).toFixed(2)), status: run.status === "posted" ? "posted" : "draft", expenseAccountId: run.expenseAccountId, paymentAccountId: run.paymentAccountId, deductionsAccountId: typeof run.deductionsAccountId === "string" ? run.deductionsAccountId : undefined, journalEntryId: typeof run.journalEntryId === "string" ? run.journalEntryId : undefined, createdAt: typeof run.createdAt === "string" ? run.createdAt : new Date().toISOString() };
}

function normaliseFixedAsset(value: unknown): FixedAsset | null {
  if (!value || typeof value !== "object") return null;
  const asset = value as Partial<FixedAsset>; const date = normaliseDateOnly(asset.acquisitionDate); const cost = Number(asset.cost); const salvageValue = Number(asset.salvageValue); const usefulLifeMonths = Number(asset.usefulLifeMonths);
  if (!asset.id || typeof asset.name !== "string" || !asset.name.trim() || !date || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(salvageValue) || salvageValue < 0 || salvageValue > cost || !Number.isInteger(usefulLifeMonths) || usefulLifeMonths < 1 || !asset.assetAccountId || !asset.depreciationExpenseAccountId || !asset.accumulatedDepreciationAccountId) return null;
  return { id: asset.id, name: asset.name.trim(), acquisitionDate: date, cost: Number(cost.toFixed(2)), salvageValue: Number(salvageValue.toFixed(2)), usefulLifeMonths, status: asset.status === "retired" ? "retired" : "active", assetAccountId: asset.assetAccountId, depreciationExpenseAccountId: asset.depreciationExpenseAccountId, accumulatedDepreciationAccountId: asset.accumulatedDepreciationAccountId, createdAt: typeof asset.createdAt === "string" ? asset.createdAt : new Date().toISOString() };
}

function normaliseDepreciationRecord(value: unknown, assetIds: Set<string>, journalIds: Set<string>): DepreciationRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<DepreciationRecord>; const date = normaliseDateOnly(record.date); const amount = Number(record.amount);
  if (!record.id || !record.assetId || !assetIds.has(record.assetId) || !record.journalEntryId || !journalIds.has(record.journalEntryId) || !date || !Number.isFinite(amount) || amount <= 0) return null;
  return { id: record.id, assetId: record.assetId, date, amount: Number(amount.toFixed(2)), journalEntryId: record.journalEntryId, createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString() };
}

function normaliseLoadedData(raw: string | null): AccountingState {
  if (!raw) return emptyState;
  try {
    const parsed = JSON.parse(raw) as Partial<AccountingState>;
    const accounts = Array.isArray(parsed.accounts) ? parsed.accounts.map(normaliseAccount).filter((account): account is Account => Boolean(account)) : [];
    const accountIds = new Set(accounts.map((account) => account.id));
    const journalEntries = Array.isArray(parsed.journalEntries) ? parsed.journalEntries.map(normaliseJournalEntry).filter((entry): entry is JournalEntry => Boolean(entry)) : [];
    const contacts = Array.isArray(parsed.contacts) ? parsed.contacts.map(normaliseContact).filter((contact): contact is Contact => Boolean(contact)) : [];
    const accountingItems = Array.isArray(parsed.accountingItems) ? parsed.accountingItems.map(normaliseAccountingItem).filter((item): item is AccountingItem => Boolean(item)) : [];
    const validContactIds = new Set(contacts.map((contact) => contact.id));
    const installments = Array.isArray(parsed.installments) ? parsed.installments.map(normaliseInstallment).filter((installment): installment is Installment => Boolean(installment && validContactIds.has(installment.contactId))) : [];
    const costCenters = Array.isArray(parsed.costCenters) ? parsed.costCenters.map(normaliseCostCenter).filter((center): center is CostCenter => Boolean(center)) : [];
    const vouchers = Array.isArray(parsed.vouchers) ? parsed.vouchers.map(normaliseVoucher).filter((voucher): voucher is Voucher => Boolean(voucher && journalEntries.some((entry) => entry.id === voucher.journalEntryId))) : [];
    const commercialDocuments = Array.isArray(parsed.commercialDocuments) ? parsed.commercialDocuments.map(normaliseCommercialDocument).filter((document): document is CommercialDocument => Boolean(document)) : [];
    const inventoryItems = Array.isArray(parsed.inventoryItems) ? parsed.inventoryItems.map(normaliseInventoryItem).filter((item): item is InventoryItem => Boolean(item)) : [];
    const inventoryIds = new Set(inventoryItems.map((item) => item.id));
    const inventoryMovements = Array.isArray(parsed.inventoryMovements) ? parsed.inventoryMovements.map((movement) => normaliseInventoryMovement(movement, inventoryIds)).filter((movement): movement is InventoryMovement => Boolean(movement)) : [];
    const employees = Array.isArray(parsed.employees) ? parsed.employees.map(normaliseEmployee).filter((employee): employee is Employee => Boolean(employee)) : [];
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const payrollRuns = Array.isArray(parsed.payrollRuns) ? parsed.payrollRuns.map((run) => normalisePayrollRun(run, employeeIds)).filter((run): run is PayrollRun => Boolean(run)) : [];
    const fixedAssets = Array.isArray(parsed.fixedAssets) ? parsed.fixedAssets.map(normaliseFixedAsset).filter((asset): asset is FixedAsset => Boolean(asset)) : [];
    const assetIds = new Set(fixedAssets.map((asset) => asset.id)); const journalIds = new Set(journalEntries.map((entry) => entry.id));
    const depreciationRecords = Array.isArray(parsed.depreciationRecords) ? parsed.depreciationRecords.map((record) => normaliseDepreciationRecord(record, assetIds, journalIds)).filter((record): record is DepreciationRecord => Boolean(record)) : [];
    const cashBankAccounts = Array.isArray(parsed.cashBankAccounts) ? parsed.cashBankAccounts.map((account) => normaliseCashBankAccount(account, accountIds)).filter((account): account is CashBankAccount => Boolean(account && accounts.some((linked) => linked.id === account.accountId && linked.category === "asset"))) : [];
    const cashBankIds = new Set(cashBankAccounts.map((account) => account.id));
    const cashBankTransactions = Array.isArray(parsed.cashBankTransactions) ? parsed.cashBankTransactions.map((transaction) => normaliseCashBankTransaction(transaction, cashBankIds, accountIds, journalIds)).filter((transaction): transaction is CashBankTransaction => Boolean(transaction)) : [];
    const bankAccountIds = new Set(cashBankAccounts.filter((account) => account.type === "bank").map((account) => account.id));
    const bankReconciliations = Array.isArray(parsed.bankReconciliations) ? parsed.bankReconciliations.map((reconciliation) => normaliseBankReconciliation(reconciliation, bankAccountIds, journalIds)).filter((reconciliation): reconciliation is BankReconciliation => Boolean(reconciliation)) : [];
    const budgets = Array.isArray(parsed.budgets) ? parsed.budgets.map(normaliseBudget).filter((budget): budget is Budget => Boolean(budget)) : [];
    const budgetIds = new Set(budgets.map((budget) => budget.id));
    const budgetLines = Array.isArray(parsed.budgetLines) ? parsed.budgetLines.map((line) => normaliseBudgetLine(line, budgetIds, accountIds)).filter((line): line is BudgetLine => Boolean(line)) : [];
    const auditLog = Array.isArray(parsed.auditLog) ? parsed.auditLog.map(normaliseAuditLog).filter((audit): audit is AuditLog => Boolean(audit)) : [];
    const currencies = Array.isArray(parsed.currencies) ? parsed.currencies.map(normaliseCurrencyDefinition).filter((currency): currency is CurrencyDefinition => Boolean(currency)).filter((currency, index, all) => all.findIndex((candidate) => candidate.code === currency.code) === index) : [];
    const subranges = normaliseSubranges(parsed.subranges);
    return { accounts, journalEntries, contacts, accountingItems, installments, costCenters, vouchers, commercialDocuments, inventoryItems, inventoryMovements, employees, payrollRuns, fixedAssets, depreciationRecords, cashBankAccounts, cashBankTransactions, bankReconciliations, budgets, budgetLines, auditLog, currency: typeof parsed.currency === "string" && parsed.currency.trim() ? parsed.currency : "د.ل", currencies, numberLocale: parsed.numberLocale === "english" ? "english" : "arabic", termsAccepted: parsed.termsAccepted === true, numbering: normaliseAccountNumbering(parsed.numbering), subranges };
  } catch { return emptyState; }
}

function calculateInstallmentEndDate(startDate: string, totalAmount: number, installmentAmount: number) {
  const numberOfPeriods = Math.ceil(totalAmount / installmentAmount);
  const [year, month, day] = startDate.split("-").map(Number);
  const targetMonth = month - 1 + numberOfPeriods - 1;
  const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function AccountingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountingState>(emptyState);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(PREVIOUS_V8_STORAGE_KEY), AsyncStorage.getItem(PREVIOUS_V7_STORAGE_KEY), AsyncStorage.getItem(PREVIOUS_V6_STORAGE_KEY), AsyncStorage.getItem(PREVIOUS_V5_STORAGE_KEY), AsyncStorage.getItem(PREVIOUS_STORAGE_KEY), AsyncStorage.getItem(LEGACY_STORAGE_KEY), AsyncStorage.getItem(OLDEST_STORAGE_KEY), AsyncStorage.getItem(ANCIENT_STORAGE_KEY)]).then(([current, previousV8, previousV7, previousV6, previousV5, previous, legacy, oldest, ancient]) => {
      if (!mounted) return;
      const loaded = normaliseLoadedData(current ?? previousV8 ?? previousV7 ?? previousV6 ?? previousV5 ?? previous ?? legacy ?? oldest ?? ancient);
      setState(loaded);
      if (!current && (previousV8 || previousV7 || previousV6 || previousV5 || previous || legacy || oldest || ancient)) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
    }).finally(() => { if (mounted) setIsReady(true); });
    return () => { mounted = false; };
  }, []);

  const commit = useCallback(async (next: AccountingState) => { setState(next); await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }, []);

  const addAccount = useCallback(async (input: NewAccount) => {
    const name = input.name.trim(); const code = input.code.trim(); const scope = input.scope.trim() || "عام";
    if (!name) throw new Error("أدخل اسم الحساب أولاً");
    if (!code) throw new Error("أدخل كود الحساب أولاً");
    if (!/^[A-Za-z0-9._-]+$/.test(code)) throw new Error("استخدم أرقاماً أو أحرفاً أو شرطات فقط في كود الحساب");
    const duplicateCode = state.accounts.find((account) => account.code.toLocaleLowerCase() === code.toLocaleLowerCase());
    if (duplicateCode) throw new Error("كود الحساب مستخدم بالفعل. اختر كوداً مختلفاً.");
    const selectedRange = input.subrangeId ? state.subranges.find((range) => range.id === input.subrangeId && range.category === input.category) : undefined;
    if (input.subrangeId && !selectedRange) throw new Error("النطاق الفرعي المختار غير متاح.");
    if (selectedRange && !isCodeInSubrange(code, selectedRange)) throw new Error(`يجب أن يكون كود الحساب ضمن نطاق «${selectedRange.name}» (${selectedRange.start}–${selectedRange.end}).`);
    const reservedRange = subrangeForCode(code, input.category, state.subranges);
    if (reservedRange && reservedRange.id !== input.subrangeId) throw new Error(`هذا الكود محجوز للنطاق الفرعي «${reservedRange.name}». اختر النطاق الصحيح أو كوداً آخر.`);
    const existing = state.accounts.find((account) => account.category === input.category && account.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) return existing;
    const account: Account = { id: createId("account"), code, name, category: input.category, nature: accountNatureFor(input.category), scope, subrangeId: selectedRange?.id, createdAt: new Date().toISOString() };
    await commit({ ...state, accounts: [...state.accounts, account], auditLog: [newAuditLog("account_created", `إضافة حساب: ${account.name} (${account.code})`, account.id), ...state.auditLog] });
    return account;
  }, [commit, state]);

  const addJournalEntry = useCallback(async (input: { description: string; date: string; lines: NewJournalLine[]; source?: JournalEntrySource; currency?: string; fxRate?: number; documentReference?: string; costCenterId?: string }) => {
    const knownAccounts = new Map(state.accounts.map((account) => [account.id, account]));
    const lines = input.lines.map((line) => ({ ...line, id: createId("line"), debit: Number(Number(line.debit).toFixed(2)), credit: Number(Number(line.credit).toFixed(2)) }));
    const journalDate = normaliseDateOnly(input.date);
    if (!input.description.trim()) throw new Error("أدخل وصف القيد");
    const installmentSource = input.source?.type === "installment" ? input.source : undefined;
    if (installmentSource && state.journalEntries.some((entry) => {
      const entrySource = entry.source;
      return entrySource?.type === "installment" && entrySource.installmentId === installmentSource.installmentId && entrySource.periodKey === installmentSource.periodKey;
    })) return;
    if (lines.some((line) => !knownAccounts.has(line.accountId) || knownAccounts.get(line.accountId)?.category !== line.category)) throw new Error("اختر حسابات صحيحة لكل طرف من القيد");
    if (new Set(lines.map((line) => line.accountId)).size < 2) throw new Error("اختر حسابين مختلفين للطرف المدين والدائن");
    if (!journalDate) throw new Error("أدخل تاريخ قيد صحيحاً.");
    if (input.costCenterId && !state.costCenters.some((center) => center.id === input.costCenterId)) throw new Error("مركز التكلفة المختار غير موجود.");
    const fxRate = input.fxRate === undefined ? 1 : Number(input.fxRate);
    if (!Number.isFinite(fxRate) || fxRate <= 0) throw new Error("أدخل سعر صرف صحيحاً أكبر من صفر.");
    const check = validateJournalLines(lines);
    if (!check.isBalanced) throw new Error(`القيد غير متوازن. الفرق الحالي: ${formatAmount(Math.abs(check.difference), state.currency)}`);
    const entry: JournalEntry = { id: createId("journal"), description: input.description.trim(), date: journalDate, createdAt: new Date().toISOString(), lines, source: input.source, currency: input.currency?.trim() || state.currency, fxRate, documentReference: input.documentReference?.trim() || undefined, costCenterId: input.costCenterId };
    await commit({ ...state, journalEntries: [entry, ...state.journalEntries], auditLog: [newAuditLog("journal_posted", `ترحيل قيد محاسبي: ${entry.description}`, entry.id), ...state.auditLog] });
  }, [commit, state]);

  const importJournalEntries = useCallback(async (journals: ImportedJournal[]) => {
    const next: AccountingState = { ...state, accounts: [...state.accounts], journalEntries: [...state.journalEntries] };
    const byCode = new Map(next.accounts.filter((account) => account.code).map((account) => [account.code.toLocaleLowerCase(), account]));
    const byName = new Map(next.accounts.map((account) => [`${account.category}:${account.name.toLocaleLowerCase()}`, account]));
    let imported = 0; let skipped = 0;
    for (const journal of journals) {
      const mappedLines: JournalLine[] = []; let invalid = !journal.description.trim() || journal.lines.length < 2;
      for (const source of journal.lines) {
        const name = source.accountName.trim(); const code = source.accountCode?.trim().toLocaleLowerCase();
        const account = (code ? byCode.get(code) : undefined) ?? byName.get(`${source.category}:${name.toLocaleLowerCase()}`);
        if (!account || !categoryIsValid(source.category) || account.category !== source.category) { invalid = true; continue; }
        mappedLines.push({ id: createId("line"), accountId: account.id, category: account.category, debit: Number(Number(source.debit).toFixed(2)), credit: Number(Number(source.credit).toFixed(2)) });
      }
      if (invalid || !validateJournalLines(mappedLines).isBalanced || new Set(mappedLines.map((line) => line.accountId)).size < 2) { skipped += 1; continue; }
      const journalDate = normaliseDateOnly(journal.date) ?? normaliseDateOnly(new Date().toISOString());
      if (!journalDate) { skipped += 1; continue; }
      next.journalEntries.unshift({ id: createId("journal"), description: journal.description.trim(), date: journalDate, createdAt: new Date().toISOString(), lines: mappedLines }); imported += 1;
    }
    if (imported) await commit({ ...next, auditLog: [newAuditLog("journal_imported", `استيراد ${imported} قيد محاسبي من ملف Excel.`), ...state.auditLog] });
    return { imported, skipped };
  }, [commit, state]);

  const addContact = useCallback(async (input: NewContact) => {
    const name = input.name.trim(); const phone = input.phone.trim(); const accountCode = input.accountCode?.trim();
    if (!name) throw new Error("أدخل اسم العميل أو المورد.");
    if (!phone || !/^[0-9+()\-\s]{5,30}$/.test(phone)) throw new Error("أدخل رقم هاتف صالحاً.");
    if (accountCode && !state.accounts.some((account) => account.code.toLocaleLowerCase() === accountCode.toLocaleLowerCase())) throw new Error("اختر حساباً موجوداً لربط جهة التعامل.");
    const contact: Contact = { id: createId("contact"), name, phone, type: input.type, accountCode: accountCode || undefined, notes: input.notes?.trim() || undefined, createdAt: new Date().toISOString() };
    await commit({ ...state, contacts: [contact, ...state.contacts], auditLog: [newAuditLog("contact_created", `إضافة جهة تعامل: ${contact.name}`, contact.id), ...state.auditLog] });
    return contact;
  }, [commit, state]);

  const deleteContact = useCallback(async (id: string) => {
    if (state.installments.some((installment) => installment.contactId === id)) throw new Error("لا يمكن حذف جهة مرتبطة بأقساط. أوقف أو احذف الأقساط المرتبطة أولاً.");
    const contact = state.contacts.find((candidate) => candidate.id === id);
    await commit({ ...state, contacts: state.contacts.filter((contact) => contact.id !== id), auditLog: [newAuditLog("contact_deleted", `حذف جهة تعامل: ${contact?.name ?? "غير معروفة"}`, id), ...state.auditLog] });
  }, [commit, state]);

  const addAccountingItem = useCallback(async (input: NewAccountingItem) => {
    const name = input.name.trim(); const accountCode = input.accountCode?.trim(); const defaultAmount = input.defaultAmount === undefined || input.defaultAmount === null || input.defaultAmount === 0 ? undefined : Number(input.defaultAmount);
    if (!name) throw new Error("أدخل اسم البند المحاسبي.");
    if (accountCode && !state.accounts.some((account) => account.code.toLocaleLowerCase() === accountCode.toLocaleLowerCase() && account.category === input.category)) throw new Error("اختر حساباً مطابقاً لفئة البند.");
    if (defaultAmount !== undefined && (!Number.isFinite(defaultAmount) || defaultAmount <= 0)) throw new Error("أدخل قيمة افتراضية أكبر من صفر أو اتركها فارغة.");
    const item: AccountingItem = { id: createId("item"), name, category: input.category, accountCode: accountCode || undefined, defaultAmount: defaultAmount === undefined ? undefined : Number(defaultAmount.toFixed(2)), notes: input.notes?.trim() || undefined, createdAt: new Date().toISOString() };
    await commit({ ...state, accountingItems: [item, ...state.accountingItems], auditLog: [newAuditLog("item_created", `إضافة بند محاسبي: ${item.name}`, item.id), ...state.auditLog] });
    return item;
  }, [commit, state]);

  const deleteAccountingItem = useCallback(async (id: string) => {
    await commit({ ...state, accountingItems: state.accountingItems.filter((item) => item.id !== id) });
  }, [commit, state]);

  const addInstallment = useCallback(async (input: NewInstallment) => {
    const contact = state.contacts.find((candidate) => candidate.id === input.contactId);
    const totalAmount = Number(input.totalAmount); const installmentAmount = Number(input.installmentAmount);
    const debitAccountCode = input.debitAccountCode.trim(); const creditAccountCode = input.creditAccountCode.trim();
    if (!contact) throw new Error("اختر جهة تعامل موجودة.");
    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(installmentAmount) || installmentAmount <= 0) throw new Error("أدخل إجمالي القسط وقيمة الدفعة الشهرية بشكل صحيح.");
    if (!isDateOnly(input.startDate) || !isDateOnly(input.endDate) || input.endDate < input.startDate) throw new Error("أدخل تاريخ بداية ونهاية صحيحين للقسط.");
    const debitAccount = state.accounts.find((account) => account.code.toLocaleLowerCase() === debitAccountCode.toLocaleLowerCase());
    const creditAccount = state.accounts.find((account) => account.code.toLocaleLowerCase() === creditAccountCode.toLocaleLowerCase());
    if (!debitAccount || !creditAccount || debitAccount.id === creditAccount.id) throw new Error("اختر حسابين مختلفين وموجودين للطرف المدين والدائن.");
    const calculatedEndDate = calculateInstallmentEndDate(input.startDate, totalAmount, installmentAmount);
    if (input.endDate < calculatedEndDate) throw new Error(`تاريخ النهاية لا يغطي جميع الدفعات المطلوبة. الحد الأدنى هو ${calculatedEndDate}.`);
    const installment: Installment = { id: createId("installment"), contactId: contact.id, title: input.title?.trim() || `قسط ${contact.name}`, totalAmount: Number(totalAmount.toFixed(2)), installmentAmount: Number(installmentAmount.toFixed(2)), frequency: "monthly", startDate: input.startDate, endDate: input.endDate, debitAccountCode: debitAccount.code, creditAccountCode: creditAccount.code, status: "active", createdAt: new Date().toISOString() };
    await commit({ ...state, installments: [installment, ...state.installments], auditLog: [newAuditLog("installment_created", `إضافة قسط: ${installment.title}`, installment.id), ...state.auditLog] });
    return installment;
  }, [commit, state]);

  const updateInstallmentStatus = useCallback(async (id: string, status: InstallmentStatus) => {
    if (!state.installments.some((installment) => installment.id === id)) throw new Error("القسط غير موجود.");
    await commit({ ...state, installments: state.installments.map((installment) => installment.id === id ? { ...installment, status } : installment) });
  }, [commit, state]);

  const updateInstallmentSchedule = useCallback(async (id: string, patch: { cronTaskUid?: string; lastProcessedDate?: string }) => {
    if (!state.installments.some((installment) => installment.id === id)) throw new Error("القسط غير موجود.");
    await commit({ ...state, installments: state.installments.map((installment) => installment.id === id ? { ...installment, ...(patch.cronTaskUid === undefined ? {} : { cronTaskUid: patch.cronTaskUid || undefined }), ...(patch.lastProcessedDate === undefined ? {} : { lastProcessedDate: patch.lastProcessedDate || undefined }) } : installment) });
  }, [commit, state]);

  const deleteInstallment = useCallback(async (id: string) => {
    await commit({ ...state, installments: state.installments.filter((installment) => installment.id !== id) });
  }, [commit, state]);

  const addCostCenter = useCallback(async (input: NewCostCenter) => {
    const name = input.name.trim();
    if (!name) throw new Error("أدخل اسم مركز التكلفة.");
    if (state.costCenters.some((center) => center.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error("يوجد مركز تكلفة بالاسم نفسه.");
    const center: CostCenter = { id: createId("cost-center"), name, notes: input.notes?.trim() || undefined, createdAt: new Date().toISOString() };
    await commit({ ...state, costCenters: [center, ...state.costCenters], auditLog: [newAuditLog("cost_center_created", `إضافة مركز تكلفة: ${center.name}`, center.id), ...state.auditLog] });
    return center;
  }, [commit, state]);

  const deleteCostCenter = useCallback(async (id: string) => {
    if (state.journalEntries.some((entry) => entry.costCenterId === id)) throw new Error("لا يمكن حذف مركز تكلفة مستخدم في قيود مرحّلة.");
    const center = state.costCenters.find((candidate) => candidate.id === id);
    if (!center) throw new Error("مركز التكلفة غير موجود.");
    await commit({ ...state, costCenters: state.costCenters.filter((candidate) => candidate.id !== id), auditLog: [newAuditLog("cost_center_deleted", `حذف مركز تكلفة: ${center.name}`, center.id), ...state.auditLog] });
  }, [commit, state]);

  const createVoucher = useCallback(async (input: NewVoucher) => {
    const amount = Number(input.amount); const partyName = input.partyName.trim(); const description = input.description.trim();
    const voucherDate = normaliseDateOnly(input.date);
    if (!partyName || !description || !voucherDate || !Number.isFinite(amount) || amount <= 0) throw new Error("أكمل بيانات السند ومبلغه وتاريخه بشكل صحيح.");
    const cashAccount = state.accounts.find((account) => account.id === input.cashAccountId);
    const counterpartAccount = state.accounts.find((account) => account.id === input.counterpartAccountId);
    if (!cashAccount || !counterpartAccount || cashAccount.id === counterpartAccount.id) throw new Error("اختر حسابي سند مختلفين وصحيحين.");
    if (input.costCenterId && !state.costCenters.some((center) => center.id === input.costCenterId)) throw new Error("مركز التكلفة المختار غير موجود.");
    const fxRate = input.fxRate === undefined ? 1 : Number(input.fxRate);
    if (!Number.isFinite(fxRate) || fxRate <= 0) throw new Error("أدخل سعر صرف صحيحاً أكبر من صفر.");
    const voucher: Voucher = { id: createId("voucher"), voucherNumber: `${input.type === "receipt" ? "RC" : "PV"}-${new Date().getFullYear()}-${String(state.vouchers.length + 1).padStart(4, "0")}`, type: input.type, paymentMethod: input.paymentMethod, partyName, amount: Number(amount.toFixed(2)), date: voucherDate, description, cashAccountId: cashAccount.id, counterpartAccountId: counterpartAccount.id, journalEntryId: "", createdAt: new Date().toISOString() };
    const lines: JournalLine[] = input.type === "receipt"
      ? [{ id: createId("line"), accountId: cashAccount.id, category: cashAccount.category, debit: voucher.amount, credit: 0 }, { id: createId("line"), accountId: counterpartAccount.id, category: counterpartAccount.category, debit: 0, credit: voucher.amount }]
      : [{ id: createId("line"), accountId: counterpartAccount.id, category: counterpartAccount.category, debit: voucher.amount, credit: 0 }, { id: createId("line"), accountId: cashAccount.id, category: cashAccount.category, debit: 0, credit: voucher.amount }];
    const journalEntry: JournalEntry = { id: createId("journal"), description, date: voucherDate, createdAt: new Date().toISOString(), lines, source: { type: "voucher", voucherId: voucher.id, voucherType: voucher.type }, currency: input.currency?.trim() || state.currency, fxRate, documentReference: voucher.voucherNumber, costCenterId: input.costCenterId };
    voucher.journalEntryId = journalEntry.id;
    await commit({ ...state, vouchers: [voucher, ...state.vouchers], journalEntries: [journalEntry, ...state.journalEntries], auditLog: [newAuditLog("voucher_created", `إصدار ${voucher.type === "receipt" ? "سند قبض" : "سند صرف"} ${voucher.voucherNumber}`, voucher.id), ...state.auditLog] });
    return voucher;
  }, [commit, state]);

  const createCommercialDocument = useCallback(async (input: NewCommercialDocument) => {
    const date = normaliseDateOnly(input.date); const dueDate = input.dueDate ? normaliseDateOnly(input.dueDate) ?? undefined : undefined;
    const primaryAccount = state.accounts.find((account) => account.id === input.primaryAccountId);
    const settlementAccount = state.accounts.find((account) => account.id === input.settlementAccountId);
    const taxAccount = input.taxAccountId ? state.accounts.find((account) => account.id === input.taxAccountId) : undefined;
    if (!date || (input.dueDate && (!dueDate || dueDate < date))) throw new Error("أدخل تاريخ المستند وتاريخ الاستحقاق بشكل صحيح.");
    if (input.contactId && !state.contacts.some((contact) => contact.id === input.contactId)) throw new Error("جهة التعامل المختارة غير موجودة.");
    if (!primaryAccount || !settlementAccount || primaryAccount.id === settlementAccount.id) throw new Error("اختر حسابي العملية والتسوية بشكل صحيح ومختلف.");
    const lines = input.lines.map((line) => {
      const quantity = Number(line.quantity); const unitPrice = Number(line.unitPrice); const taxRate = Number(line.taxRate ?? 0);
      if (!line.description.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error("أكمل بنود المستند والكمية والسعر والضريبة بشكل صحيح.");
      if (line.inventoryItemId && !state.inventoryItems.some((item) => item.id === line.inventoryItemId)) throw new Error("أحد أصناف المخزون المختارة غير موجود.");
      return { id: createId("document-line"), description: line.description.trim(), inventoryItemId: line.inventoryItemId, quantity: Number(quantity.toFixed(3)), unitPrice: Number(unitPrice.toFixed(2)), taxRate: Number(taxRate.toFixed(2)), lineTotal: Number((quantity * unitPrice).toFixed(2)) };
    });
    if (!lines.length) throw new Error("أضف بنداً واحداً على الأقل إلى المستند.");
    const netAmount = Number(lines.reduce((total, line) => total + line.lineTotal, 0).toFixed(2));
    const taxAmount = Number(lines.reduce((total, line) => total + (line.lineTotal * line.taxRate / 100), 0).toFixed(2));
    if (taxAmount > 0 && !taxAccount) throw new Error("اختر حساب الضريبة عند إضافة ضريبة إلى المستند.");
    const prefix = input.type === "sales_invoice" ? "SI" : "PI";
    const number = input.number?.trim() || `${prefix}-${date.slice(0, 4)}-${String(state.commercialDocuments.filter((document) => document.type === input.type).length + 1).padStart(4, "0")}`;
    if (state.commercialDocuments.some((document) => document.number.toLocaleLowerCase() === number.toLocaleLowerCase())) throw new Error("رقم المستند مستخدم بالفعل.");
    const document: CommercialDocument = { id: createId("document"), number, type: input.type, status: "draft", contactId: input.contactId ?? undefined, description: input.description.trim() || `${input.type === "sales_invoice" ? "فاتورة مبيعات" : "فاتورة مشتريات"} ${number}`, date, dueDate, lines, netAmount, taxAmount, totalAmount: Number((netAmount + taxAmount).toFixed(2)), primaryAccountId: primaryAccount.id, settlementAccountId: settlementAccount.id, taxAccountId: taxAccount?.id, createdAt: new Date().toISOString() };
    await commit({ ...state, commercialDocuments: [document, ...state.commercialDocuments], auditLog: [newAuditLog("document_created", `إنشاء مسودة ${document.type === "sales_invoice" ? "فاتورة مبيعات" : "فاتورة مشتريات"}: ${document.number}`, document.id), ...state.auditLog] });
    return document;
  }, [commit, state]);

  const postCommercialDocument = useCallback(async (id: string) => {
    const document = state.commercialDocuments.find((candidate) => candidate.id === id);
    if (!document) throw new Error("المستند غير موجود.");
    if (document.status !== "draft") throw new Error("يمكن ترحيل المستندات المسودة فقط.");
    const primaryAccount = state.accounts.find((account) => account.id === document.primaryAccountId);
    const settlementAccount = state.accounts.find((account) => account.id === document.settlementAccountId);
    const taxAccount = document.taxAmount > 0 ? state.accounts.find((account) => account.id === document.taxAccountId) : undefined;
    if (!primaryAccount || !settlementAccount || (document.taxAmount > 0 && !taxAccount)) throw new Error("حسابات المستند لم تعد متاحة. راجعها قبل الترحيل.");
    const lines: JournalLine[] = document.type === "sales_invoice"
      ? [{ id: createId("line"), accountId: settlementAccount.id, category: settlementAccount.category, debit: document.totalAmount, credit: 0 }, { id: createId("line"), accountId: primaryAccount.id, category: primaryAccount.category, debit: 0, credit: document.netAmount }, ...(taxAccount ? [{ id: createId("line"), accountId: taxAccount.id, category: taxAccount.category, debit: 0, credit: document.taxAmount }] : [])]
      : [{ id: createId("line"), accountId: primaryAccount.id, category: primaryAccount.category, debit: document.netAmount, credit: 0 }, ...(taxAccount ? [{ id: createId("line"), accountId: taxAccount.id, category: taxAccount.category, debit: document.taxAmount, credit: 0 }] : []), { id: createId("line"), accountId: settlementAccount.id, category: settlementAccount.category, debit: 0, credit: document.totalAmount }];
    const validation = validateJournalLines(lines);
    if (!validation.isBalanced) throw new Error("تعذر إنشاء قيد متوازن للمستند.");
    const journalEntry: JournalEntry = { id: createId("journal"), description: document.description, date: document.date, createdAt: new Date().toISOString(), lines, source: { type: "commercial_document", documentId: document.id, documentType: document.type }, currency: state.currency, fxRate: 1, documentReference: document.number };
    const movements: InventoryMovement[] = document.lines.filter((line) => line.inventoryItemId).map((line) => {
      const inventoryItem = state.inventoryItems.find((item) => item.id === line.inventoryItemId);
      return { id: createId("inventory-movement"), inventoryItemId: line.inventoryItemId!, type: document.type === "sales_invoice" ? "issue" : "receipt", quantity: line.quantity, unitCost: document.type === "sales_invoice" ? inventoryItem?.standardCost : line.unitPrice, date: document.date, reference: document.number, commercialDocumentId: document.id, createdAt: new Date().toISOString() };
    });
    await commit({ ...state, commercialDocuments: state.commercialDocuments.map((candidate) => candidate.id === document.id ? { ...candidate, status: "posted", journalEntryId: journalEntry.id } : candidate), inventoryMovements: [...movements, ...state.inventoryMovements], journalEntries: [journalEntry, ...state.journalEntries], auditLog: [newAuditLog("document_posted", `ترحيل المستند ${document.number}`, document.id), ...state.auditLog] });
  }, [commit, state]);

  const addInventoryItem = useCallback(async (input: NewInventoryItem) => {
    const name = input.name.trim(); const sku = input.sku?.trim(); const standardCost = input.standardCost === undefined ? undefined : Number(input.standardCost); const reorderLevel = input.reorderLevel === undefined ? undefined : Number(input.reorderLevel);
    if (!name) throw new Error("أدخل اسم صنف المخزون.");
    if (state.inventoryItems.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase() || (sku && item.sku?.toLocaleLowerCase() === sku.toLocaleLowerCase()))) throw new Error("يوجد صنف أو رمز مخزون بالاسم نفسه.");
    if ((standardCost !== undefined && (!Number.isFinite(standardCost) || standardCost < 0)) || (reorderLevel !== undefined && (!Number.isFinite(reorderLevel) || reorderLevel < 0))) throw new Error("أدخل تكلفة ومستوى إعادة طلب صحيحين أو اتركهما فارغين.");
    const item: InventoryItem = { id: createId("inventory-item"), name, sku: sku || undefined, unit: input.unit?.trim() || "وحدة", standardCost: standardCost === undefined ? undefined : Number(standardCost.toFixed(2)), reorderLevel: reorderLevel === undefined ? undefined : Number(reorderLevel.toFixed(3)), createdAt: new Date().toISOString() };
    await commit({ ...state, inventoryItems: [item, ...state.inventoryItems], auditLog: [newAuditLog("inventory_item_created", `إضافة صنف مخزون: ${item.name}`, item.id), ...state.auditLog] });
    return item;
  }, [commit, state]);

  const recordInventoryMovement = useCallback(async (input: NewInventoryMovement) => {
    const item = state.inventoryItems.find((candidate) => candidate.id === input.inventoryItemId); const quantity = Number(input.quantity); const unitCost = input.unitCost === undefined ? undefined : Number(input.unitCost); const date = normaliseDateOnly(input.date);
    if (!item || !date || !Number.isFinite(quantity) || quantity <= 0 || (unitCost !== undefined && (!Number.isFinite(unitCost) || unitCost < 0))) throw new Error("أكمل بيانات حركة المخزون بشكل صحيح.");
    const currentQuantity = state.inventoryMovements.filter((movement) => movement.inventoryItemId === item.id).reduce((total, movement) => total + (movement.type === "receipt" ? movement.quantity : -movement.quantity), 0);
    if (input.type === "issue" && quantity > currentQuantity) throw new Error("لا يمكن صرف كمية أكبر من الرصيد المتاح للصنف.");
    const movement: InventoryMovement = { id: createId("inventory-movement"), inventoryItemId: item.id, type: input.type, quantity: Number(quantity.toFixed(3)), unitCost: unitCost === undefined ? item.standardCost : Number(unitCost.toFixed(2)), date, reference: input.reference?.trim() || undefined, createdAt: new Date().toISOString() };
    await commit({ ...state, inventoryMovements: [movement, ...state.inventoryMovements], auditLog: [newAuditLog("inventory_movement_recorded", `${movement.type === "receipt" ? "استلام" : "صرف"} مخزون: ${item.name}`, movement.id), ...state.auditLog] });
    return movement;
  }, [commit, state]);

  const addEmployee = useCallback(async (input: NewEmployee) => {
    const name = input.name.trim(); const basicSalary = input.basicSalary === undefined ? undefined : Number(input.basicSalary);
    if (!name) throw new Error("أدخل اسم الموظف.");
    if (state.employees.some((employee) => employee.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error("يوجد موظف بالاسم نفسه.");
    if (basicSalary !== undefined && (!Number.isFinite(basicSalary) || basicSalary < 0)) throw new Error("أدخل راتباً أساسياً صحيحاً أو اتركه فارغاً.");
    const employee: Employee = { id: createId("employee"), name, phone: input.phone?.trim() || undefined, basicSalary: basicSalary === undefined ? undefined : Number(basicSalary.toFixed(2)), notes: input.notes?.trim() || undefined, createdAt: new Date().toISOString() };
    await commit({ ...state, employees: [employee, ...state.employees], auditLog: [newAuditLog("employee_created", `إضافة موظف: ${employee.name}`, employee.id), ...state.auditLog] });
    return employee;
  }, [commit, state]);

  const createPayrollRun = useCallback(async (input: NewPayrollRun) => {
    const employee = state.employees.find((candidate) => candidate.id === input.employeeId); const date = normaliseDateOnly(input.date); const basicSalary = Number(input.basicSalary); const allowances = Number(input.allowances ?? 0); const deductions = Number(input.deductions ?? 0);
    const expenseAccount = state.accounts.find((account) => account.id === input.expenseAccountId); const paymentAccount = state.accounts.find((account) => account.id === input.paymentAccountId); const deductionsAccount = input.deductionsAccountId ? state.accounts.find((account) => account.id === input.deductionsAccountId) : undefined;
    if (!employee || !date || !expenseAccount || !paymentAccount || expenseAccount.id === paymentAccount.id || !Number.isFinite(basicSalary) || basicSalary < 0 || !Number.isFinite(allowances) || allowances < 0 || !Number.isFinite(deductions) || deductions < 0 || basicSalary + allowances < deductions || (deductions > 0 && !deductionsAccount)) throw new Error("أكمل بيانات مسير الرواتب وحساباته بشكل صحيح.");
    const run: PayrollRun = { id: createId("payroll"), employeeId: employee.id, date, basicSalary: Number(basicSalary.toFixed(2)), allowances: Number(allowances.toFixed(2)), deductions: Number(deductions.toFixed(2)), netAmount: Number((basicSalary + allowances - deductions).toFixed(2)), status: "draft", expenseAccountId: expenseAccount.id, paymentAccountId: paymentAccount.id, deductionsAccountId: deductionsAccount?.id, createdAt: new Date().toISOString() };
    await commit({ ...state, payrollRuns: [run, ...state.payrollRuns], auditLog: [newAuditLog("payroll_created", `إنشاء مسير راتب للموظف: ${employee.name}`, run.id), ...state.auditLog] });
    return run;
  }, [commit, state]);

  const postPayrollRun = useCallback(async (id: string) => {
    const run = state.payrollRuns.find((candidate) => candidate.id === id); const employee = run ? state.employees.find((candidate) => candidate.id === run.employeeId) : undefined;
    if (!run || !employee) throw new Error("مسير الراتب أو الموظف غير موجود.");
    if (run.status !== "draft") throw new Error("يمكن ترحيل مسيرات الرواتب المسودة فقط.");
    const expenseAccount = state.accounts.find((account) => account.id === run.expenseAccountId); const paymentAccount = state.accounts.find((account) => account.id === run.paymentAccountId); const deductionsAccount = run.deductions > 0 ? state.accounts.find((account) => account.id === run.deductionsAccountId) : undefined;
    if (!expenseAccount || !paymentAccount || (run.deductions > 0 && !deductionsAccount)) throw new Error("حسابات مسير الراتب غير متاحة.");
    const gross = Number((run.basicSalary + run.allowances).toFixed(2));
    const lines: JournalLine[] = [{ id: createId("line"), accountId: expenseAccount.id, category: expenseAccount.category, debit: gross, credit: 0 }, { id: createId("line"), accountId: paymentAccount.id, category: paymentAccount.category, debit: 0, credit: run.netAmount }, ...(deductionsAccount ? [{ id: createId("line"), accountId: deductionsAccount.id, category: deductionsAccount.category, debit: 0, credit: run.deductions }] : [])];
    const validation = validateJournalLines(lines); if (!validation.isBalanced) throw new Error("تعذر إنشاء قيد راتب متوازن.");
    const journalEntry: JournalEntry = { id: createId("journal"), description: `مسير راتب: ${employee.name}`, date: run.date, createdAt: new Date().toISOString(), lines, source: { type: "payroll", payrollRunId: run.id }, currency: state.currency, fxRate: 1, documentReference: `PR-${run.date}-${run.id.slice(-4)}` };
    await commit({ ...state, payrollRuns: state.payrollRuns.map((candidate) => candidate.id === run.id ? { ...candidate, status: "posted", journalEntryId: journalEntry.id } : candidate), journalEntries: [journalEntry, ...state.journalEntries], auditLog: [newAuditLog("payroll_posted", `ترحيل مسير راتب: ${employee.name}`, run.id), ...state.auditLog] });
  }, [commit, state]);

  const addFixedAsset = useCallback(async (input: NewFixedAsset) => {
    const name = input.name.trim(); const acquisitionDate = normaliseDateOnly(input.acquisitionDate); const cost = Number(input.cost); const salvageValue = Number(input.salvageValue ?? 0); const usefulLifeMonths = Number(input.usefulLifeMonths);
    const assetAccount = state.accounts.find((account) => account.id === input.assetAccountId); const depreciationExpenseAccount = state.accounts.find((account) => account.id === input.depreciationExpenseAccountId); const accumulatedDepreciationAccount = state.accounts.find((account) => account.id === input.accumulatedDepreciationAccountId);
    if (!name || !acquisitionDate || !assetAccount || !depreciationExpenseAccount || !accumulatedDepreciationAccount || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(salvageValue) || salvageValue < 0 || salvageValue > cost || !Number.isInteger(usefulLifeMonths) || usefulLifeMonths < 1) throw new Error("أكمل بيانات الأصل الثابت وحساباته بشكل صحيح.");
    const asset: FixedAsset = { id: createId("asset"), name, acquisitionDate, cost: Number(cost.toFixed(2)), salvageValue: Number(salvageValue.toFixed(2)), usefulLifeMonths, status: "active", assetAccountId: assetAccount.id, depreciationExpenseAccountId: depreciationExpenseAccount.id, accumulatedDepreciationAccountId: accumulatedDepreciationAccount.id, createdAt: new Date().toISOString() };
    await commit({ ...state, fixedAssets: [asset, ...state.fixedAssets], auditLog: [newAuditLog("asset_created", `إضافة أصل ثابت: ${asset.name}`, asset.id), ...state.auditLog] });
    return asset;
  }, [commit, state]);

  const recordMonthlyDepreciation = useCallback(async (assetId: string, dateValue: string) => {
    const asset = state.fixedAssets.find((candidate) => candidate.id === assetId); const date = normaliseDateOnly(dateValue);
    if (!asset || asset.status !== "active" || !date) throw new Error("الأصل أو تاريخ الإهلاك غير صالح.");
    if (state.depreciationRecords.some((record) => record.assetId === asset.id && record.date.slice(0, 7) === date.slice(0, 7))) throw new Error("يوجد قيد إهلاك لهذا الأصل في الشهر نفسه.");
    const expenseAccount = state.accounts.find((account) => account.id === asset.depreciationExpenseAccountId); const accumulatedAccount = state.accounts.find((account) => account.id === asset.accumulatedDepreciationAccountId);
    if (!expenseAccount || !accumulatedAccount) throw new Error("حسابات إهلاك الأصل غير متاحة.");
    const alreadyDepreciated = state.depreciationRecords.filter((record) => record.assetId === asset.id).reduce((total, record) => total + record.amount, 0); const monthlyAmount = Number(((asset.cost - asset.salvageValue) / asset.usefulLifeMonths).toFixed(2)); const amount = Number(Math.min(monthlyAmount, asset.cost - asset.salvageValue - alreadyDepreciated).toFixed(2));
    if (amount <= 0) throw new Error("اكتمل إهلاك هذا الأصل حتى قيمته التخريدية.");
    const record: DepreciationRecord = { id: createId("depreciation"), assetId: asset.id, date, amount, journalEntryId: "", createdAt: new Date().toISOString() };
    const lines: JournalLine[] = [{ id: createId("line"), accountId: expenseAccount.id, category: expenseAccount.category, debit: amount, credit: 0 }, { id: createId("line"), accountId: accumulatedAccount.id, category: accumulatedAccount.category, debit: 0, credit: amount }];
    const journalEntry: JournalEntry = { id: createId("journal"), description: `إهلاك شهري: ${asset.name}`, date, createdAt: new Date().toISOString(), lines, source: { type: "depreciation", depreciationId: record.id, assetId: asset.id }, currency: state.currency, fxRate: 1, documentReference: `DEP-${date.slice(0, 7)}-${asset.id.slice(-4)}` }; record.journalEntryId = journalEntry.id;
    await commit({ ...state, depreciationRecords: [record, ...state.depreciationRecords], journalEntries: [journalEntry, ...state.journalEntries], auditLog: [newAuditLog("depreciation_posted", `ترحيل إهلاك الأصل: ${asset.name}`, record.id), ...state.auditLog] });
    return record;
  }, [commit, state]);

  const addCashBankAccount = useCallback(async (input: NewCashBankAccount) => {
    const name = input.name.trim(); const linkedAccount = state.accounts.find((account) => account.id === input.accountId);
    if (!name || !linkedAccount || linkedAccount.category !== "asset") throw new Error("أدخل اسماً واربطه بحساب أصل موجود.");
    if (input.type !== "cash" && input.type !== "bank") throw new Error("اختر نوع الحساب: صندوق أو بنك.");
    if (state.cashBankAccounts.some((account) => account.accountId === linkedAccount.id)) throw new Error("الحساب المحاسبي مرتبط مسبقاً بصندوق أو بنك.");
    if (state.cashBankAccounts.some((account) => account.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error("يوجد صندوق أو بنك بالاسم نفسه.");
    const cashBankAccount: CashBankAccount = { id: createId("cash-bank"), name, type: input.type, accountId: linkedAccount.id, bankName: input.type === "bank" && input.bankName?.trim() ? input.bankName.trim() : undefined, accountNumber: input.type === "bank" && input.accountNumber?.trim() ? input.accountNumber.trim() : undefined, notes: input.notes?.trim() || undefined, createdAt: new Date().toISOString() };
    await commit({ ...state, cashBankAccounts: [cashBankAccount, ...state.cashBankAccounts], auditLog: [newAuditLog("cash_bank_account_created", `إضافة ${cashBankAccount.type === "cash" ? "صندوق" : "حساب بنكي"}: ${cashBankAccount.name}`, cashBankAccount.id), ...state.auditLog] });
    return cashBankAccount;
  }, [commit, state]);

  const createCashBankTransaction = useCallback(async (input: NewCashBankTransaction) => {
    const amount = Number(input.amount); const date = normaliseDateOnly(input.date); const description = input.description.trim();
    const cashBank = state.cashBankAccounts.find((account) => account.id === input.cashBankAccountId); const counterpart = state.accounts.find((account) => account.id === input.counterpartAccountId); const cashAccount = cashBank ? state.accounts.find((account) => account.id === cashBank.accountId) : undefined;
    if (!cashBank || !cashAccount || !counterpart || cashAccount.id === counterpart.id || !date || !description || !Number.isFinite(amount) || amount <= 0) throw new Error("أكمل بيانات الحركة واختر حسابين مختلفين صحيحين.");
    const transaction: CashBankTransaction = { id: createId("cash-bank-transaction"), type: input.type, date, amount: Number(amount.toFixed(2)), description, cashBankAccountId: cashBank.id, counterpartAccountId: counterpart.id, journalEntryId: "", createdAt: new Date().toISOString() };
    const lines: JournalLine[] = input.type === "receipt" ? [{ id: createId("line"), accountId: cashAccount.id, category: cashAccount.category, debit: transaction.amount, credit: 0 }, { id: createId("line"), accountId: counterpart.id, category: counterpart.category, debit: 0, credit: transaction.amount }] : [{ id: createId("line"), accountId: counterpart.id, category: counterpart.category, debit: transaction.amount, credit: 0 }, { id: createId("line"), accountId: cashAccount.id, category: cashAccount.category, debit: 0, credit: transaction.amount }];
    if (!validateJournalLines(lines).isBalanced) throw new Error("تعذر إنشاء قيد حركة نقدية متوازن.");
    const journalEntry: JournalEntry = { id: createId("journal"), description, date, createdAt: new Date().toISOString(), lines, currency: state.currency, fxRate: 1, documentReference: `CB-${date}-${transaction.id.slice(-4)}` };
    transaction.journalEntryId = journalEntry.id;
    await commit({ ...state, cashBankTransactions: [transaction, ...state.cashBankTransactions], journalEntries: [journalEntry, ...state.journalEntries], auditLog: [newAuditLog("cash_bank_transaction_posted", `ترحيل ${input.type === "receipt" ? "قبض" : "صرف"}: ${cashBank.name}`, transaction.id), ...state.auditLog] });
    return transaction;
  }, [commit, state]);

  const transferCashBankFunds = useCallback(async (input: NewCashBankTransfer) => {
    const amount = Number(input.amount); const date = normaliseDateOnly(input.date); const description = input.description.trim();
    const from = state.cashBankAccounts.find((account) => account.id === input.fromCashBankAccountId); const to = state.cashBankAccounts.find((account) => account.id === input.toCashBankAccountId); const fromAccount = from ? state.accounts.find((account) => account.id === from.accountId) : undefined; const toAccount = to ? state.accounts.find((account) => account.id === to.accountId) : undefined;
    if (!from || !to || !fromAccount || !toAccount || from.id === to.id || fromAccount.id === toAccount.id || !date || !description || !Number.isFinite(amount) || amount <= 0) throw new Error("أكمل بيانات التحويل واختر حسابي نقد أو بنك مختلفين.");
    const transaction: CashBankTransaction = { id: createId("cash-bank-transfer"), type: "transfer", date, amount: Number(amount.toFixed(2)), description, fromCashBankAccountId: from.id, toCashBankAccountId: to.id, journalEntryId: "", createdAt: new Date().toISOString() };
    const lines: JournalLine[] = [{ id: createId("line"), accountId: toAccount.id, category: toAccount.category, debit: transaction.amount, credit: 0 }, { id: createId("line"), accountId: fromAccount.id, category: fromAccount.category, debit: 0, credit: transaction.amount }];
    if (!validateJournalLines(lines).isBalanced) throw new Error("تعذر إنشاء قيد تحويل متوازن.");
    const journalEntry: JournalEntry = { id: createId("journal"), description, date, createdAt: new Date().toISOString(), lines, currency: state.currency, fxRate: 1, documentReference: `TR-${date}-${transaction.id.slice(-4)}` };
    transaction.journalEntryId = journalEntry.id;
    await commit({ ...state, cashBankTransactions: [transaction, ...state.cashBankTransactions], journalEntries: [journalEntry, ...state.journalEntries], auditLog: [newAuditLog("cash_bank_transaction_posted", `تحويل من ${from.name} إلى ${to.name}`, transaction.id), ...state.auditLog] });
    return transaction;
  }, [commit, state]);

  const validateReconciliationInput = (input: NewBankReconciliation, excludedId?: string) => {
    const bankAccount = state.cashBankAccounts.find((account) => account.id === input.bankAccountId && account.type === "bank");
    const periodStart = normaliseDateOnly(input.periodStart); const periodEnd = normaliseDateOnly(input.periodEnd);
    const openingBalance = Number(input.openingBalance); const closingBalance = Number(input.closingBalance);
    if (!bankAccount || !periodStart || !periodEnd || periodEnd < periodStart || !Number.isFinite(openingBalance) || !Number.isFinite(closingBalance)) throw new Error("أكمل حساب البنك وفترة الكشف والأرصدة الافتتاحية والختامية بشكل صحيح.");
    if (state.bankReconciliations.some((candidate) => candidate.id !== excludedId && candidate.bankAccountId === bankAccount.id && candidate.periodStart <= periodEnd && candidate.periodEnd >= periodStart)) throw new Error("تتداخل فترة الكشف مع مطابقة مصرفية قائمة للحساب نفسه.");
    return { bankAccount, periodStart, periodEnd, openingBalance: Number(openingBalance.toFixed(2)), closingBalance: Number(closingBalance.toFixed(2)) };
  };

  const addBankReconciliation = useCallback(async (input: NewBankReconciliation) => {
    const validated = validateReconciliationInput(input);
    const now = new Date().toISOString();
    const reconciliation: BankReconciliation = { id: createId("bank-reconciliation"), bankAccountId: validated.bankAccount.id, periodStart: validated.periodStart, periodEnd: validated.periodEnd, openingBalance: validated.openingBalance, closingBalance: validated.closingBalance, lines: [], createdAt: now, updatedAt: now };
    await commit({ ...state, bankReconciliations: [reconciliation, ...state.bankReconciliations], auditLog: [newAuditLog("bank_reconciliation_created", `إنشاء كشف مطابقة مصرفية: ${validated.bankAccount.name}`, reconciliation.id), ...state.auditLog] });
    return reconciliation;
  }, [commit, state]);

  const updateBankReconciliation = useCallback(async (id: string, input: NewBankReconciliation) => {
    const current = state.bankReconciliations.find((candidate) => candidate.id === id);
    if (!current) throw new Error("كشف المطابقة غير موجود.");
    const validated = validateReconciliationInput(input, id);
    if (current.lines.some((line) => line.date < validated.periodStart || line.date > validated.periodEnd)) throw new Error("لا يمكن تغيير الفترة قبل تعديل أو حذف السطور الواقعة خارجها.");
    const reconciliation: BankReconciliation = { ...current, bankAccountId: validated.bankAccount.id, periodStart: validated.periodStart, periodEnd: validated.periodEnd, openingBalance: validated.openingBalance, closingBalance: validated.closingBalance, updatedAt: new Date().toISOString() };
    await commit({ ...state, bankReconciliations: state.bankReconciliations.map((candidate) => candidate.id === id ? reconciliation : candidate), auditLog: [newAuditLog("bank_reconciliation_updated", `تحديث كشف مطابقة مصرفية: ${validated.bankAccount.name}`, id), ...state.auditLog] });
    return reconciliation;
  }, [commit, state]);

  const addReconciliationLine = useCallback(async (reconciliationId: string, input: NewBankStatementLine) => {
    const reconciliation = state.bankReconciliations.find((candidate) => candidate.id === reconciliationId);
    const date = normaliseDateOnly(input.date); const description = input.description.trim(); const amount = Number(input.amount);
    if (!reconciliation || !date || date < reconciliation.periodStart || date > reconciliation.periodEnd || !description || !Number.isFinite(amount) || amount === 0) throw new Error("أدخل سطراً صحيحاً ضمن فترة الكشف وبمبلغ غير صفري.");
    const line: BankStatementLine = { id: createId("statement-line"), date, description, amount: Number(amount.toFixed(2)), reference: input.reference?.trim() || undefined, status: "unmatched" };
    const updated = { ...reconciliation, lines: [...reconciliation.lines, line], updatedAt: new Date().toISOString() };
    await commit({ ...state, bankReconciliations: state.bankReconciliations.map((candidate) => candidate.id === reconciliationId ? updated : candidate), auditLog: [newAuditLog("bank_reconciliation_updated", `إضافة سطر إلى كشف المطابقة المصرفية`, reconciliationId), ...state.auditLog] });
    return line;
  }, [commit, state]);

  const addReconciliationLines = useCallback(async (reconciliationId: string, inputs: NewBankStatementLine[]) => {
    const reconciliation = state.bankReconciliations.find((candidate) => candidate.id === reconciliationId);
    if (!reconciliation) throw new Error("كشف المطابقة غير موجود.");
    if (!inputs.length) throw new Error("لا توجد سطور صالحة لاستيرادها.");
    if (inputs.length > 5_000) throw new Error("يتجاوز الملف الحد الآمن للاستيراد دفعة واحدة (5000 سطر).");
    const lines = inputs.map((input) => {
      const date = normaliseDateOnly(input.date); const description = input.description.trim(); const amount = Number(input.amount);
      if (!date || date < reconciliation.periodStart || date > reconciliation.periodEnd || !description || !Number.isFinite(amount) || amount === 0) throw new Error("يحتوي الملف على سطر غير صالح أو خارج فترة الكشف؛ لم تُحفظ أي بيانات.");
      return { id: createId("statement-line"), date, description, amount: Number(amount.toFixed(2)), reference: input.reference?.trim() || undefined, status: "unmatched" as const };
    });
    const updated = { ...reconciliation, lines: [...reconciliation.lines, ...lines], updatedAt: new Date().toISOString() };
    await commit({ ...state, bankReconciliations: state.bankReconciliations.map((candidate) => candidate.id === reconciliationId ? updated : candidate), auditLog: [newAuditLog("bank_reconciliation_updated", `استيراد ${lines.length.toLocaleString("ar-LY")} سطر من كشف البنك`, reconciliationId), ...state.auditLog] });
    return lines;
  }, [commit, state]);

  const updateReconciliationLine = useCallback(async (reconciliationId: string, lineId: string, patch: BankReconciliationLinePatch) => {
    const reconciliation = state.bankReconciliations.find((candidate) => candidate.id === reconciliationId);
    const current = reconciliation?.lines.find((line) => line.id === lineId);
    const bankAccount = reconciliation ? state.cashBankAccounts.find((account) => account.id === reconciliation.bankAccountId && account.type === "bank") : undefined;
    if (!reconciliation || !current || !bankAccount) throw new Error("سطر كشف البنك أو الحساب المرتبط غير موجود.");
    const date = patch.date === undefined ? current.date : normaliseDateOnly(patch.date);
    const description = patch.description === undefined ? current.description : patch.description.trim();
    const amount = patch.amount === undefined ? current.amount : Number(patch.amount);
    const requestedStatus: BankStatementLineStatus = patch.status ?? (patch.matchedEntryId ? "matched" : current.status);
    const matchedEntryId = patch.matchedEntryId === undefined ? current.matchedEntryId : patch.matchedEntryId || undefined;
    if (!date || date < reconciliation.periodStart || date > reconciliation.periodEnd || !description || !Number.isFinite(amount) || amount === 0 || (requestedStatus !== "matched" && requestedStatus !== "unmatched" && requestedStatus !== "excluded")) throw new Error("تحقق من تاريخ السطر ووصفه ومبلغه وحالته.");
    if (requestedStatus === "matched") {
      const entry = matchedEntryId ? state.journalEntries.find((candidate) => candidate.id === matchedEntryId) : undefined;
      if (!entry || !entry.lines.some((line) => line.accountId === bankAccount.accountId)) throw new Error("اختر قيداً فعلياً مرتبطاً بالحساب البنكي للمطابقة.");
      if (state.bankReconciliations.some((candidate) => candidate.lines.some((line) => line.id !== lineId && line.status === "matched" && line.matchedEntryId === entry.id))) throw new Error("هذا القيد مطابق بالفعل مع سطر كشف آخر.");
    }
    const line: BankStatementLine = { id: current.id, date, description, amount: Number(amount.toFixed(2)), reference: patch.reference === undefined ? current.reference : patch.reference.trim() || undefined, status: requestedStatus, matchedEntryId: requestedStatus === "matched" ? matchedEntryId : undefined };
    const updated = { ...reconciliation, lines: reconciliation.lines.map((candidate) => candidate.id === lineId ? line : candidate), updatedAt: new Date().toISOString() };
    await commit({ ...state, bankReconciliations: state.bankReconciliations.map((candidate) => candidate.id === reconciliationId ? updated : candidate), auditLog: [newAuditLog("bank_reconciliation_updated", `تحديث سطر مطابقة مصرفية`, reconciliationId), ...state.auditLog] });
  }, [commit, state]);

  const deleteBankReconciliation = useCallback(async (id: string) => {
    const reconciliation = state.bankReconciliations.find((candidate) => candidate.id === id);
    if (!reconciliation) return;
    await commit({ ...state, bankReconciliations: state.bankReconciliations.filter((candidate) => candidate.id !== id), auditLog: [newAuditLog("bank_reconciliation_deleted", "حذف كشف مطابقة مصرفية دون تعديل القيود.", id), ...state.auditLog] });
  }, [commit, state]);

  const addBudget = useCallback(async (input: NewBudget) => {
    const name = input.name.trim(); const startDate = normaliseDateOnly(input.startDate); const endDate = normaliseDateOnly(input.endDate);
    if (!name || !startDate || !endDate || endDate < startDate) throw new Error("أدخل اسم الميزانية وفترتها بشكل صحيح.");
    if (state.budgets.some((budget) => budget.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error("توجد ميزانية بالاسم نفسه.");
    const budget: Budget = { id: createId("budget"), name, startDate, endDate, notes: input.notes?.trim() || undefined, createdAt: new Date().toISOString() };
    await commit({ ...state, budgets: [budget, ...state.budgets], auditLog: [newAuditLog("budget_created", `إضافة ميزانية: ${budget.name}`, budget.id), ...state.auditLog] });
    return budget;
  }, [commit, state]);

  const addBudgetLine = useCallback(async (input: NewBudgetLine) => {
    const plannedAmount = Number(input.plannedAmount); const budget = state.budgets.find((candidate) => candidate.id === input.budgetId); const account = state.accounts.find((candidate) => candidate.id === input.accountId);
    if (!budget || !account || (account.category !== "revenue" && account.category !== "expense") || !Number.isFinite(plannedAmount) || plannedAmount <= 0) throw new Error("اختر ميزانية وحساب إيراد أو مصروف وأدخل مبلغاً مخططاً أكبر من صفر.");
    if (state.budgetLines.some((line) => line.budgetId === budget.id && line.accountId === account.id)) throw new Error("يوجد بند مخطط لهذا الحساب في الميزانية المختارة.");
    const line: BudgetLine = { id: createId("budget-line"), budgetId: budget.id, accountId: account.id, plannedAmount: Number(plannedAmount.toFixed(2)), createdAt: new Date().toISOString() };
    await commit({ ...state, budgetLines: [line, ...state.budgetLines], auditLog: [newAuditLog("budget_line_created", `إضافة بند ميزانية: ${account.name}`, line.id), ...state.auditLog] });
    return line;
  }, [commit, state]);

  const reverseJournalEntry = useCallback(async (id: string, date?: string) => {
    const entry = state.journalEntries.find((candidate) => candidate.id === id);
    const reversalDate = normaliseDateOnly(date ?? new Date().toISOString());
    if (!entry) throw new Error("القيد غير موجود.");
    if (entry.source?.type === "installment") throw new Error("لا يمكن عكس قيد قسط من التطبيق. عالجه من سجل القسط للحفاظ على التزامن.");
    if (!reversalDate) throw new Error("أدخل تاريخاً صحيحاً للقيد العكسي.");
    if (state.journalEntries.some((candidate) => candidate.source?.type === "reversal" && candidate.source.originalEntryId === id)) throw new Error("يوجد قيد عكسي لهذا القيد بالفعل.");
    const reversing: JournalEntry = { id: createId("journal"), description: `قيد عكسي: ${entry.description}`, date: reversalDate, createdAt: new Date().toISOString(), lines: entry.lines.map((line) => ({ ...line, id: createId("line"), debit: line.credit, credit: line.debit })), source: { type: "reversal", originalEntryId: entry.id }, currency: entry.currency, fxRate: entry.fxRate, documentReference: entry.documentReference ? `REV-${entry.documentReference}` : undefined, costCenterId: entry.costCenterId, reversalOfEntryId: entry.id };
    await commit({ ...state, journalEntries: [reversing, ...state.journalEntries], auditLog: [newAuditLog("journal_reversed", `عكس القيد: ${entry.description}`, reversing.id), ...state.auditLog] });
  }, [commit, state]);

  const suggestAccountCode = useCallback((category: AccountCategory, subrangeId?: string) => nextAccountCode(state.accounts, category, state.numbering, state.subranges, subrangeId), [state.accounts, state.numbering, state.subranges]);
  const updateAccountNumbering = useCallback(async (numbering: AccountNumbering) => commit({ ...state, numbering: normaliseAccountNumbering(numbering) }), [commit, state]);
  const addSubrange = useCallback(async (input: NewAccountSubrange) => {
    const name = input.name.trim(); const prefix = input.prefix.trim(); const start = Math.floor(Number(input.start)); const end = Math.floor(Number(input.end));
    if (!name || !/^[A-Za-z0-9._-]*$/.test(prefix) || !Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) throw new Error("أدخل اسماً وبادئة صحيحة ومدى رقمياً صالحاً.");
    const conflict = state.subranges.find((range) => range.category === input.category && range.prefix === prefix && range.start <= end && range.end >= start);
    if (conflict) throw new Error(`يتداخل المدى مع النطاق «${conflict.name}».`);
    const subrange: AccountSubrange = { id: createId("range"), name, category: input.category, prefix, start, end, createdAt: new Date().toISOString() };
    await commit({ ...state, subranges: [...state.subranges, subrange] });
  }, [commit, state]);
  const deleteSubrange = useCallback(async (id: string) => {
    if (state.accounts.some((account) => account.subrangeId === id)) throw new Error("لا يمكن حذف نطاق مرتبط بحسابات موجودة.");
    await commit({ ...state, subranges: state.subranges.filter((range) => range.id !== id) });
  }, [commit, state]);
  const updateCurrency = useCallback(async (currency: string) => {
    const nextCurrency = normaliseCurrencyCode(currency) || "د.ل";
    await commit({ ...state, currency: nextCurrency });
  }, [commit, state]);
  const addCurrency = useCallback(async (input: NewCurrency) => {
    const code = input.code.trim().toUpperCase(); const name = input.name.trim();
    if (!/^[A-Z0-9._ -]{1,12}$/.test(code) || !name) throw new Error("أدخل رمز عملة مختصراً واسمها.");
    if (code === state.currency.toUpperCase() || state.currencies.some((currency) => currency.code === code)) throw new Error("هذه العملة موجودة بالفعل ضمن الخيارات.");
    const currency: CurrencyDefinition = { id: createId("currency"), code, name, createdAt: new Date().toISOString() };
    await commit({ ...state, currencies: [...state.currencies, currency], auditLog: [newAuditLog("currency_created", `إضافة عملة مستند: ${currency.code}`, currency.id), ...state.auditLog] });
    return currency;
  }, [commit, state]);
  const deleteCurrency = useCallback(async (id: string) => {
    const currency = state.currencies.find((candidate) => candidate.id === id);
    if (!currency) return;
    if (currency.code === state.currency.toUpperCase()) throw new Error("لا يمكن حذف العملة الأساسية. غيّر العملة الأساسية أولاً.");
    await commit({ ...state, currencies: state.currencies.filter((candidate) => candidate.id !== id), auditLog: [newAuditLog("currency_deleted", `حذف عملة مستند: ${currency.code}`, currency.id), ...state.auditLog] });
  }, [commit, state]);
  const updateNumberLocale = useCallback(async (numberLocale: NumberLocale) => commit({ ...state, numberLocale }), [commit, state]);
  const acceptTerms = useCallback(async () => commit({ ...state, termsAccepted: true }), [commit, state]);
  const exportBackup = useCallback(async () => JSON.stringify({ format: "smart-accountant-backup", version: 1, exportedAt: new Date().toISOString(), data: state } satisfies AccountingBackup), [state]);
  const restoreBackup = useCallback(async (raw: string) => {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error("ملف النسخة الاحتياطية غير صالح."); }
    if (!parsed || typeof parsed !== "object") throw new Error("ملف النسخة الاحتياطية غير صالح.");
    const backup = parsed as Partial<AccountingBackup>;
    if (backup.format !== "smart-accountant-backup" || backup.version !== 1 || !backup.data) throw new Error("هذه ليست نسخة احتياطية متوافقة مع المحاسب الذكي.");
    const restored = normaliseLoadedData(JSON.stringify(backup.data));
    await commit(restored);
  }, [commit]);
  const clearAllData = useCallback(async () => commit({ ...emptyState, currency: state.currency, currencies: state.currencies, numberLocale: state.numberLocale, termsAccepted: state.termsAccepted, numbering: state.numbering, subranges: state.subranges }), [commit, state.currencies, state.currency, state.numberLocale, state.numbering, state.subranges, state.termsAccepted]);
  const accountBalances = useMemo(() => calculateAccountBalances(state.accounts, state.journalEntries), [state.accounts, state.journalEntries]);
  const summary = useMemo(() => calculateCategoryTotals(state.accounts, accountBalances), [accountBalances, state.accounts]);
  const balanceSheet = useMemo(() => calculateBalanceSheet(summary), [summary]);
  useEffect(() => { setActiveNumberLocale(state.numberLocale); }, [state.numberLocale]);
  const value = useMemo<AccountingContextValue>(() => ({ state, isReady, summary, accountBalances, netIncome: calculateNetIncome(summary), balanceSheet, addAccount, addJournalEntry, importJournalEntries, addContact, deleteContact, addAccountingItem, deleteAccountingItem, addInstallment, updateInstallmentStatus, updateInstallmentSchedule, deleteInstallment, addCostCenter, deleteCostCenter, createVoucher, createCommercialDocument, postCommercialDocument, addInventoryItem, recordInventoryMovement, addEmployee, createPayrollRun, postPayrollRun, addFixedAsset, recordMonthlyDepreciation, addCashBankAccount, createCashBankTransaction, transferCashBankFunds, addBankReconciliation, updateBankReconciliation, addReconciliationLine, addReconciliationLines, updateReconciliationLine, deleteBankReconciliation, addBudget, addBudgetLine, reverseJournalEntry, suggestAccountCode, updateAccountNumbering, addSubrange, deleteSubrange, updateCurrency, addCurrency, deleteCurrency, updateNumberLocale, acceptTerms, exportBackup, restoreBackup, clearAllData }), [acceptTerms, accountBalances, addAccount, addAccountingItem, addBankReconciliation, addBudget, addBudgetLine, addCashBankAccount, addContact, addCostCenter, addCurrency, addEmployee, addFixedAsset, addInstallment, addInventoryItem, addJournalEntry, addReconciliationLine, addReconciliationLines, addSubrange, balanceSheet, clearAllData, createCashBankTransaction, createCommercialDocument, createPayrollRun, createVoucher, deleteAccountingItem, deleteBankReconciliation, deleteContact, deleteCostCenter, deleteCurrency, deleteInstallment, deleteSubrange, exportBackup, importJournalEntries, isReady, postCommercialDocument, postPayrollRun, recordInventoryMovement, recordMonthlyDepreciation, restoreBackup, reverseJournalEntry, state, suggestAccountCode, summary, transferCashBankFunds, updateAccountNumbering, updateBankReconciliation, updateCurrency, updateInstallmentSchedule, updateInstallmentStatus, updateNumberLocale, updateReconciliationLine]);
  return <AccountingContext.Provider value={value}>{children}</AccountingContext.Provider>;
}

export function useAccounting() { const context = useContext(AccountingContext); if (!context) throw new Error("useAccounting must be used within AccountingProvider"); return context; }

export const categoryMeta: Record<AccountCategory, { label: string; description: string; icon: string; color: string; softColor: string }> = {
  asset: { label: "الأصول", description: "ما تملكه المنشأة", icon: "account-balance-wallet", color: "#168A63", softColor: "#E3F5EE" }, liability: { label: "الخصوم", description: "ما على المنشأة", icon: "credit-card", color: "#B97512", softColor: "#FFF4DD" }, equity: { label: "حقوق الملكية", description: "حقوق المالك", icon: "pie-chart", color: "#7357C8", softColor: "#EEE9FE" }, revenue: { label: "الإيرادات", description: "الدخل المحقق", icon: "trending-up", color: "#247AAE", softColor: "#E4F1F9" }, expense: { label: "المصروفات", description: "التكاليف المدفوعة", icon: "trending-down", color: "#C44747", softColor: "#FCEAEA" },
};
export const categories = Object.keys(categoryMeta) as AccountCategory[];
