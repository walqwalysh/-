import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { calculateAccountBalances, calculateBalanceSheet, calculateCategoryTotals, calculateNetIncome, validateJournalLines, type BalanceSheet, type CalculationLine } from "@/lib/accounting-calculations";
import { defaultAccountNumbering, isCodeInSubrange, nextAccountCode, normaliseAccountNumbering, normaliseSubranges, subrangeForCode, type AccountNumbering, type AccountSubrange, type NewAccountSubrange } from "@/lib/account-numbering";

export type AccountCategory = "asset" | "liability" | "equity" | "revenue" | "expense";
export type AccountNature = "debit" | "credit";
export type Account = { id: string; code: string; name: string; category: AccountCategory; nature: AccountNature; scope: string; subrangeId?: string; createdAt: string };
export type JournalLine = CalculationLine & { id: string };
export type VoucherType = "receipt" | "payment";
export type PaymentMethod = "cash" | "cheque" | "bank_transfer" | "other";
export type JournalEntrySource =
  | { type: "installment"; installmentId: string; periodKey: string; externalEntryId: string }
  | { type: "voucher"; voucherId: string; voucherType: VoucherType }
  | { type: "reversal"; originalEntryId: string };
export type JournalEntry = { id: string; description: string; date: string; createdAt: string; lines: JournalLine[]; source?: JournalEntrySource; currency?: string; fxRate?: number; documentReference?: string; costCenterId?: string; reversalOfEntryId?: string };
export type CostCenter = { id: string; name: string; notes?: string; createdAt: string };
export type Voucher = { id: string; voucherNumber: string; type: VoucherType; paymentMethod: PaymentMethod; partyName: string; amount: number; date: string; description: string; cashAccountId: string; counterpartAccountId: string; journalEntryId: string; createdAt: string };
export type AuditAction = "account_created" | "journal_posted" | "journal_reversed" | "journal_imported" | "contact_created" | "contact_deleted" | "item_created" | "installment_created" | "voucher_created" | "cost_center_created" | "cost_center_deleted";
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

export type AccountingState = {
  accounts: Account[];
  journalEntries: JournalEntry[];
  contacts: Contact[];
  accountingItems: AccountingItem[];
  installments: Installment[];
  costCenters: CostCenter[];
  vouchers: Voucher[];
  auditLog: AuditLog[];
  currency: string;
  termsAccepted: boolean;
  numbering: AccountNumbering;
  subranges: AccountSubrange[];
};
export type CategorySummary = Record<AccountCategory, number>;

const STORAGE_KEY = "smart-accountant:data:v4";
const PREVIOUS_STORAGE_KEY = "smart-accountant:data:v3";
const LEGACY_STORAGE_KEY = "smart-accountant:data:v2";
const OLDEST_STORAGE_KEY = "smart-accountant:data:v1";
const emptyState: AccountingState = { accounts: [], journalEntries: [], contacts: [], accountingItems: [], installments: [], costCenters: [], vouchers: [], auditLog: [], currency: "د.ل", termsAccepted: false, numbering: defaultAccountNumbering(), subranges: [] };
const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const categoryIsValid = (value: unknown): value is AccountCategory => typeof value === "string" && value in categoryMeta;
const contactTypeIsValid = (value: unknown): value is ContactType => value === "customer" || value === "supplier" || value === "debtor" || value === "creditor";
const installmentStatusIsValid = (value: unknown): value is InstallmentStatus => value === "active" || value === "paused" || value === "completed";
const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());

export const accountNatureFor = (category: AccountCategory): AccountNature => (category === "asset" || category === "expense" ? "debit" : "credit");
export const accountNatureLabel = (nature: AccountNature) => (nature === "debit" ? "طبيعته مدينة" : "طبيعته دائنة");

