import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { calculateAccountBalances, calculateBalanceSheet, calculateCategoryTotals, calculateNetIncome, validateJournalLines, type BalanceSheet, type CalculationLine } from "@/lib/accounting-calculations";
import { defaultAccountNumbering, nextAccountCode, normaliseAccountNumbering, type AccountNumbering } from "@/lib/account-numbering";

export type AccountCategory = "asset" | "liability" | "equity" | "revenue" | "expense";
export type AccountNature = "debit" | "credit";
export type Account = { id: string; code: string; name: string; category: AccountCategory; nature: AccountNature; scope: string; createdAt: string };
export type JournalLine = CalculationLine & { id: string };
export type JournalEntry = { id: string; description: string; date: string; createdAt: string; lines: JournalLine[] };
export type AccountingState = { accounts: Account[]; journalEntries: JournalEntry[]; currency: string; termsAccepted: boolean; numbering: AccountNumbering };
export type CategorySummary = Record<AccountCategory, number>;

const STORAGE_KEY = "smart-accountant:data:v2";
const LEGACY_STORAGE_KEY = "smart-accountant:data:v1";
const emptyState: AccountingState = { accounts: [], journalEntries: [], currency: "د.ل", termsAccepted: false, numbering: defaultAccountNumbering() };
const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const categoryIsValid = (value: unknown): value is AccountCategory => typeof value === "string" && value in categoryMeta;
export const accountNatureFor = (category: AccountCategory): AccountNature => (category === "asset" || category === "expense" ? "debit" : "credit");
export const accountNatureLabel = (nature: AccountNature) => (nature === "debit" ? "طبيعته مدينة" : "طبيعته دائنة");

type NewJournalLine = Omit<JournalLine, "id">;
type NewAccount = { name: string; code: string; category: AccountCategory; scope: string };
type ImportedJournal = { description: string; date: string; lines: Array<{ accountName: string; accountCode?: string; category: AccountCategory; debit: number; credit: number }> };
type AccountingContextValue = {
  state: AccountingState;
  isReady: boolean;
  summary: CategorySummary;
  accountBalances: Record<string, number>;
  netIncome: number;
  balanceSheet: BalanceSheet;
  addAccount: (input: NewAccount) => Promise<Account>;
  addJournalEntry: (input: { description: string; date: string; lines: NewJournalLine[] }) => Promise<void>;
  importJournalEntries: (journals: ImportedJournal[]) => Promise<{ imported: number; skipped: number }>;
  suggestAccountCode: (category: AccountCategory) => string;
  updateAccountNumbering: (numbering: AccountNumbering) => Promise<void>;
  updateCurrency: (currency: string) => Promise<void>;
  acceptTerms: () => Promise<void>;
  clearAllData: () => Promise<void>;
};

const AccountingContext = createContext<AccountingContextValue | null>(null);

function normaliseAccount(value: unknown): Account | null {
  if (!value || typeof value !== "object") return null;
  const account = value as Partial<Account>;
  if (!account.id || !account.name || !categoryIsValid(account.category)) return null;
  const nature = account.nature === "debit" || account.nature === "credit" ? account.nature : accountNatureFor(account.category);
  return { id: account.id, code: typeof account.code === "string" ? account.code.trim() : "", name: account.name.trim(), category: account.category, nature, scope: typeof account.scope === "string" && account.scope.trim() ? account.scope.trim() : "عام", createdAt: typeof account.createdAt === "string" ? account.createdAt : new Date().toISOString() };
}

function normaliseLoadedData(raw: string | null): AccountingState {
  if (!raw) return emptyState;
  try {
    const parsed = JSON.parse(raw) as Partial<AccountingState>;
    const accounts = Array.isArray(parsed.accounts) ? parsed.accounts.map(normaliseAccount).filter((account): account is Account => Boolean(account)) : [];
    const journalEntries = Array.isArray(parsed.journalEntries) ? parsed.journalEntries.filter((entry): entry is JournalEntry => Boolean(entry?.id && Array.isArray(entry.lines) && validateJournalLines(entry.lines).isBalanced)) : [];
    return { accounts, journalEntries, currency: typeof parsed.currency === "string" && parsed.currency.trim() ? parsed.currency : "د.ل", termsAccepted: parsed.termsAccepted === true, numbering: normaliseAccountNumbering(parsed.numbering) };
  } catch { return emptyState; }
}

