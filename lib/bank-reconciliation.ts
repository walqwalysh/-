import { formatAccountingDate as formatDate, normaliseDateOnly } from "./date-utils";

export type BankStatementLineStatus = "unmatched" | "matched" | "excluded";

export interface BankStatementLine {
  id: string;
  date: string;
  description: string;
  /** موجب للإيداع وسالب للسحب. */
  amount: number;
  reference?: string;
  matchedEntryId?: string;
  status: BankStatementLineStatus;
}

export interface BankReconciliation {
  id: string;
  bankAccountId: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  lines: BankStatementLine[];
  createdAt: string;
  updatedAt: string;
}

export type BankReconciliationJournalEntry = {
  id: string;
  date: string;
  description: string;
  documentReference?: string;
  lines: Array<{ accountId: string; debit: number; credit: number }>;
};

export type ReconciliationSummary = {
  matchedCount: number;
  unmatchedCount: number;
  excludedCount: number;
  matchedAmount: number;
  unmatchedAmount: number;
  excludedAmount: number;
  deposits: number;
  withdrawals: number;
  statementMovement: number;
  expectedClosingBalance: number;
  closingDifference: number;
  ledgerPeriodMovement: number;
  ledgerDifference: number;
};

export type NewBankStatementLine = Pick<BankStatementLine, "date" | "description" | "amount" | "reference">;

const amountPrecision = (value: number) => Number(value.toFixed(2));
const EPSILON = 0.005;

const tokenise = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);

function textMatchScore(line: BankStatementLine, entry: BankReconciliationJournalEntry): number {
  const reference = line.reference?.trim().toLocaleLowerCase();
  const documentReference = entry.documentReference?.trim().toLocaleLowerCase();
  if (reference && documentReference && (reference === documentReference || documentReference.includes(reference) || reference.includes(documentReference))) return 8;

  const lineTokens = new Set(tokenise(line.description));
  const entryTokens = tokenise(`${entry.description} ${entry.documentReference ?? ""}`);
  return entryTokens.reduce((score, token) => score + (lineTokens.has(token) ? 1 : 0), 0);
}

function dateDistanceInDays(first: string, second: string): number {
  const firstDate = normaliseDateOnly(first);
  const secondDate = normaliseDateOnly(second);
  if (!firstDate || !secondDate) return Number.POSITIVE_INFINITY;
  const start = Date.parse(`${firstDate}T00:00:00Z`);
  const end = Date.parse(`${secondDate}T00:00:00Z`);
  return Math.abs(start - end) / 86_400_000;
}

function movementForEntry(entry: BankReconciliationJournalEntry, bankLedgerAccountId?: string): number {
  const selectedLines = bankLedgerAccountId
    ? entry.lines.filter((line) => line.accountId === bankLedgerAccountId)
    : entry.lines;
  return amountPrecision(selectedLines.reduce((total, line) => total + Number(line.debit) - Number(line.credit), 0));
}

/**
 * يقترح القيد الأقرب لسطـر كشف البنك. لا ينشئ هذا الاقتراح أي قيد جديد ولا يغيّر حالة السطر.
 * عند تمرير حساب دفتر الأستاذ البنكي، يقصر المقارنة على حركة ذلك الحساب تحديداً.
 */
export function matchLineToEntry(
  line: BankStatementLine,
  entries: BankReconciliationJournalEntry[],
  bankLedgerAccountId?: string,
  unavailableEntryIds: Iterable<string> = [],
): string | null {
  const usedEntries = new Set(unavailableEntryIds);
  const date = normaliseDateOnly(line.date);
  if (!date || !Number.isFinite(line.amount) || Math.abs(line.amount) < EPSILON) return null;

  const candidates = entries
    .filter((entry) => !usedEntries.has(entry.id))
    .map((entry) => {
      const movement = movementForEntry(entry, bankLedgerAccountId);
      const amountMatches = Math.abs(movement - line.amount) < EPSILON;
      const days = dateDistanceInDays(date, entry.date);
      if (!amountMatches || days > 7) return null;
      const referenceAndTextScore = textMatchScore(line, entry);
      const score = referenceAndTextScore * 100 - days;
      return { entry, score, days, referenceAndTextScore };
    })
    .filter((candidate): candidate is { entry: BankReconciliationJournalEntry; score: number; days: number; referenceAndTextScore: number } => Boolean(candidate))
    .sort((first, second) => second.score - first.score || first.days - second.days || first.entry.id.localeCompare(second.entry.id));

  const suggested = candidates[0];
  if (!suggested) return null;
  // التاريخ المتطابق كافٍ إذا اتفق المبلغ، أما الاختلاف الزمني فيحتاج مرجعاً أو كلمة مشتركة.
  if (suggested.days === 0 || suggested.referenceAndTextScore > 0) return suggested.entry.id;
  return null;
}