type NewJournalLine = Omit<JournalLine, "id">;
type NewAccount = { name: string; code: string; category: AccountCategory; scope: string; subrangeId?: string };
export type NewContact = { name: string; phone: string; type: ContactType; accountCode?: string; notes?: string };
export type NewAccountingItem = { name: string; category: AccountCategory; accountCode?: string; defaultAmount?: number; notes?: string };
export type NewInstallment = { contactId: string; title?: string; totalAmount: number; installmentAmount: number; startDate: string; endDate: string; debitAccountCode: string; creditAccountCode: string };
export type NewCostCenter = { name: string; notes?: string };
export type NewVoucher = { type: VoucherType; paymentMethod: PaymentMethod; partyName: string; amount: number; date: string; description: string; cashAccountId: string; counterpartAccountId: string; currency?: string; fxRate?: number; costCenterId?: string };
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
  reverseJournalEntry: (id: string, date?: string) => Promise<void>;
  suggestAccountCode: (category: AccountCategory, subrangeId?: string) => string;
  updateAccountNumbering: (numbering: AccountNumbering) => Promise<void>;
  addSubrange: (input: NewAccountSubrange) => Promise<void>;
  deleteSubrange: (id: string) => Promise<void>;
  updateCurrency: (currency: string) => Promise<void>;
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
  if (source.type === "reversal" && typeof source.originalEntryId === "string") return { type: "reversal", originalEntryId: source.originalEntryId };
  return undefined;
}

function normaliseJournalEntry(value: unknown): JournalEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<JournalEntry>;
  if (!entry.id || typeof entry.description !== "string" || !entry.description.trim() || typeof entry.date !== "string" || !isDateOnly(entry.date) || !Array.isArray(entry.lines) || !validateJournalLines(entry.lines).isBalanced) return null;
  const fxRate = Number(entry.fxRate);
  return { id: entry.id, description: entry.description.trim(), date: entry.date, createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(), lines: entry.lines as JournalLine[], source: normaliseJournalEntrySource(entry.source), currency: typeof entry.currency === "string" && entry.currency.trim() ? entry.currency.trim() : undefined, fxRate: Number.isFinite(fxRate) && fxRate > 0 ? fxRate : undefined, documentReference: typeof entry.documentReference === "string" && entry.documentReference.trim() ? entry.documentReference.trim() : undefined, costCenterId: typeof entry.costCenterId === "string" && entry.costCenterId.trim() ? entry.costCenterId : undefined, reversalOfEntryId: typeof entry.reversalOfEntryId === "string" && entry.reversalOfEntryId.trim() ? entry.reversalOfEntryId : undefined };
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
  if (!voucher.id || typeof voucher.voucherNumber !== "string" || (voucher.type !== "receipt" && voucher.type !== "payment") || !voucher.partyName?.trim() || !Number.isFinite(amount) || amount <= 0 || !voucher.date || !isDateOnly(voucher.date) || !voucher.description?.trim() || !voucher.cashAccountId || !voucher.counterpartAccountId || !voucher.journalEntryId) return null;
  return { id: voucher.id, voucherNumber: voucher.voucherNumber, type: voucher.type, paymentMethod: voucher.paymentMethod === "cash" || voucher.paymentMethod === "cheque" || voucher.paymentMethod === "bank_transfer" || voucher.paymentMethod === "other" ? voucher.paymentMethod : "cash", partyName: voucher.partyName.trim(), amount: Number(amount.toFixed(2)), date: voucher.date, description: voucher.description.trim(), cashAccountId: voucher.cashAccountId, counterpartAccountId: voucher.counterpartAccountId, journalEntryId: voucher.journalEntryId, createdAt: typeof voucher.createdAt === "string" ? voucher.createdAt : new Date().toISOString() };
}

function normaliseAuditLog(value: unknown): AuditLog | null {
  if (!value || typeof value !== "object") return null;
  const audit = value as Partial<AuditLog>;
  const actions: AuditAction[] = ["account_created", "journal_posted", "journal_reversed", "journal_imported", "contact_created", "contact_deleted", "item_created", "installment_created", "voucher_created", "cost_center_created", "cost_center_deleted"];
  if (!audit.id || !actions.includes(audit.action as AuditAction) || typeof audit.description !== "string" || !audit.description.trim()) return null;
  return { id: audit.id, action: audit.action as AuditAction, description: audit.description.trim(), entityId: typeof audit.entityId === "string" ? audit.entityId : undefined, createdAt: typeof audit.createdAt === "string" ? audit.createdAt : new Date().toISOString() };
}

