import type { Request, Response } from "express";

import { processInstallmentScheduleByTaskUid } from "./db";
import { sdk } from "./_core/sdk";

const utcToday = () => new Date().toISOString().slice(0, 10);

/** HTTP callback invoked only by the platform's Heartbeat scheduler. */
export async function processInstallmentsHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const result = await processInstallmentScheduleByTaskUid(user.taskUid, utcToday());
    if (!result) return res.json({ ok: true, skipped: "orphan" });
    return res.json({ ok: true, ...result, referenceDate: utcToday() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      context: { url: req.originalUrl, taskUid: undefined },
      timestamp: new Date().toISOString(),
    });
  }
}
