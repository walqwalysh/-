import { describe, expect, it } from "vitest";

import { currencyOptionsForBase, normaliseCurrencyCode } from "../lib/currency-options";

describe("العملة الأساسية", () => {
  const currencies = [
    { id: "usd", code: "USD", name: "دولار أمريكي", createdAt: "2026-08-19T00:00:00.000Z" },
    { id: "eur", code: "EUR", name: "يورو", createdAt: "2026-08-19T00:00:00.000Z" },
  ];

  it("يطبع رمز العملة الأساسية ويحافظ على العملة السابقة كخيار مستند", () => {
    expect(normaliseCurrencyCode(" usd ")).toBe("USD");
    expect(currencyOptionsForBase("USD", currencies)).toEqual([
      { code: "USD", name: "دولار أمريكي" },
      { code: "EUR", name: "يورو" },
    ]);
  });

  it("يعرض العملة الأساسية الجديدة أولاً من دون تكرارها أو تغيير قائمة العملات المخصصة", () => {
    expect(currencyOptionsForBase("EUR", currencies)).toEqual([
      { code: "EUR", name: "يورو" },
      { code: "USD", name: "دولار أمريكي" },
    ]);
  });
});
