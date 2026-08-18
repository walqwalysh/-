import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";

import { calculateInstallmentPeriods, dueInstallmentPeriods, type InstallmentScheduleInput } from "../lib/installment-schedule";
import { InsertUser, installmentPostings, installmentSchedules, type InsertInstallmentSchedule, type InstallmentSchedule, type User, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export type ServerInstallmentInput = {
  id: string;
  contactName: string;
  title: string;
  totalAmount: number;
  installmentAmount: number;
  startDate: string;
  endDate: string;
  debitAccountCode: string;
  creditAccountCode: string;
  currency: string;
};

export type ProcessInstallmentResult = {
  scheduleId: string;
  created: number;
  alreadyRecorded: number;
  status: "active" | "paused" | "completed";
  lastProcessedPeriodKey: string | null;
};

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً. حاول مرة أخرى لاحقاً.");
  return db;
}

function asScheduleInput(schedule: InstallmentSchedule): InstallmentScheduleInput {
  return {
    totalAmount: Number(schedule.totalAmount),
    installmentAmount: Number(schedule.installmentAmount),
    startDate: schedule.startDate,
    endDate: schedule.endDate,
  };
}

function isDuplicateInsert(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ER_DUP_ENTRY";
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getInstallmentScheduleForUser(userId: number, scheduleId: string): Promise<InstallmentSchedule | undefined> {
  const db = requireDb(await getDb());
  const result = await db.select().from(installmentSchedules).where(and(eq(installmentSchedules.id, scheduleId), eq(installmentSchedules.userId, userId))).limit(1);
  return result[0];
}

export async function createOrUpdateInstallmentSchedule(userId: number, input: ServerInstallmentInput): Promise<InstallmentSchedule> {
  const db = requireDb(await getDb());
  const existing = await getInstallmentScheduleForUser(userId, input.id);
  const values = {
    contactName: input.contactName,
    title: input.title,
    totalAmount: input.totalAmount.toFixed(2),
    installmentAmount: input.installmentAmount.toFixed(2),
    startDate: input.startDate,
    endDate: input.endDate,
    debitAccountCode: input.debitAccountCode,
    creditAccountCode: input.creditAccountCode,
    currency: input.currency,
  };
  if (existing) {
    await db.update(installmentSchedules).set(values).where(eq(installmentSchedules.id, existing.id));
  } else {
    const insert: InsertInstallmentSchedule = { id: input.id, userId, ...values, status: "active" };
    await db.insert(installmentSchedules).values(insert);
  }
  const schedule = await getInstallmentScheduleForUser(userId, input.id);
  if (!schedule) throw new Error("تعذر حفظ القسط المجدول.");
  return schedule;
}

export async function assignScheduleHeartbeatTask(userId: number, scheduleId: string, taskUid: string): Promise<void> {
  const db = requireDb(await getDb());
  await db.update(installmentSchedules).set({ scheduleCronTaskUid: taskUid, status: "active" }).where(and(eq(installmentSchedules.id, scheduleId), eq(installmentSchedules.userId, userId)));
}

export async function updateInstallmentScheduleStatus(userId: number, scheduleId: string, status: "active" | "paused" | "completed"): Promise<InstallmentSchedule | undefined> {
  const db = requireDb(await getDb());
  await db.update(installmentSchedules).set({ status }).where(and(eq(installmentSchedules.id, scheduleId), eq(installmentSchedules.userId, userId)));
  return getInstallmentScheduleForUser(userId, scheduleId);
}

export async function deleteInstallmentSchedule(userId: number, scheduleId: string): Promise<void> {
  const db = requireDb(await getDb());
  await db.delete(installmentSchedules).where(and(eq(installmentSchedules.id, scheduleId), eq(installmentSchedules.userId, userId)));
}

export async function getInstallmentScheduleByTaskUid(taskUid: string): Promise<InstallmentSchedule | undefined> {
  const db = requireDb(await getDb());
  const result = await db.select().from(installmentSchedules).where(eq(installmentSchedules.scheduleCronTaskUid, taskUid)).limit(1);
  return result[0];
}

export async function listInstallmentPostingsForUser(userId: number) {
  const db = requireDb(await getDb());
  return db.select().from(installmentPostings).where(eq(installmentPostings.userId, userId)).orderBy(desc(installmentPostings.dueDate), desc(installmentPostings.createdAt)).limit(500);
}

/**
 * Resolves every due period for one schedule. A unique (scheduleId, periodKey)
 * index is the final idempotency guard when the platform retries a callback.
 */
export async function processInstallmentScheduleByTaskUid(taskUid: string, referenceDate: string): Promise<ProcessInstallmentResult | null> {
  const db = requireDb(await getDb());
  const schedule = await getInstallmentScheduleByTaskUid(taskUid);
  if (!schedule) return null;
  if (schedule.status !== "active") {
    return { scheduleId: schedule.id, created: 0, alreadyRecorded: 0, status: schedule.status, lastProcessedPeriodKey: schedule.lastProcessedPeriodKey ?? null };
  }

  const allPeriods = calculateInstallmentPeriods(asScheduleInput(schedule));
  const existingPostings = await db.select({ periodKey: installmentPostings.periodKey }).from(installmentPostings).where(eq(installmentPostings.scheduleId, schedule.id)).orderBy(asc(installmentPostings.periodKey));
  const existingPeriodKeys = existingPostings.map((posting) => posting.periodKey);
  const duePeriods = dueInstallmentPeriods(asScheduleInput(schedule), referenceDate, existingPeriodKeys);
  let created = 0;
  let alreadyRecorded = 0;

  for (const period of duePeriods) {
    try {
      await db.insert(installmentPostings).values({
        id: randomUUID(),
        scheduleId: schedule.id,
        userId: schedule.userId,
        periodKey: period.periodKey,
        dueDate: period.dueDate,
        amount: period.amount.toFixed(2),
        description: `قسط مستحق: ${schedule.title} — ${schedule.contactName}`,
        debitAccountCode: schedule.debitAccountCode,
        creditAccountCode: schedule.creditAccountCode,
      });
      created += 1;
    } catch (error) {
      if (!isDuplicateInsert(error)) throw error;
      alreadyRecorded += 1;
    }
  }

  const currentPostings = await db.select({ periodKey: installmentPostings.periodKey }).from(installmentPostings).where(eq(installmentPostings.scheduleId, schedule.id)).orderBy(asc(installmentPostings.periodKey));
  const processedPeriodKeys = currentPostings.map((posting) => posting.periodKey);
  const lastProcessedPeriodKey = processedPeriodKeys.at(-1) ?? null;
  const isComplete = allPeriods.length > 0 && allPeriods.every((period) => processedPeriodKeys.includes(period.periodKey));
  const status = isComplete ? "completed" : "active";
  await db.update(installmentSchedules).set({ status, lastProcessedPeriodKey }).where(eq(installmentSchedules.id, schedule.id));
  return { scheduleId: schedule.id, created, alreadyRecorded, status, lastProcessedPeriodKey };
}
