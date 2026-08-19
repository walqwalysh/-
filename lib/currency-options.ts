export type CurrencyOption = { code: string; name: string };

export function normaliseCurrencyCode(currency: string) {
  return currency.trim().toUpperCase();
}

export function currencyOptionsForBase(baseCurrency: string, currencies: CurrencyOption[]): CurrencyOption[] {
  const code = normaliseCurrencyCode(baseCurrency) || "د.ل";
  const matchingCurrency = currencies.find((currency) => currency.code === code);
  const options: CurrencyOption[] = [{ code, name: matchingCurrency?.name ?? "العملة الأساسية" }];
  for (const currency of currencies) if (currency.code !== code) options.push({ code: currency.code, name: currency.name });
  return options;
}
