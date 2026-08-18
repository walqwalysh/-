import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing the OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * Server-side mirror of a local installment. It stores only the schedule
 * information needed for daily execution; the user's full chart and journal stay local.
 */
export const installmentSchedules = mysqlTable("installment_schedules", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 13, scale: 2 }).notNull(),
  installmentAmount: decimal("installmentAmount", { precision: 13, scale: 2 }).notNull(),
  startDate: varchar("startDate", { length: 10 }).notNull(),
  endDate: varchar("endDate", { length: 10 }).notNull(),
  debitAccountCode: varchar("debitAccountCode", { length: 80 }).notNull(),
  creditAccountCode: varchar("creditAccountCode", { length: 80 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  status: mysqlEnum("status", ["active", "paused", "completed"]).default("active").notNull(),
  lastProcessedPeriodKey: varchar("lastProcessedPeriodKey", { length: 10 }),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("installmentSchedulesUserIdx").on(table.userId),
  uniqueIndex("installmentSchedulesCronTaskUidUnique").on(table.scheduleCronTaskUid),
]);

/**
 * A server-created, immutable representation of a due double-entry posting.
 * The unique schedule/period index makes daily execution idempotent.
 */
export const installmentPostings = mysqlTable("installment_postings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  scheduleId: varchar("scheduleId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  periodKey: varchar("periodKey", { length: 10 }).notNull(),
  dueDate: varchar("dueDate", { length: 10 }).notNull(),
  amount: decimal("amount", { precision: 13, scale: 2 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  debitAccountCode: varchar("debitAccountCode", { length: 80 }).notNull(),
  creditAccountCode: varchar("creditAccountCode", { length: 80 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("installmentPostingsSchedulePeriodUnique").on(table.scheduleId, table.periodKey),
  index("installmentPostingsUserIdx").on(table.userId),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type InstallmentSchedule = typeof installmentSchedules.$inferSelect;
export type InsertInstallmentSchedule = typeof installmentSchedules.$inferInsert;
export type InstallmentPosting = typeof installmentPostings.$inferSelect;
