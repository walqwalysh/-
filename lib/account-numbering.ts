export type NumberingCategory = "asset" | "liability" | "equity" | "revenue" | "expense";

export type AccountNumberingRule = {
  prefix: string;
  start: number;
  padding: number;
};

export type AccountNumbering = Record<NumberingCategory, AccountNumberingRule>;

export const numberingCategories: NumberingCategory[] = ["asset", "liability", "equity", "revenue", "expense"];

export const defaultAccountNumbering = (): AccountNumbering => ({
  asset: { prefix: "", start: 100, padding: 3 },
  liability: { prefix: "", start: 200, padding: 3 },
  equity: { prefix: "", start: 300, padding: 3 },
  revenue: { prefix: "", start: 400, padding: 3 },
  expense: { prefix: "", start: 500, padding: 3 },
});

function normaliseRule(value: unknown, fallback: AccountNumberingRule): AccountNumberingRule {
  const rule = value && typeof value === "object" ? (value as Partial<AccountNumberingRule>) : {};
  const prefix = typeof rule.prefix === "string" && /^[A-Za-z0-9._-]*$/.test(rule.prefix.trim()) ? rule.prefix.trim() : fallback.prefix;
  const start = Number.isInteger(rule.start) && Number(rule.start) > 0 ? Number(rule.start) : fallback.start;
  const padding = Number.isInteger(rule.padding) && Number(rule.padding) >= 1 && Number(rule.padding) <= 8 ? Number(rule.padding) : fallback.padding;
  return { prefix, start, padding };
}

export function normaliseAccountNumbering(value: unknown): AccountNumbering {
  const defaults = defaultAccountNumbering();
  const source = value && typeof value === "object" ? (value as Partial<AccountNumbering>) : {};
  return numberingCategories.reduce<AccountNumbering>((rules, category) => {
    rules[category] = normaliseRule(source[category], defaults[category]);
    return rules;
  }, {} as AccountNumbering);
}

export function nextAccountCode(accounts: Array<{ code: string }>, category: NumberingCategory, numbering: AccountNumbering) {
  const rule = numbering[category];
  const usedCodes = new Set(accounts.map((account) => account.code.trim().toLocaleLowerCase()).filter(Boolean));
  for (let number = rule.start; number < rule.start + 100000; number += 1) {
    const candidate = `${rule.prefix}${String(number).padStart(rule.padding, "0")}`;
    if (!usedCodes.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${rule.prefix}${Date.now()}`;
}
