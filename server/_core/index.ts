import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { verifyFlutterwaveWebhookHash, normalizeFlutterwaveEvent, verifyFlutterwaveTransaction } from "../flutterwave";
import { createPaidOrder, getInvoiceById, getPaymentByTransaction, recordPayment } from "../db";
import { notifyOwner } from "./notification";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/webhooks/flutterwave", async (req, res) => {
    const providedHash = req.header("verif-hash");
    if (!verifyFlutterwaveWebhookHash(providedHash)) return res.status(401).json({ ok: false, error: "Invalid webhook signature" });
    const event = normalizeFlutterwaveEvent(req.body);
    if (!event.transactionId || !event.txRef?.startsWith("invoice-")) return res.status(200).json({ ok: true, ignored: true });
    const existing = await getPaymentByTransaction(event.transactionId);
    if (existing) return res.status(200).json({ ok: true, duplicate: true });
    const invoiceId = Number(event.txRef.replace("invoice-", ""));
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) return res.status(400).json({ ok: false, error: "Invalid invoice reference" });
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) return res.status(404).json({ ok: false, error: "Invoice not found" });
    const verified = await verifyFlutterwaveTransaction(event.transactionId);
    if (verified.tx_ref !== event.txRef || verified.currency !== invoice.currency || Number(verified.amount) < Number(invoice.total)) return res.status(400).json({ ok: false, error: "Payment does not match invoice" });
    await recordPayment({ invoiceId, provider: "flutterwave", transactionId: String(verified.id), providerReference: verified.tx_ref, amount: String(verified.amount), currency: verified.currency, method: verified.payment_type, rawPayload: req.body });
    const orderId = await createPaidOrder(invoiceId);
    await notifyOwner({ title: "Payment confirmed", content: `Flutterwave verified payment for invoice ${invoiceId}; order ${orderId} is processing.` });
    return res.status(200).json({ ok: true, orderId });
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
