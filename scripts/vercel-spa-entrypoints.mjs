import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

const outputRoot = join(process.cwd(), "dist", "public");
const routes = ["products", "quote", "dashboard", "admin", "how-it-works", "contact", "product", "orders", "pay", "messages", "review", "admin-quote", "admin-fulfilment"];

for (const route of routes) {
  const routeDir = join(outputRoot, route);
  await mkdir(routeDir, { recursive: true });
  await cp(join(outputRoot, "index.html"), join(routeDir, "index.html"));
}

console.log(`[vercel] generated ${routes.length} SPA route entrypoints`);