export function calculateReconciliationSummary(
  reconciliation: BankReconciliation,
  entries: BankReconciliationJournalEntry[],
  bankLedgerAccountId?: string,
): ReconciliationSummary {
  const lines = reconciliation.lines;
  const includedLines = lines.filter((line) => line.status !== "excluded");
  const matchedLines = lines.filter((line) => line.status === "matched");
  const unmatchedLines = lines.filter((line) => line.status === "unmatched");
  const excludedLines = lines.filter((line) => line.status === "excluded");
  const statementMovement = amountPrecision(includedLines.reduce((total, line) => total + line.amount, 0));
  const expectedClosingBalance = amountPrecision(reconciliation.openingBalance + statementMovement);
  const ledgerPeriodMovement = amountPrecision(
    entries
      .filter((entry) => entry.date >= reconciliation.periodStart && entry.date <= reconciliation.periodEnd)
      .reduce((total, entry) => total + movementForEntry(entry, bankLedgerAccountId), 0),
  );

  return {
    matchedCount: matchedLines.length,
    unmatchedCount: unmatchedLines.length,
    excludedCount: excludedLines.length,
    matchedAmount: amountPrecision(matchedLines.reduce((total, line) => total + line.amount, 0)),
    unmatchedAmount: amountPrecision(unmatchedLines.reduce((total, line) => total + line.amount, 0)),
    excludedAmount: amountPrecision(excludedLines.reduce((total, line) => total + line.amount, 0)),
    deposits: amountPrecision(includedLines.filter((line) => line.amount > 0).reduce((total, line) => total + line.amount, 0)),
    withdrawals: amountPrecision(Math.abs(includedLines.filter((line) => line.amount < 0).reduce((total, line) => total + line.amount, 0))),
    statementMovement,
    expectedClosingBalance,
    closingDifference: amountPrecision(reconciliation.closingBalance - expectedClosingBalance),
    ledgerPeriodMovement,
    ledgerDifference: amountPrecision(statementMovement - ledgerPeriodMovement),
  };
}

export function normaliseBankStatementLine(value: unknown, journalIds: Set<string>): BankStatementLine | null {
  if (!value || typeof value !== "object") return null;
  const line = value as Partial<BankStatementLine>;
  const date = normaliseDateOnly(line.date);
  const amount = Number(line.amount);
  const status: BankStatementLineStatus = line.status === "matched" || line.status === "excluded" ? line.status : "unmatched";
  const matchedEntryId = typeof line.matchedEntryId === "string" && journalIds.has(line.matchedEntryId) ? line.matchedEntryId : undefined;
  if (!line.id || !date || typeof line.description !== "string" || !line.description.trim() || !Number.isFinite(amount) || Math.abs(amount) < EPSILON) return null;
  if (status === "matched" && !matchedEntryId) return null;
  return {
    id: line.id,
    date,
    description: line.description.trim(),
    amount: amountPrecision(amount),
    reference: typeof line.reference === "string" && line.reference.trim() ? line.reference.trim() : undefined,
    matchedEntryId: status === "matched" ? matchedEntryId : undefined,
    status,
  };
}

export function normaliseBankReconciliation(value: unknown, bankAccountIds: Set<string>, journalIds: Set<string>): BankReconciliation | null {
  if (!value || typeof value !== "object") return null;
  const reconciliation = value as Partial<BankReconciliation>;
  const periodStart = normaliseDateOnly(reconciliation.periodStart);
  const periodEnd = normaliseDateOnly(reconciliation.periodEnd);
  const openingBalance = Number(reconciliation.openingBalance);
  const closingBalance = Number(reconciliation.closingBalance);
  if (!reconciliation.id || !reconciliation.bankAccountId || !bankAccountIds.has(reconciliation.bankAccountId) || !periodStart || !periodEnd || periodEnd < periodStart || !Number.isFinite(openingBalance) || !Number.isFinite(closingBalance)) return null;
  const lines = Array.isArray(reconciliation.lines)
    ? reconciliation.lines.map((line) => normaliseBankStatementLine(line, journalIds)).filter((line): line is BankStatementLine => Boolean(line))
    : [];
  return {
    id: reconciliation.id,
    bankAccountId: reconciliation.bankAccountId,
    periodStart,
    periodEnd,
    openingBalance: amountPrecision(openingBalance),
    closingBalance: amountPrecision(closingBalance),
    lines,
    createdAt: typeof reconciliation.createdAt === "string" ? reconciliation.createdAt : new Date().toISOString(),
    updatedAt: typeof reconciliation.updatedAt === "string" ? reconciliation.updatedAt : new Date().toISOString(),
  };
}

export const formatAccountingDate = formatDate;
