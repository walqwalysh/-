import { parse as parseCookie } from "cookie";
import { z } from "zod";

import { COOKIE_NAME } from "../shared/const";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storageGetSignedUrl, storagePut } from "./storage";

const assistantInput = z.object({
  question: z.string().trim().min(3).max(500),
  snapshot: z.object({
    currency: z.string().max(10),
    totalAssets: z.number(),
    totalLiabilities: z.number(),
    totalEquity: z.number(),
    netIncome: z.number(),
    isBalanced: z.boolean(),
    accounts: z.array(z.object({ name: z.string().max(100), category: z.string().max(30), balance: z.number() })).max(100),
  }),
});

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "استخدم صيغة التاريخ YYYY-MM-DD.");
const installmentInput = z.object({
  id: z.string().trim().min(6).max(64),
  contactName: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  totalAmount: z.number().finite().positive(),
  installmentAmount: z.number().finite().positive(),
  startDate: dateOnly,
  endDate: dateOnly,
  debitAccountCode: z.string().trim().min(1).max(80),
  creditAccountCode: z.string().trim().min(1).max(80),
  currency: z.string().trim().min(1).max(10),
}).superRefine((input, context) => {
  if (input.endDate < input.startDate) context.addIssue({ code: "custom", message: "يجب ألا يسبق تاريخ النهاية تاريخ البداية.", path: ["endDate"] });
  if (input.debitAccountCode.toLocaleLowerCase() === input.creditAccountCode.toLocaleLowerCase()) context.addIssue({ code: "custom", message: "يجب أن يختلف حساب المدين عن حساب الدائن.", path: ["creditAccountCode"] });
});

const contentToText = (content: string | Array<{ type: "text"; text: string } | { type: string }>) => typeof content === "string" ? content : content.filter((part): part is { type: "text"; text: string } => part.type === "text").map((part) => part.text).join("\n");

const mediaDraftSchema = z.object({ narration: z.string().trim().min(1).max(350), amount: z.number().finite().nonnegative().nullable(), currency: z.string().trim().min(1).max(10).nullable(), debitHint: z.string().trim().min(1).max(120).nullable(), creditHint: z.string().trim().min(1).max(120).nullable(), documentNumber: z.string().trim().min(1).max(80).nullable(), documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), confidence: z.number().finite().min(0).max(1), cautions: z.array(z.string().trim().min(1).max(180)).max(5) });
const imageAttachmentInput = z.object({ base64: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).min(8).max(17_000_000), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), fileName: z.string().trim().min(1).max(120) });
const audioAttachmentInput = z.object({ base64: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).min(8).max(22_500_000), mimeType: z.enum(["audio/m4a", "audio/mp4", "audio/mpeg", "audio/wav", "audio/webm", "audio/ogg"]), fileName: z.string().trim().min(1).max(120) });
type MediaDraft = z.infer<typeof mediaDraftSchema>;
const mediaFallback = (caution: string): MediaDraft => ({ narration: "لم يمكن استخراج تفاصيل كافية من المستند. راجع البيانات يدوياً قبل إنشاء أي قيد.", amount: null, currency: null, debitHint: null, creditHint: null, documentNumber: null, documentDate: null, confidence: 0, cautions: [caution] });
function decodeAttachment(base64: string, maximumBytes: number): Buffer { const decoded = Buffer.from(base64, "base64"); if (!decoded.length || decoded.length > maximumBytes) throw new Error("حجم الملف غير صالح أو يتجاوز الحد المسموح للتحليل."); return decoded; }
function fileExtension(mimeType: string): string { if (mimeType === "image/jpeg") return "jpg"; if (mimeType === "image/png") return "png"; if (mimeType === "image/webp") return "webp"; if (mimeType === "audio/mpeg") return "mp3"; if (mimeType === "audio/wav") return "wav"; if (mimeType === "audio/webm") return "webm"; if (mimeType === "audio/ogg") return "ogg"; return "m4a"; }
async function extractAccountingDraft(content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }>): Promise<MediaDraft> { const response = await invokeLLM({ model: "gemini-3-flash-preview", max_tokens: 1100, response_format: { type: "json_object" }, messages: [{ role: "system", content: "أنت مساعد لاستخلاص معلومات محاسبية من مستند أو نص صوتي باللغة العربية. أعد كائن JSON فقط بهذه المفاتيح: narration, amount, currency, debitHint, creditHint, documentNumber, documentDate, confidence, cautions. لا تخترع أرقاماً أو حسابات أو تواريخ. استخدم null لما لا يظهر بوضوح. الاقتراح للمراجعة فقط وليس قيداً محاسبياً. في narration لخّص الواقعة، واقترح debitHint وcreditHint بأسماء حسابات عامة فقط عند وجود دليل كافٍ. confidence رقم من 0 إلى 1، وcautions قائمة تنبه لأي غموض أو عدم اتزان محتمل." }, { role: "user", content }] }); const text = contentToText(response.choices[0]?.message.content ?? "").trim(); try { const parsed = mediaDraftSchema.safeParse(JSON.parse(text)); return parsed.success ? parsed.data : mediaFallback("لم يطابق ناتج التحليل صيغة اقتراح محاسبي صالحة."); } catch { return mediaFallback("تعذر قراءة ناتج التحليل؛ أدخل القيد يدوياً بعد مراجعة المستند."); } }

