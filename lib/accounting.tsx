import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { calculateCategoryTotals, calculateFinancialPosition, calculateNetIncome } from "@/lib/accounting-calculations";

export type AccountCategory = "asset" | "liability" | "equity" | "revenue" | "expense";
export type Account = { id: string; name: string; category: AccountCategory; createdAt: string };
export type LedgerEntry = { id: string; accountId: string; category: AccountCategory; amount: number; note: string; date: string; createdAt: string };
export type AccountingState = { accounts: Account[]; entries: LedgerEntry[]; currency: string };
export type CategorySummary = Record<AccountCategory, number>;

const STORAGE_KEY = "smart-accountant:data:v1";
const emptyState: AccountingState = { accounts: [], entries: [], currency: "د.ل" };

type AccountingContextValue = {
  state: AccountingState;
  isReady: boolean;
  summary: CategorySummary;
  netIncome: number;
  financialPosition: number;
  addAccount: (name: string, category: AccountCategory) => Promise<Account>;
  addEntry: (input: Omit<LedgerEntry, "id" | "createdAt">) => Promise<void>;
  updateCurrency: (currency: string) => Promise<void>;
  clearAllData: () => Promise<void>;
};

const AccountingContext = createContext<AccountingContextValue | null>(null);
const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function normaliseLoadedData(raw: string | null): AccountingState {
  if (!raw) return emptyState;
  try {
    const parsed = JSON.parse(raw) as Partial<AccountingState>;
    return {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      currency: typeof parsed.currency === "string" && parsed.currency.trim() ? parsed.currency : "د.ل",
    };
  } catch {
    return emptyState;
  }
}

export function AccountingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountingState>(emptyState);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (mounted) setState(normaliseLoadedData(raw)); })
      .finally(() => { if (mounted) setIsReady(true); });
    return () => { mounted = false; };
  }, []);

  const commit = useCallback(async (next: AccountingState) => {
    setState(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addAccount = useCallback(async (name: string, category: AccountCategory) => {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("أدخل اسم الحساب أولاً");
    const existing = state.accounts.find((account) => account.category === category && account.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase());
    if (existing) return existing;
    const account: Account = { id: createId("account"), name: trimmedName, category, createdAt: new Date().toISOString() };
    await commit({ ...state, accounts: [...state.accounts, account] });
    return account;
  }, [commit, state]);

  const addEntry = useCallback(async (input: Omit<LedgerEntry, "id" | "createdAt">) => {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("أدخل مبلغاً أكبر من صفر");
    const entry: LedgerEntry = { ...input, amount: Number(input.amount.toFixed(2)), id: createId("entry"), createdAt: new Date().toISOString() };
    await commit({ ...state, entries: [entry, ...state.entries] });
  }, [commit, state]);

  const updateCurrency = useCallback(async (currency: string) => commit({ ...state, currency: currency.trim() || "د.ل" }), [commit, state]);
  const clearAllData = useCallback(async () => commit({ ...emptyState, currency: state.currency }), [commit, state.currency]);
  const summary = useMemo(() => calculateCategoryTotals(state.entries), [state.entries]);

  const value = useMemo<AccountingContextValue>(() => ({
    state, isReady, summary,
    netIncome: calculateNetIncome(summary),
    financialPosition: calculateFinancialPosition(summary),
    addAccount, addEntry, updateCurrency, clearAllData,
  }), [addAccount, addEntry, clearAllData, isReady, state, summary, updateCurrency]);

  return <AccountingContext.Provider value={value}>{children}</AccountingContext.Provider>;
}

export function useAccounting() {
  const context = useContext(AccountingContext);
  if (!context) throw new Error("useAccounting must be used within AccountingProvider");
  return context;
}

export const categoryMeta: Record<AccountCategory, { label: string; description: string; icon: string; color: string; softColor: string }> = {
  asset: { label: "الأصول", description: "ما تملكه المنشأة", icon: "account-balance-wallet", color: "#168A63", softColor: "#E3F5EE" },
  liability: { label: "الخصوم", description: "ما على المنشأة", icon: "credit-card", color: "#B97512", softColor: "#FFF4DD" },
  equity: { label: "حقوق الملكية", description: "حقوق المالك", icon: "pie-chart", color: "#7357C8", softColor: "#EEE9FE" },
  revenue: { label: "الإيرادات", description: "الدخل المحقق", icon: "trending-up", color: "#247AAE", softColor: "#E4F1F9" },
  expense: { label: "المصروفات", description: "التكاليف المدفوعة", icon: "trending-down", color: "#C44747", softColor: "#FCEAEA" },
};
export const categories = Object.keys(categoryMeta) as AccountCategory[];
export const formatAmount = (amount: number, currency: string) => `${new Intl.NumberFormat("ar-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0)} ${currency}`;
