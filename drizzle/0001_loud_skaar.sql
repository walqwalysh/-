CREATE TABLE `installment_postings` (
	`id` varchar(64) NOT NULL,
	`scheduleId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`periodKey` varchar(10) NOT NULL,
	`dueDate` varchar(10) NOT NULL,
	`amount` decimal(13,2) NOT NULL,
	`description` varchar(500) NOT NULL,
	`debitAccountCode` varchar(80) NOT NULL,
	`creditAccountCode` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `installment_postings_id` PRIMARY KEY(`id`),
	CONSTRAINT `installmentPostingsSchedulePeriodUnique` UNIQUE(`scheduleId`,`periodKey`)
);
--> statement-breakpoint
CREATE TABLE `installment_schedules` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`totalAmount` decimal(13,2) NOT NULL,
	`installmentAmount` decimal(13,2) NOT NULL,
	`startDate` varchar(10) NOT NULL,
	`endDate` varchar(10) NOT NULL,
	`debitAccountCode` varchar(80) NOT NULL,
	`creditAccountCode` varchar(80) NOT NULL,
	`currency` varchar(10) NOT NULL,
	`status` enum('active','paused','completed') NOT NULL DEFAULT 'active',
	`lastProcessedPeriodKey` varchar(10),
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `installment_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `installmentSchedulesCronTaskUidUnique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE INDEX `installmentPostingsUserIdx` ON `installment_postings` (`userId`);--> statement-breakpoint
CREATE INDEX `installmentSchedulesUserIdx` ON `installment_schedules` (`userId`);