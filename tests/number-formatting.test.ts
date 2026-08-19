import { describe, expect, it } from "vitest";

import { formatNumber } from "../lib/number-formatting";

describe("تنسيق الأرقام", () => {
  it("يعرض المبالغ برموز إنجليزية عند اختيار الإنجليزية", () => {
    expect(formatNumber(123456.7, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, "english")).toBe("123,456.70");
  });

  it("يحتفظ بالصيغة العربية عند اختيار العربية", () => {
    expect(formatNumber(123456.7, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, "arabic")).not.toBe("123,456.70");
  });
});
