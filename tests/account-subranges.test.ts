import { describe, expect, it } from "vitest";
import { defaultAccountNumbering, nextAccountCode, type AccountSubrange } from "../lib/account-numbering";

const bankRange: AccountSubrange = { id: "bank", name: "البنوك", category: "asset", prefix: "", start: 110, end: 119, createdAt: "2026-01-01" };

describe("النطاقات الفرعية المحجوزة", () => {
  it("يتخطى النطاق المحجوز عند اقتراح كود عام", () => expect(nextAccountCode([{ code: "100" }, { code: "101" }, { code: "102" }, { code: "103" }, { code: "104" }, { code: "105" }, { code: "106" }, { code: "107" }, { code: "108" }, { code: "109" }], "asset", defaultAccountNumbering(), [bankRange])).toBe("120"));
  it("يقترح الأكواد من داخل النطاق المحدد فقط", () => expect(nextAccountCode([{ code: "110" }], "asset", defaultAccountNumbering(), [bankRange], "bank")).toBe("111"));
});