export function AccountingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountingState>(emptyState);
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(LEGACY_STORAGE_KEY)]).then(([current, legacy]) => {
      if (!mounted) return;
      const loaded = normaliseLoadedData(current ?? legacy);
      setState(loaded);
      if (!current && legacy) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
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
    const existing = state.accounts.find((account) => account.category === input.category && account.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) return existing;
    const account: Account = { id: createId("account"), code, name, category: input.category, nature: accountNatureFor(input.category), scope, createdAt: new Date().toISOString() };
    await commit({ ...state, accounts: [...state.accounts, account] });
    return account;
  }, [commit, state]);
  const addJournalEntry = useCallback(async (input: { description: string; date: string; lines: NewJournalLine[] }) => {
    const knownAccounts = new Map(state.accounts.map((account) => [account.id, account]));
    const lines = input.lines.map((line) => ({ ...line, id: createId("line"), debit: Number(Number(line.debit).toFixed(2)), credit: Number(Number(line.credit).toFixed(2)) }));
    if (!input.description.trim()) throw new Error("أدخل وصف القيد");
    if (lines.some((line) => !knownAccounts.has(line.accountId) || knownAccounts.get(line.accountId)?.category !== line.category)) throw new Error("اختر حسابات صحيحة لكل طرف من القيد");
    if (new Set(lines.map((line) => line.accountId)).size < 2) throw new Error("اختر حسابين مختلفين للطرف المدين والدائن");
    const check = validateJournalLines(lines);
    if (!check.isBalanced) throw new Error(`القيد غير متوازن. الفرق الحالي: ${formatAmount(Math.abs(check.difference), state.currency)}`);
    const entry: JournalEntry = { id: createId("journal"), description: input.description.trim(), date: input.date, createdAt: new Date().toISOString(), lines };
    await commit({ ...state, journalEntries: [entry, ...state.journalEntries] });
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
    if (imported) await commit(next);
    return { imported, skipped };
  }, [commit, state]);
  const suggestAccountCode = useCallback((category: AccountCategory) => nextAccountCode(state.accounts, category, state.numbering), [state.accounts, state.numbering]);
  const updateAccountNumbering = useCallback(async (numbering: AccountNumbering) => commit({ ...state, numbering: normaliseAccountNumbering(numbering) }), [commit, state]);
  const updateCurrency = useCallback(async (currency: string) => commit({ ...state, currency: currency.trim() || "د.ل" }), [commit, state]);
  const acceptTerms = useCallback(async () => commit({ ...state, termsAccepted: true }), [commit, state]);
  const clearAllData = useCallback(async () => commit({ ...emptyState, currency: state.currency, termsAccepted: state.termsAccepted, numbering: state.numbering }), [commit, state.currency, state.numbering, state.termsAccepted]);
  const accountBalances = useMemo(() => calculateAccountBalances(state.accounts, state.journalEntries), [state.accounts, state.journalEntries]);
  const summary = useMemo(() => calculateCategoryTotals(state.accounts, accountBalances), [accountBalances, state.accounts]);
  const balanceSheet = useMemo(() => calculateBalanceSheet(summary), [summary]);
  const value = useMemo<AccountingContextValue>(() => ({ state, isReady, summary, accountBalances, netIncome: calculateNetIncome(summary), balanceSheet, addAccount, addJournalEntry, importJournalEntries, suggestAccountCode, updateAccountNumbering, updateCurrency, acceptTerms, clearAllData }), [acceptTerms, accountBalances, addAccount, addJournalEntry, balanceSheet, clearAllData, importJournalEntries, isReady, state, suggestAccountCode, summary, updateAccountNumbering, updateCurrency]);
  return <AccountingContext.Provider value={value}>{children}</AccountingContext.Provider>;
}

export function useAccounting() { const context = useContext(AccountingContext); if (!context) throw new Error("useAccounting must be used within AccountingProvider"); return context; }

export const categoryMeta: Record<AccountCategory, { label: string; description: string; icon: string; color: string; softColor: string }> = {
  asset: { label: "الأصول", description: "ما تملكه المنشأة", icon: "account-balance-wallet", color: "#168A63", softColor: "#E3F5EE" }, liability: { label: "الخصوم", description: "ما على المنشأة", icon: "credit-card", color: "#B97512", softColor: "#FFF4DD" }, equity: { label: "حقوق الملكية", description: "حقوق المالك", icon: "pie-chart", color: "#7357C8", softColor: "#EEE9FE" }, revenue: { label: "الإيرادات", description: "الدخل المحقق", icon: "trending-up", color: "#247AAE", softColor: "#E4F1F9" }, expense: { label: "المصروفات", description: "التكاليف المدفوعة", icon: "trending-down", color: "#C44747", softColor: "#FCEAEA" },
};
export const categories = Object.keys(categoryMeta) as AccountCategory[];
export const formatAmount = (amount: number, currency: string) => `${new Intl.NumberFormat("ar-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0)} ${currency}`;
