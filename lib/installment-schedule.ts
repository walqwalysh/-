export type InstallmentScheduleInput = {
  totalAmount: number;
  installmentAmount: number;
  startDate: string;
  endDate: string;
};

export type DueInstallmentPeriod = {
  periodKey: string;
  dueDate: string;
  amount: number;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateOnly(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

export function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function fromDateOnly(value: string): Date {
  if (!isValidDateOnly(value)) throw new Error("Invalid date-only value");
  return new Date(`${value}T00:00:00.000Z`);
}

function dueDateAtMonthOffset(startDate: string, offset: number): Date {
  const start = fromDateOnly(startDate);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + offset;
  const day = start.getUTCDate();
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, maxDay)));
}

/**
 * Calculates every contractual monthly due amount without introducing any
 * rounding residue. The last period is the remaining balance, if smaller.
 */
export function calculateInstallmentPeriods(schedule: InstallmentScheduleInput): DueInstallmentPeriod[] {
  const totalAmount = Number(schedule.totalAmount);
  const installmentAmount = Number(schedule.installmentAmount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(installmentAmount) || installmentAmount <= 0) return [];
  if (!isValidDateOnly(schedule.startDate) || !isValidDateOnly(schedule.endDate) || schedule.endDate < schedule.startDate) return [];

  const periods: DueInstallmentPeriod[] = [];
  let paid = 0;
  for (let offset = 0; paid < totalAmount; offset += 1) {
    const dueDate = toDateOnly(dueDateAtMonthOffset(schedule.startDate, offset));
    if (dueDate > schedule.endDate) break;
    const amount = Number(Math.min(installmentAmount, totalAmount - paid).toFixed(2));
    periods.push({ periodKey: dueDate, dueDate, amount });
    paid = Number((paid + amount).toFixed(2));
  }
  return periods;
}

/** Returns only periods due on or before the reference date and not previously posted. */
export function dueInstallmentPeriods(schedule: InstallmentScheduleInput, referenceDate: string, postedPeriodKeys: Iterable<string> = []): DueInstallmentPeriod[] {
  if (!isValidDateOnly(referenceDate)) return [];
  const posted = new Set(postedPeriodKeys);
  return calculateInstallmentPeriods(schedule).filter((period) => period.dueDate <= referenceDate && !posted.has(period.periodKey));
}
