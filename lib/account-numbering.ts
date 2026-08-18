export type NumberingCategory = "asset" | "liability" | "equity" | "revenue" | "expense";
export type AccountNumberingRule = { prefix: string; start: number; padding: number };
export type AccountNumbering = Record<NumberingCategory, AccountNumberingRule>;
export type AccountSubrange = { id: string; name: string; category: NumberingCategory; prefix: string; start: number; end: number; createdAt: string };
export type NewAccountSubrange = Omit<AccountSubrange, "id" | "createdAt">;
export const numberingCategories: NumberingCategory[] = ["asset", "liability", "equity", "revenue", "expense"];

export const defaultAccountNumbering = (): AccountNumbering => ({ asset: { prefix: "", start: 100, padding: 3 }, liability: { prefix: "", start: 200, padding: 3 }, equity: { prefix: "", start: 300, padding: 3 }, revenue: { prefix: "", start: 400, padding: 3 }, expense: { prefix: "", start: 500, padding: 3 } });

function validPrefix(prefix: unknown) { return typeof prefix === "string" && /^[A-Za-z0-9._-]*$/.test(prefix.trim()); }
function normaliseRule(value: unknown, fallback: AccountNumberingRule): AccountNumberingRule { const rule = value && typeof value === "object" ? (value as Partial<AccountNumberingRule>) : {}; return { prefix: validPrefix(rule.prefix) ? String(rule.prefix).trim() : fallback.prefix, start: Number.isInteger(rule.start) && Number(rule.start) > 0 ? Number(rule.start) : fallback.start, padding: Number.isInteger(rule.padding) && Number(rule.padding) >= 1 && Number(rule.padding) <= 8 ? Number(rule.padding) : fallback.padding }; }
export function normaliseAccountNumbering(value: unknown): AccountNumbering { const defaults = defaultAccountNumbering(); const source = value && typeof value === "object" ? (value as Partial<AccountNumbering>) : {}; return numberingCategories.reduce<AccountNumbering>((rules, category) => { rules[category] = normaliseRule(source[category], defaults[category]); return rules; }, {} as AccountNumbering); }

export function normaliseSubranges(value: unknown): AccountSubrange[] {
  if (!Array.isArray(value)) return [];
  const candidates = value.map((item): AccountSubrange | null => {
    if (!item || typeof item !== "object") return null;
    const range = item as Partial<AccountSubrange>;
    if (typeof range.id !== "string" || !range.id || typeof range.name !== "string" || !range.name.trim() || !numberingCategories.includes(range.category as NumberingCategory) || !validPrefix(range.prefix)) return null;
    const start = Number(range.start); const end = Number(range.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) return null;
    return { id: range.id, name: range.name.trim(), category: range.category as NumberingCategory, prefix: String(range.prefix).trim(), start, end, createdAt: typeof range.createdAt === "string" ? range.createdAt : new Date().toISOString() };
  }).filter((range): range is AccountSubrange => Boolean(range)).sort((a, b) => a.category.localeCompare(b.category) || a.prefix.localeCompare(b.prefix) || a.start - b.start);
  return candidates.filter((range, index) => !candidates.slice(0, index).some((previous) => previous.category === range.category && previous.prefix === range.prefix && previous.start <= range.end && previous.end >= range.start));
}

function numericCode(code: string, prefix: string) { if (!code.startsWith(prefix)) return null; const suffix = code.slice(prefix.length); return /^\d+$/.test(suffix) ? Number(suffix) : null; }
export function isCodeInSubrange(code: string, range: Pick<AccountSubrange, "prefix" | "start" | "end">) { const number = numericCode(code.trim(), range.prefix); return number !== null && number >= range.start && number <= range.end; }
export function subrangeForCode(code: string, category: NumberingCategory, ranges: AccountSubrange[]) { return ranges.find((range) => range.category === category && isCodeInSubrange(code, range)); }

export function nextAccountCode(accounts: Array<{ code: string }>, category: NumberingCategory, numbering: AccountNumbering, ranges: AccountSubrange[] = [], subrangeId?: string) {
  const selected = subrangeId ? ranges.find((range) => range.id === subrangeId && range.category === category) : undefined;
  const rule = selected ?? numbering[category]; const used = new Set(accounts.map((account) => account.code.trim().toLocaleLowerCase()).filter(Boolean));
  const limit = selected ? selected.end : rule.start + 100000;
  for (let number = rule.start; number <= limit; number += 1) {
    const candidate = `${rule.prefix}${String(number).padStart(numbering[category].padding, "0")}`;
    const reservedForSubrange = !selected && ranges.some((range) => range.category === category && range.prefix === rule.prefix && number >= range.start && number <= range.end);
    if (!used.has(candidate.toLocaleLowerCase()) && !reservedForSubrange) return candidate;
  }
  throw new Error(selected ? "لا توجد أكواد متاحة داخل النطاق الفرعي المختار" : "لا توجد أكواد متاحة ضمن نطاق الترقيم العام");
}