const newAuditLog = (action: AuditAction, description: string, entityId?: string): AuditLog => ({ id: createId("audit"), action, description, entityId, createdAt: new Date().toISOString() });

function normaliseLoadedData(raw: string | null): AccountingState {
  if (!raw) return emptyState;
  try {
    const parsed = JSON.parse(raw) as Partial<AccountingState>;
    const accounts = Array.isArray(parsed.accounts) ? parsed.accounts.map(normaliseAccount).filter((account): account is Account => Boolean(account)) : [];
    const journalEntries = Array.isArray(parsed.journalEntries) ? parsed.journalEntries.map(normaliseJournalEntry).filter((entry): entry is JournalEntry => Boolean(entry)) : [];
    const contacts = Array.isArray(parsed.contacts) ? parsed.contacts.map(normaliseContact).filter((contact): contact is Contact => Boolean(contact)) : [];
    const accountingItems = Array.isArray(parsed.accountingItems) ? parsed.accountingItems.map(normaliseAccountingItem).filter((item): item is AccountingItem => Boolean(item)) : [];
    const validContactIds = new Set(contacts.map((contact) => contact.id));
    const installments = Array.isArray(parsed.installments) ? parsed.installments.map(normaliseInstallment).filter((installment): installment is Installment => Boolean(installment && validContactIds.has(installment.contactId))) : [];
    const costCenters = Array.isArray(parsed.costCenters) ? parsed.costCenters.map(normaliseCostCenter).filter((center): center is CostCenter => Boolean(center)) : [];
    const vouchers = Array.isArray(parsed.vouchers) ? parsed.vouchers.map(normaliseVoucher).filter((voucher): voucher is Voucher => Boolean(voucher && journalEntries.some((entry) => entry.id === voucher.journalEntryId))) : [];
    const auditLog = Array.isArray(parsed.auditLog) ? parsed.auditLog.map(normaliseAuditLog).filter((audit): audit is AuditLog => Boolean(audit)) : [];
    const subranges = normaliseSubranges(parsed.subranges);
    return { accounts, journalEntries, contacts, accountingItems, installments, costCenters, vouchers, auditLog, currency: typeof parsed.currency === "string" && parsed.currency.trim() ? parsed.currency : "د.ل", termsAccepted: parsed.termsAccepted === true, numbering: normaliseAccountNumbering(parsed.numbering), subranges };
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
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(PREVIOUS_STORAGE_KEY), AsyncStorage.getItem(LEGACY_STORAGE_KEY), AsyncStorage.getItem(OLDEST_STORAGE_KEY)]).then(([current, previous, legacy, oldest]) => {
      if (!mounted) return;
      const loaded = normaliseLoadedData(current ?? previous ?? legacy ?? oldest);
      setState(loaded);
      if (!current && (previous || legacy || oldest)) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
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
    if (!input.description.trim()) throw new Error("أدخل وصف القيد");
    const installmentSource = input.source?.type === "installment" ? input.source : undefined;
    if (installmentSource && state.journalEntries.some((entry) => {
      const entrySource = entry.source;
      return entrySource?.type === "installment" && entrySource.installmentId === installmentSource.installmentId && entrySource.periodKey === installmentSource.periodKey;
    })) return;
    if (lines.some((line) => !knownAccounts.has(line.accountId) || knownAccounts.get(line.accountId)?.category !== line.category)) throw new Error("اختر حسابات صحيحة لكل طرف من القيد");
    if (new Set(lines.map((line) => line.accountId)).size < 2) throw new Error("اختر حسابين مختلفين للطرف المدين والدائن");
    if (!isDateOnly(input.date)) throw new Error("أدخل تاريخ قيد صحيحاً.");
    if (input.costCenterId && !state.costCenters.some((center) => center.id === input.costCenterId)) throw new Error("مركز التكلفة المختار غير موجود.");
    const fxRate = input.fxRate === undefined ? 1 : Number(input.fxRate);
    if (!Number.isFinite(fxRate) || fxRate <= 0) throw new Error("أدخل سعر صرف صحيحاً أكبر من صفر.");
    const check = validateJournalLines(lines);
    if (!check.isBalanced) throw new Error(`القيد غير متوازن. الفرق الحالي: ${formatAmount(Math.abs(check.difference), state.currency)}`);
    const entry: JournalEntry = { id: createId("journal"), description: input.description.trim(), date: input.date, createdAt: new Date().toISOString(), lines, source: input.source, currency: input.currency?.trim() || state.currency, fxRate, documentReference: input.documentReference?.trim() || undefined, costCenterId: input.costCenterId };
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
      next.journalEntries.unshift({ id: createId("journal"), description: journal.description.trim(), date: journal.date || new Date().toISOString(), createdAt: new Date().toISOString(), lines: mappedLines }); imported += 1;
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
    if (!partyName || !description || !isDateOnly(input.date) || !Number.isFinite(amount) || amount <= 0) throw new Error("أكمل بيانات السند ومبلغه وتاريخه بشكل صحيح.");
    const cashAccount = state.accounts.find((account) => account.id === input.cashAccountId);
    const counterpartAccount = state.accounts.find((account) => account.id === input.counterpartAccountId);
    if (!cashAccount || !counterpartAccount || cashAccount.id === counterpartAccount.id) throw new Error("اختر حسابي سند مختلفين وصحيحين.");
    if (input.costCenterId && !state.costCenters.some((center) => center.id === input.costCenterId)) throw new Error("مركز التكلفة المختار غير موجود.");
    const fxRate = input.fxRate === undefined ? 1 : Number(input.fxRate);
    if (!Number.isFinite(fxRate) || fxRate <= 0) throw new Error("أدخل سعر صرف صحيحاً أكبر من صفر.");
    const voucher: Voucher = { id: createId("voucher"), voucherNumber: `${input.type === "receipt" ? "RC" : "PV"}-${new Date().getFullYear()}-${String(state.vouchers.length + 1).padStart(4, "0")}`, type: input.type, paymentMethod: input.paymentMethod, partyName, amount: Number(amount.toFixed(2)), date: input.date, description, cashAccountId: cashAccount.id, counterpartAccountId: counterpartAccount.id, journalEntryId: "", createdAt: new Date().toISOString() };
    const lines: JournalLine[] = input.type === "receipt"
      ? [{ id: createId("line"), accountId: cashAccount.id, category: cashAccount.category, debit: voucher.amount, credit: 0 }, { id: createId("line"), accountId: counterpartAccount.id, category: counterpartAccount.category, debit: 0, credit: voucher.amount }]
      : [{ id: createId("line"), accountId: counterpartAccount.id, category: counterpartAccount.category, debit: voucher.amount, credit: 0 }, { id: createId("line"), accountId: cashAccount.id, category: cashAccount.category, debit: 0, credit: voucher.amount }];
    const journalEntry: JournalEntry = { id: createId("journal"), description, date: input.date, createdAt: new Date().toISOString(), lines, source: { type: "voucher", voucherId: voucher.id, voucherType: voucher.type }, currency: input.currency?.trim() || state.currency, fxRate, documentReference: voucher.voucherNumber, costCenterId: input.costCenterId };
    voucher.journalEntryId = journalEntry.id;
    await commit({ ...state, vouchers: [voucher, ...state.vouchers], journalEntries: [journalEntry, ...state.journalEntries], auditLog: [newAuditLog("voucher_created", `إصدار ${voucher.type === "receipt" ? "سند قبض" : "سند صرف"} ${voucher.voucherNumber}`, voucher.id), ...state.auditLog] });
    return voucher;
  }, [commit, state]);

  const reverseJournalEntry = useCallback(async (id: string, date?: string) => {
    const entry = state.journalEntries.find((candidate) => candidate.id === id);
    const reversalDate = date ?? new Date().toISOString().slice(0, 10);
    if (!entry) throw new Error("القيد غير موجود.");
    if (entry.source?.type === "installment") throw new Error("لا يمكن عكس قيد قسط من التطبيق. عالجه من سجل القسط للحفاظ على التزامن.");
    if (!isDateOnly(reversalDate)) throw new Error("أدخل تاريخاً صحيحاً للقيد العكسي.");
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
  const updateCurrency = useCallback(async (currency: string) => commit({ ...state, currency: currency.trim() || "د.ل" }), [commit, state]);
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
  const clearAllData = useCallback(async () => commit({ ...emptyState, currency: state.currency, termsAccepted: state.termsAccepted, numbering: state.numbering, subranges: state.subranges }), [commit, state.currency, state.numbering, state.subranges, state.termsAccepted]);
  const accountBalances = useMemo(() => calculateAccountBalances(state.accounts, state.journalEntries), [state.accounts, state.journalEntries]);
  const summary = useMemo(() => calculateCategoryTotals(state.accounts, accountBalances), [accountBalances, state.accounts]);
  const balanceSheet = useMemo(() => calculateBalanceSheet(summary), [summary]);
  const value = useMemo<AccountingContextValue>(() => ({ state, isReady, summary, accountBalances, netIncome: calculateNetIncome(summary), balanceSheet, addAccount, addJournalEntry, importJournalEntries, addContact, deleteContact, addAccountingItem, deleteAccountingItem, addInstallment, updateInstallmentStatus, updateInstallmentSchedule, deleteInstallment, addCostCenter, deleteCostCenter, createVoucher, reverseJournalEntry, suggestAccountCode, updateAccountNumbering, addSubrange, deleteSubrange, updateCurrency, acceptTerms, exportBackup, restoreBackup, clearAllData }), [acceptTerms, accountBalances, addAccount, addAccountingItem, addContact, addCostCenter, addInstallment, addJournalEntry, addSubrange, balanceSheet, clearAllData, createVoucher, deleteAccountingItem, deleteContact, deleteCostCenter, deleteInstallment, deleteSubrange, exportBackup, importJournalEntries, isReady, restoreBackup, reverseJournalEntry, state, suggestAccountCode, summary, updateAccountNumbering, updateCurrency, updateInstallmentSchedule, updateInstallmentStatus]);
  return <AccountingContext.Provider value={value}>{children}</AccountingContext.Provider>;
}

export function useAccounting() { const context = useContext(AccountingContext); if (!context) throw new Error("useAccounting must be used within AccountingProvider"); return context; }

export const categoryMeta: Record<AccountCategory, { label: string; description: string; icon: string; color: string; softColor: string }> = {
  asset: { label: "الأصول", description: "ما تملكه المنشأة", icon: "account-balance-wallet", color: "#168A63", softColor: "#E3F5EE" }, liability: { label: "الخصوم", description: "ما على المنشأة", icon: "credit-card", color: "#B97512", softColor: "#FFF4DD" }, equity: { label: "حقوق الملكية", description: "حقوق المالك", icon: "pie-chart", color: "#7357C8", softColor: "#EEE9FE" }, revenue: { label: "الإيرادات", description: "الدخل المحقق", icon: "trending-up", color: "#247AAE", softColor: "#E4F1F9" }, expense: { label: "المصروفات", description: "التكاليف المدفوعة", icon: "trending-down", color: "#C44747", softColor: "#FCEAEA" },
};
export const categories = Object.keys(categoryMeta) as AccountCategory[];
export const formatAmount = (amount: number, currency: string) => `${new Intl.NumberFormat("ar-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0)} ${currency}`;
