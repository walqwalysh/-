import { normaliseDateOnly } from "./date-utils";

export type ImportedStatementLine = {
  date: string;
  description: string;
  amount: number;
  reference?: string;
};

export type BankStatementImportIssue = {
  rowNumber: number;
  message: string;
};

export type BankStatementImportPreview = {
  lines: ImportedStatementLine[];
  issues: BankStatementImportIssue[];
  ignoredEmptyRows: number;
  sourceRows: number;
  hasRequiredColumns: boolean;
};

export type BankStatementImportOptions = {
  periodStart?: string;
  periodEnd?: string;
};

type SpreadsheetRow = Record<string, unknown>;

const DATE_HEADERS = ["التاريخ", "تاريخ العملية", "تاريخ الحركة", "date", "transaction date", "posting date"];
const DESCRIPTION_HEADERS = ["البيان", "الوصف", "التفاصيل", "الوصف التفصيلي", "description", "narration", "particulars", "details"];
const AMOUNT_HEADERS = ["المبلغ", "القيمة", "الحركة", "amount", "transaction amount", "value"];
const DEBIT_HEADERS = ["مدين", "سحب", "مسحوبات", "debit", "withdrawal", "withdrawals"];
const CREDIT_HEADERS = ["دائن", "إيداع", "إيداعات", "credit", "deposit", "deposits"];
const REFERENCE_HEADERS = ["المرجع", "رقم المرجع", "رقم العملية", "رقم المعاملة", "reference", "reference number", "transaction id", "transaction reference"];

function normaliseHeader(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[ـ_\-–—/\\().:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || asText(value) === "";
}

function valueFor(row: SpreadsheetRow, headers: string[]): unknown {
  const byHeader = new Map(Object.entries(row).map(([key, value]) => [normaliseHeader(key), value]));
  for (const header of headers) {
    const value = byHeader.get(normaliseHeader(header));
    if (!isEmpty(value)) return value;
  }
  return undefined;
}

function hasColumn(rows: SpreadsheetRow[], headers: string[]): boolean {
  const aliases = new Set(headers.map(normaliseHeader));
  return rows.some((row) => Object.keys(row).some((key) => aliases.has(normaliseHeader(key))));
}

function replaceArabicDigits(value: string): string {
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const easternArabicIndic = "۰۱۲۳۴۵۶۷۸۹";
  return value.replace(/[٠-٩]/g, (digit) => String(arabicIndic.indexOf(digit))).replace(/[۰-۹]/g, (digit) => String(easternArabicIndic.indexOf(digit)));
}

/** يحوّل قيمة نقدية Excel إلى رقم، مع احترام الأقواس والسالب والفواصل العربية. */
export function parseStatementAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  const raw = replaceArabicDigits(asText(value));
  if (!raw) return null;
  const negativeByParentheses = /^\(.*\)$/.test(raw);
  let clean = raw.replace(/[()\s\u00A0]/g, "").replace(/[٬']/g, "").replace(/٫/g, ".").replace(/،/g, ",").replace(/[^0-9,.-]/g, "");
  if (!/[0-9]/.test(clean)) return null;
  const commaIndex = clean.lastIndexOf(",");
  const dotIndex = clean.lastIndexOf(".");
  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalIndex = Math.max(commaIndex, dotIndex);
    const decimalSeparator = clean[decimalIndex];
    clean = clean.replace(decimalSeparator === "," ? /\./g : /,/g, "").replace(decimalSeparator, ".");
  } else if (commaIndex >= 0) {
    clean = /,\d{1,2}$/.test(clean) ? clean.replace(",", ".") : clean.replace(/,/g, "");
  }
  const parsed = Number(clean);
  if (!Number.isFinite(parsed)) return null;
  return Number((negativeByParentheses ? -Math.abs(parsed) : parsed).toFixed(2));
}

/** يدعم تواريخ Excel الرقمية وYYYY-MM-DD وصيغ DD/MM/YYYY الشائعة في كشوف البنوك العربية. */
export function parseStatementDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const timestamp = Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000;
    const date = new Date(timestamp);
    return normaliseDateOnly(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`);
  }
  const raw = replaceArabicDigits(asText(value));
  const direct = normaliseDateOnly(raw);
  if (direct) return direct;
  const match = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return normaliseDateOnly(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
}

function rowIsEmpty(row: SpreadsheetRow): boolean {
  return Object.values(row).every(isEmpty);
}

function importedAmount(row: SpreadsheetRow): number | null {
  const amount = parseStatementAmount(valueFor(row, AMOUNT_HEADERS));
  if (amount !== null) return amount;
  const debit = parseStatementAmount(valueFor(row, DEBIT_HEADERS)) ?? 0;
  const credit = parseStatementAmount(valueFor(row, CREDIT_HEADERS)) ?? 0;
  return Number((credit - debit).toFixed(2));
}

/**
 * يفحص صفوف ورقة Excel قبل الحفظ. الإيداع/الدائن موجب والسحب/المدين سالب.
 * لا ينشئ هذا المحلل أي بيانات أو أرصدة، وتبقى خطوة الحفظ صريحة في الواجهة.
 */
export function previewBankStatementRows(rows: SpreadsheetRow[], options: BankStatementImportOptions = {}): BankStatementImportPreview {
  const hasDateColumn = hasColumn(rows, DATE_HEADERS);
  const hasDescriptionColumn = hasColumn(rows, DESCRIPTION_HEADERS);
  const hasAmountColumn = hasColumn(rows, AMOUNT_HEADERS) || hasColumn(rows, DEBIT_HEADERS) || hasColumn(rows, CREDIT_HEADERS);
  const hasRequiredColumns = hasDateColumn && hasDescriptionColumn && hasAmountColumn;
  const lines: ImportedStatementLine[] = [];
  const issues: BankStatementImportIssue[] = [];
  let ignoredEmptyRows = 0;

  if (!hasRequiredColumns) {
    const missing = [!hasDateColumn ? "التاريخ" : "", !hasDescriptionColumn ? "البيان أو الوصف" : "", !hasAmountColumn ? "المبلغ أو مدين/دائن" : ""].filter(Boolean).join("، ");
    return { lines, issues: [{ rowNumber: 1, message: `الأعمدة المطلوبة غير مكتملة: ${missing}.` }], ignoredEmptyRows, sourceRows: rows.length, hasRequiredColumns };
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (rowIsEmpty(row)) {
      ignoredEmptyRows += 1;
      return;
    }
    const date = parseStatementDate(valueFor(row, DATE_HEADERS));
    const description = asText(valueFor(row, DESCRIPTION_HEADERS));
    const amount = importedAmount(row);
    const outsidePeriod = Boolean(date && ((options.periodStart && date < options.periodStart) || (options.periodEnd && date > options.periodEnd)));
    if (!date) issues.push({ rowNumber, message: "تاريخ الحركة غير صالح." });
    if (outsidePeriod) issues.push({ rowNumber, message: "تاريخ الحركة يقع خارج فترة كشف المطابقة المختار." });
    if (!description) issues.push({ rowNumber, message: "البيان أو الوصف مطلوب." });
    if (amount === null || amount === 0) issues.push({ rowNumber, message: "المبلغ يجب أن يكون رقماً غير صفري." });
    if (!date || outsidePeriod || !description || amount === null || amount === 0) return;
    lines.push({ date, description, amount, reference: asText(valueFor(row, REFERENCE_HEADERS)) || undefined });
  });

  return { lines, issues, ignoredEmptyRows, sourceRows: rows.length, hasRequiredColumns };
}
