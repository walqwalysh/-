import { describe, expect, it } from "vitest";

import { normaliseDateOnly } from "../lib/date-utils";

describe("normaliseDateOnly", () => {
  it("يحوّل تاريخ ISO الكامل إلى تاريخ القيد اليومي", () => {
    expect(normaliseDateOnly("2026-08-18T13:43:01.123Z")).toBe("2026-08-18");
  });

  it("يقبل صيغة التاريخ اليومية ويرفض التواريخ غير الواقعية", () => {
    expect(normaliseDateOnly("2026-08-18")).toBe("2026-08-18");
    expect(normaliseDateOnly("2026-02-30")).toBeNull();
  });
});
