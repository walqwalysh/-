export type NumberLocale = "arabic" | "english";

let activeNumberLocale: NumberLocale = "arabic";

export function setActiveNumberLocale(numberLocale: NumberLocale) {
  activeNumberLocale = numberLocale;
}

export const numberLocaleCode = (numberLocale: NumberLocale = activeNumberLocale) => numberLocale === "english" ? "en-US" : "ar-LY";

export const formatNumber = (value: number, options: Intl.NumberFormatOptions = {}, numberLocale: NumberLocale = activeNumberLocale) => new Intl.NumberFormat(numberLocaleCode(numberLocale), options).format(Number.isFinite(value) ? value : 0);

export const formatAmount = (amount: number, currency: string, numberLocale: NumberLocale = activeNumberLocale) => `${formatNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, numberLocale)} ${currency}`;
