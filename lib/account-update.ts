import { isCodeInSubrange, subrangeForCode } from "./account-numbering";
import type { AccountSubrange } from "./account-numbering";

export type EditableAccountRecord = {
  id: string;
  name: string;
  code: string;
  category: AccountSubrange["category"];
  subrangeId?: string;
};

export type AccountUpdateInput = Pick<EditableAccountRecord, "name" | "code">;

/** Validates an account name/code revision without changing its identifier or accounting category. */
export function validateAccountUpdate(
  account: EditableAccountRecord,
  input: AccountUpdateInput,
  accounts: EditableAccountRecord[],
  subranges: AccountSubrange[],
) {
  const name = input.name.trim();
  const code = input.code.trim();
  if (!name) throw new Error("أدخل اسم الحساب أولاً.");
  if (!code) throw new Error("أدخل كود الحساب أولاً.");
  if (!/^[A-Za-z0-9._-]+$/.test(code)) throw new Error("استخدم أرقاماً أو أحرفاً أو شرطات فقط في كود الحساب.");
  if (accounts.some((candidate) => candidate.id !== account.id && candidate.code.toLocaleLowerCase() === code.toLocaleLowerCase())) throw new Error("كود الحساب مستخدم بالفعل. اختر كوداً مختلفاً.");
  if (accounts.some((candidate) => candidate.id !== account.id && candidate.category === account.category && candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error("يوجد حساب آخر بالاسم نفسه ضمن الفئة المختارة.");
  const selectedRange = account.subrangeId ? subranges.find((range) => range.id === account.subrangeId && range.category === account.category) : undefined;
  if (account.subrangeId && !selectedRange) throw new Error("النطاق الفرعي المرتبط بالحساب غير متاح.");
  if (selectedRange && !isCodeInSubrange(code, selectedRange)) throw new Error(`يجب أن يكون كود الحساب ضمن نطاق «${selectedRange.name}» (${selectedRange.start}–${selectedRange.end}).`);
  const reservedRange = subrangeForCode(code, account.category, subranges);
  if (reservedRange && reservedRange.id !== account.subrangeId) throw new Error(`هذا الكود محجوز للنطاق الفرعي «${reservedRange.name}». اختر كوداً آخر.`);
  return { name, code };
}

export function replaceMatchingAccountCode(value: string | undefined, previousCode: string, nextCode: string) {
  return value?.toLocaleLowerCase() === previousCode.toLocaleLowerCase() ? nextCode : value;
}
