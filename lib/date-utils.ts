/** يحول التاريخ الكامل أو تاريخ اليوم إلى صيغة YYYY-MM-DD المحلية للمستندات المحاسبية. */
export function normaliseDateOnly(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  return `${yearText}-${monthText}-${dayText}`;
}

/** يعرض تاريخ الإدخال المحاسبي بصيغة عربية واضحة مع تجنب تحوّل المنطقة الزمنية. */
export function formatAccountingDate(value: unknown, locale = "ar-LY"): string {
  const dateOnly = normaliseDateOnly(value);
  if (!dateOnly) return "—";
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    calendar: "gregory",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
