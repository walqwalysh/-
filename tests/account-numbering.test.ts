import { describe, expect, it } from "vitest";
import { defaultAccountNumbering, nextAccountCode, normaliseAccountNumbering } from "../lib/account-numbering";

describe("ترقيم دليل الحسابات", () => {
  it("يقترح أول كود من نطاق الفئة عندما لا توجد حسابات", () => {
    const numbering = defaultAccountNumbering();
    expect(nextAccountCode([], "asset", numbering)).toBe("100");
    expect(nextAccountCode([], "revenue", numbering)).toBe("400");
  });

  it("يتخطى الأكواد المستخدمة ويستمر في نطاق الفئة", () => {
    const numbering = defaultAccountNumbering();
    expect(nextAccountCode([{ code: "100" }, { code: "101" }, { code: "200" }], "asset", numbering)).toBe("102");
  });

  it("يحترم البادئة والرقم الأول وعدد الخانات المخصصة", () => {
    const numbering = normaliseAccountNumbering({ asset: { prefix: "AST-", start: 7, padding: 4 } });
    expect(nextAccountCode([], "asset", numbering)).toBe("AST-0007");
    expect(nextAccountCode([{ code: "AST-0007" }], "asset", numbering)).toBe("AST-0008");
  });
});
