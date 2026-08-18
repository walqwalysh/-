import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

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

const contentToText = (content: string | Array<{ type: "text"; text: string } | { type: string }>) => typeof content === "string" ? content : content.filter((part): part is { type: "text"; text: string } => part.type === "text").map((part) => part.text).join("\n");

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
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
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
