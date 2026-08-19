import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createNotification, createQuote, getAdminCounts, listAdminQuotes, listCustomerQuotes, listProducts, markQuoteStatus } from "./db";

const quoteItem = z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive(), color: z.string().min(1), size: z.string().min(1), packaging: z.string().min(1), customization: z.string().min(1) });

export const appRouter = router({
  system: systemRouter,
  auth: router({ me: publicProcedure.query(opts => opts.ctx.user), logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }) }),
  catalogue: router({ list: publicProcedure.query(() => listProducts()) }),
  quotes: router({
    mine: protectedProcedure.query(({ ctx }) => listCustomerQuotes(ctx.user.id)),
    create: protectedProcedure.input(z.object({ notes: z.string().optional(), ref: z.string().min(6), items: z.array(quoteItem).min(1) })).mutation(async ({ ctx, input }) => { const id = await createQuote({ customerId: ctx.user.id, ...input }); await createNotification(ctx.user.id, "quote_received", "Quote request received", `We received ${input.ref} and will review it shortly.`, input.ref); return { id, ref: input.ref }; }),
    adminList: adminProcedure.query(() => listAdminQuotes()),
    setStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["quoted", "rejected", "cancelled"]), reason: z.string().optional() })).mutation(async ({ input }) => { await markQuoteStatus(input.id, input.status, input.reason); return { success: true }; }),
    counts: adminProcedure.query(() => getAdminCounts()),
  }),
  notifications: router({ mine: protectedProcedure.query(() => []) }),
});

export type AppRouter = typeof appRouter;
