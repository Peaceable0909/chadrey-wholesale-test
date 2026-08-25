import { z } from "zod";
import { createFlutterwaveCheckout } from "./flutterwave";
import { createFirestoreProduct } from "./firestoreProducts";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import { createInvoice, createMessage, createNotification, createPaidOrder, createQuotation, createQuote, getAdminCounts, getInvoiceForCustomer, getOrderCustomerId, getQuotationById, getQuotationForCustomer, getQuoteRequestById, listAdminOrders, listAdminQuotes, listCustomerOrders, listCustomerQuotes, listNotifications, listProducts, markQuoteStatus, setQuotationStatus, updateOrderStatus } from "./db";

const quoteItem = z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive(), color: z.string().min(1), size: z.string().min(1), packaging: z.string().min(1), customization: z.string().min(1) });

export const appRouter = router({
  system: systemRouter,
  auth: router({ me: publicProcedure.query(opts => opts.ctx.user), logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }) }),
  catalogue: router({
    list: publicProcedure.query(() => listProducts()),
    adminCreate: adminProcedure.input(z.object({
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(120),
      name: z.string().trim().min(2).max(220),
      description: z.string().trim().min(20).max(5000),
      category: z.string().trim().min(2).max(80),
      moq: z.number().int().positive(),
      colors: z.array(z.string().trim().min(1).max(50)).min(1).max(30),
      sizes: z.array(z.string().trim().min(1).max(30)).min(1).max(30),
      packagingOptions: z.array(z.string().trim().min(1).max(120)).min(1).max(30),
      customizationOptions: z.array(z.string().trim().min(1).max(160)).min(1).max(30),
      images: z.array(z.string().url()).min(10).max(30),
      primaryImage: z.string().url(),
    }).refine(input => input.images.includes(input.primaryImage), { message: "Primary image must be one of the uploaded images", path: ["primaryImage"] })).mutation(async ({ ctx, input }) => {
      return { id: await createFirestoreProduct({ ...input, createdByUid: ctx.user.openId }) };
    }),
  }),
  quotes: router({
    mine: protectedProcedure.query(({ ctx }) => listCustomerQuotes(ctx.user.id)),
    quotation: protectedProcedure.input(z.object({ quoteRequestId: z.number().int().positive() })).query(({ ctx, input }) => getQuotationForCustomer(input.quoteRequestId, ctx.user.id)),
    reviewQuotation: protectedProcedure.input(z.object({ quotationId: z.number().int().positive(), decision: z.enum(["accepted", "declined"]) })).mutation(async ({ input }) => { await setQuotationStatus(input.quotationId, input.decision); return { success: true }; }),
    create: protectedProcedure.input(z.object({ notes: z.string().optional(), ref: z.string().min(6), items: z.array(quoteItem).min(1) })).mutation(async ({ ctx, input }) => { const id = await createQuote({ customerId: ctx.user.id, ...input }); await createNotification(ctx.user.id, "quote_received", "Quote request received", `We received ${input.ref} and will review it shortly.`, input.ref); await notifyOwner({ title: "New quote request", content: `${input.ref} was submitted with ${input.items.length} product line(s).` }); return { id, ref: input.ref }; }),
    adminList: adminProcedure.query(() => listAdminQuotes()),
    setStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["quoted", "rejected", "cancelled"]), reason: z.string().optional() })).mutation(async ({ input }) => { await markQuoteStatus(input.id, input.status, input.reason); return { success: true }; }),
    counts: adminProcedure.query(() => getAdminCounts()),
    createQuotation: adminProcedure.input(z.object({ quoteRequestId: z.number().int().positive(), subtotal: z.string().min(1), notes: z.string().optional(), expiresAt: z.string().optional() })).mutation(async ({ ctx, input }) => { const id = await createQuotation({ quoteRequestId: input.quoteRequestId, issuedBy: ctx.user.id, subtotal: input.subtotal, notes: input.notes, expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined }); const request = await getQuoteRequestById(input.quoteRequestId); if (request) await createNotification(request.customerId, "quotation_sent", "Your quotation is ready", `Quotation ${id} is ready for review.`, String(input.quoteRequestId)); return { id }; }),
    createInvoice: adminProcedure.input(z.object({ quotationId: z.number().int().positive(), total: z.string().min(1), dueDate: z.string().min(8), lineItems: z.array(z.object({ description: z.string(), quantity: z.number().positive(), unitPrice: z.string() })), shippingCost: z.string().optional(), tax: z.string().optional(), paymentInstructions: z.string().optional() })).mutation(async ({ input }) => { const id = await createInvoice(input); const quotation = await getQuotationById(input.quotationId); if (quotation) { const request = await getQuoteRequestById(quotation.quoteRequestId); if (request) await createNotification(request.customerId, "invoice_issued", "Invoice issued", `Invoice ${id} is ready for payment.`, String(id)); } return { id }; }),
    updateOrder: adminProcedure.input(z.object({ orderId: z.number().int().positive(), status: z.enum(["processing", "shipped", "delivered", "cancelled"]), trackingNumber: z.string().optional(), carrier: z.string().optional() })).mutation(async ({ input }) => { await updateOrderStatus(input.orderId, input.status, input.trackingNumber, input.carrier); if (input.status === "shipped") { const customerId = await getOrderCustomerId(input.orderId); if (customerId) await createNotification(customerId, "order_shipped", "Your order has shipped", `${input.carrier || "Your carrier"} is handling order ${input.orderId}.`, String(input.orderId)); } return { success: true }; }),
    recordVerifiedPayment: adminProcedure.input(z.object({ invoiceId: z.number().int().positive() })).mutation(async ({ input }) => { const orderId = await createPaidOrder(input.invoiceId); await notifyOwner({ title: "Payment confirmed", content: `Invoice ${input.invoiceId} was verified and order ${orderId} is now processing.` }); return { orderId }; }),
  }),
  notifications: router({ mine: protectedProcedure.query(({ ctx }) => listNotifications(ctx.user.id)) }),
  messages: router({ create: protectedProcedure.input(z.object({ quoteRequestId: z.number().int().positive(), body: z.string().min(1).max(5000) })).mutation(async ({ ctx, input }) => ({ id: await createMessage({ quoteRequestId: input.quoteRequestId, senderId: ctx.user.id, body: input.body }) })) }),
  orders: router({ mine: protectedProcedure.query(({ ctx }) => listCustomerOrders(ctx.user.id)), adminList: adminProcedure.query(() => listAdminOrders()) }),
  billing: router({ invoice: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive() })).query(({ ctx, input }) => getInvoiceForCustomer(input.invoiceId, ctx.user.id)) }),
  payments: router({ createFlutterwaveCheckout: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive(), amount: z.number().positive(), currency: z.string().length(3), redirectUrl: z.string().url() })).mutation(async ({ ctx, input }) => ({ link: await createFlutterwaveCheckout({ amount: input.amount, currency: input.currency, txRef: `invoice-${input.invoiceId}`, customerEmail: ctx.user.email || "", customerName: ctx.user.name || undefined, redirectUrl: input.redirectUrl }) })) }),
});

export type AppRouter = typeof appRouter;