function heartbeatSessionToken(headers: Record<string, string | string[] | undefined>): string {
  const cookieHeader = Array.isArray(headers.cookie) ? headers.cookie[0] ?? "" : headers.cookie ?? "";
  const fromCookie = parseCookie(cookieHeader)[COOKIE_NAME];
  if (fromCookie) return fromCookie;
  const authHeader = headers.authorization;
  const bearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  return bearer;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  assistant: router({
    ask: protectedProcedure.input(assistantInput).mutation(async ({ input }) => {
      const response = await invokeLLM({
        model: "gpt-5-mini",
        maxTokens: 700,
        messages: [
          { role: "system", content: "أنت مساعد محاسبي عربي داخل تطبيق محاسبي شخصي. اشرح الأرقام التي يقدمها المستخدم بلغة واضحة ومهنية. لا تخترع قيوداً أو أرصدة، ولا تقدّم نصيحة قانونية أو ضريبية أو استثمارية ملزمة. نبه المستخدم إلى مراجعة محاسب مؤهل عند الحاجة. اجعل الإجابة موجزة ومنظمة في فقرات قصيرة." },
          { role: "user", content: `سؤال المستخدم: ${input.question}\n\nملخص البيانات المُرسل من المستخدم فقط:\n${JSON.stringify(input.snapshot)}` },
        ],
      });
      const answer = contentToText(response.choices[0]?.message.content ?? "").trim();
      return { answer: answer || "تعذر إعداد التحليل الآن. حاول مرة أخرى لاحقاً." };
    }),
    extractImage: protectedProcedure.input(imageAttachmentInput).mutation(async ({ ctx, input }) => {
      const data = decodeAttachment(input.base64, 12 * 1024 * 1024);
      const upload = await storagePut(`accounting-media/${ctx.user.id}/document-${Date.now()}.${fileExtension(input.mimeType)}`, data, input.mimeType);
      const signedUrl = await storageGetSignedUrl(upload.key);
      const draft = await extractAccountingDraft([{ type: "text", text: "استخرج فقط تفاصيل هذا المستند المالي. لا تنشئ قيداً ولا تفترض شيئاً غير ظاهر." }, { type: "image_url", image_url: { url: signedUrl, detail: "high" } }]);
      return { draft };
    }),
    extractVoice: protectedProcedure.input(audioAttachmentInput).mutation(async ({ ctx, input }) => {
      const data = decodeAttachment(input.base64, 16 * 1024 * 1024);
      const upload = await storagePut(`accounting-media/${ctx.user.id}/voice-${Date.now()}.${fileExtension(input.mimeType)}`, data, input.mimeType);
      const signedUrl = await storageGetSignedUrl(upload.key);
      const transcription = await transcribeAudio({ audioUrl: signedUrl, language: "ar", prompt: "فرّغ الكلام العربي كما قيل، خصوصاً المبالغ والتواريخ وأسماء الحسابات، من دون تصحيح أو اختراع." });
      if ("error" in transcription) throw new Error("تعذر تفريغ التسجيل الصوتي. تأكد من وضوحه وحجمه ثم حاول مجدداً.");
      const transcript = transcription.text.trim();
      const draft = await extractAccountingDraft(`النص الصوتي المُفرغ من المستخدم هو:\n${transcript}\n\nاستخرج منه اقتراحاً للمراجعة فقط.`);
      return { transcript, draft };
    }),
  }),
  installments: router({
    schedule: protectedProcedure.input(installmentInput).mutation(async ({ ctx, input }) => {
      const schedule = await db.createOrUpdateInstallmentSchedule(ctx.user.id, input);
      if (schedule.scheduleCronTaskUid) {
        return { taskUid: schedule.scheduleCronTaskUid, nextExecutionAt: null };
      }
      const heartbeat = await createHeartbeatJob({
        name: `installment-${ctx.user.id}-${schedule.id}`,
        cron: "0 10 0 * * *",
        path: "/api/scheduled/process-installments",
        payload: {},
        description: `فحص يومي لقسط «${schedule.title}» وإنشاء القيد الداخلي المستحق فقط.`,
      }, heartbeatSessionToken(ctx.req.headers));
      await db.assignScheduleHeartbeatTask(ctx.user.id, schedule.id, heartbeat.taskUid);
      return heartbeat;
    }),
    updateStatus: protectedProcedure.input(z.object({ id: z.string().min(6).max(64), status: z.enum(["active", "paused"]) })).mutation(async ({ ctx, input }) => {
      const schedule = await db.getInstallmentScheduleForUser(ctx.user.id, input.id);
      if (!schedule) throw new Error("القسط غير موجود في خدمة المعالجة الخلفية.");
      if (schedule.scheduleCronTaskUid) {
        await updateHeartbeatJob(schedule.scheduleCronTaskUid, { enable: input.status === "active" }, heartbeatSessionToken(ctx.req.headers));
      }
      const updated = await db.updateInstallmentScheduleStatus(ctx.user.id, input.id, input.status);
      return { status: updated?.status ?? input.status };
    }),
    remove: protectedProcedure.input(z.object({ id: z.string().min(6).max(64) })).mutation(async ({ ctx, input }) => {
      const schedule = await db.getInstallmentScheduleForUser(ctx.user.id, input.id);
      if (schedule?.scheduleCronTaskUid) await deleteHeartbeatJob(schedule.scheduleCronTaskUid, heartbeatSessionToken(ctx.req.headers));
      await db.deleteInstallmentSchedule(ctx.user.id, input.id);
      return { success: true };
    }),
    postings: protectedProcedure.query(({ ctx }) => db.listInstallmentPostingsForUser(ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
