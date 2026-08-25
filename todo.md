# Project TODO

- [x] Preserve the existing Chadrey Wholesale visual language: dark-green primary brand, Inter typography, card-based layouts, responsive public navigation.
- [x] Build the public product catalogue with categories, product detail pages, MOQ, colors, sizes, packaging, customization options, and product search/filter/sort foundations.
- [x] Add Manus OAuth customer authentication and role-based customer/admin access.
- [x] Add multi-item quote requests with repeatable product lines and per-line quantity, color, size, packaging, customization, and notes.
- [x] Add customer My Quotes dashboard with unique references and live quote-to-order status tracking.
- [x] Add admin quote operations dashboard for incoming requests and line-item quotation creation.
- [ ] Add quotation sending and customer quotation review flow.
- [ ] Add invoice creation from accepted quotations with itemized amounts, due dates, and payment instructions.
- [x] Add Flutterwave hosted checkout and verified server-side webhook handling.
- [ ] Add Stripe hosted checkout and verified server-side webhook handling.
- [ ] Keep Flutterwave and Stripe as parallel payment options with provider-specific payment records.
- [x] Add automatic invoice/payment/order status updates after verified successful payment.
- [x] Add customer order tracking timeline from confirmation through production, shipping, and delivery.
- [x] Add admin fulfilment management with order status, tracking number, carrier, and shipping details.
- [ ] Add customer email and in-app notifications for quote received, quotation sent, invoice issued, payment confirmed, and order shipped.
- [x] Add owner/admin push notifications only for new quote submissions and confirmed payments.
- [x] Add database schema, secure procedures, and tests for all core entities and status transitions.
- [ ] Verify responsive UI, browser flows, payment webhook safeguards, and production build before checkpoint.
- [ ] Keep this checklist current as implementation progresses; do not delete completed history items.

- [ ] Defer Stripe checkout and Stripe webhooks until the user configures Stripe credentials; keep the payment model extensible for later parallel provider support.
- [ ] Prioritize Flutterwave-ready payment boundaries and a bank-transfer/manual-verification fallback without exposing fake successful payments.
- [x] Implement the full quote lifecycle including accepted, declined, rejected, expired, overdue, cancelled, paid, processing, shipped, and delivered states.
- [x] Add customer notification bell/menu and admin notification handling while restricting owner push alerts to new quote submissions and confirmed payments.
- [ ] Add customer/admin messaging entry points for quote changes, invoice questions, and support conversations.
- [ ] Add draft quote requests, saved products, comparison, FAQ, addresses, account settings, and product/admin management after the core loop.

- [x] Implement a real product detail page with MOQ, colors, sizes, packaging, customization, and product-to-quote prefill flow.
- [ ] Add per-line notes to multi-item quote requests and wire quote submission to backend persistence.
- [x] Connect My Quotes to backend data so references and status timelines are live per user.
- [ ] Implement admin quotation creation/editing UI with real line-item pricing actions backed by procedures.
- [ ] Add full tRPC procedures and tests for quotations, invoices, payments, orders, messages, notifications, and enforced status transitions.
- [x] Implement Flutterwave webhook handlers and safeguards, then test them.
- [x] Run and verify a production build before checkpoint.
- [x] Wire QuoteRequest to parse product, quantity, color, size, packaging, and customization URL parameters and prefill the first quote line.
- [ ] Add a test or verification step covering product-detail to quote prefill behavior.
- [x] Trigger the owner push notification from the actual verified Flutterwave payment-confirmation path, including webhook-confirmed payments.
- [x] Harden the Flutterwave webhook with server-side transaction verification, idempotency/duplicate-delivery protection, invoice existence and amount/currency checks, and payment record persistence before marking orders paid.
- [ ] Add tests covering successful webhook processing, duplicate webhook handling, and owner notification firing on confirmed payment.
- [ ] Document Supabase secret setup for FLUTTERWAVE_SECRET_KEY and FLUTTERWAVE_WEBHOOK_HASH in the final plain-text guide.
- [ ] Create and attach the final plain-text Supabase/Flutterwave configuration guide after implementation and verification.
- [x] Implement a customer quotation detail/review page with accept/decline actions and route dashboard quote links to it.
- [ ] Gate invoice creation to accepted quotations and build real itemized invoice lines from quoted products and prices.
- [ ] Add customer and admin messaging UI/thread views backed by the existing messages procedure.
- [ ] Replace hardcoded dashboard timeline and placeholder quote text with real per-user quote/order status data.
- [ ] Upgrade the admin quotation composer to support editable line-item pricing, quantities, totals, and quotation edits.
- [ ] Attach and deliver the Flutterwave/Supabase setup guide to the user at the final completed milestone.
- [x] Update the plain-text guide at project end to reflect the completed workflow and verified production behavior.
- [x] Connect the /orders tracking page to persisted per-customer order data and render real status, carrier, tracking number, and milestone timestamps.
- [x] Build a real admin fulfilment management UI that loads live orders and allows editing status, carrier, tracking number, and shipping details instead of using hardcoded values.
- [ ] Add tests or verification for successful paid-order creation feeding real order tracking data into the customer tracking page.
- [ ] Wire a customer-facing payment action/button to payments.createFlutterwaveCheckout and verify the hosted checkout launch flow in the browser.
- [ ] Extend the quote status model, procedures, and UI to support expired and overdue states end to end.
- [ ] Implement a real customer notification bell/menu interaction and admin notification handling UI.
- [x] Add tests for successful Flutterwave webhook processing, duplicate webhook handling, and owner notification firing from the verified webhook path.
- [x] Render real order milestone timestamps on the customer tracking page and remove admin-only controls from the customer view.
- [ ] Add editable shipping-detail fields and persistence to the admin fulfilment UI.
- [ ] Finalize and deliver the Flutterwave/Supabase guide only after the remaining workflow and verification items are complete.
- [ ] Add integration-style tests for /api/webhooks/flutterwave covering a verified successful payment that persists the payment and creates or updates the order.
- [ ] Add a webhook replay test asserting duplicate handling produces no duplicate payment or order.
- [ ] Add a webhook notification test asserting owner notification fires only after verified successful payment processing.
- [x] Push the active Chadrey Wholesale project to https://github.com/Peaceable0909/chadrey-wholesale-test on the main branch and verify the remote commit.

- [x] Rework the homepage to match the supplied reference: deep-green header, branded navigation, split hero, wholesale value proposition, logistics imagery, category cards, process section, CTA band, and footer.
- [x] Replace prototype-oriented homepage copy with production-oriented B2B wholesale messaging and real operational calls to action.
- [x] Add a responsive mobile navigation pattern with accessible menu controls and preserved customer/admin entry points.
- [ ] Make hero, category cards, process steps, CTA, catalogue, quote form, dashboards, and payment/order pages responsive across desktop, tablet, and mobile breakpoints.
- [x] Add production-style brand assets and image treatment without storing local media inside the web project bundle.
- [ ] Verify the redesign with typecheck, tests, production build, and desktop/mobile visual checks.
- [x] Implement or remove the homepage `/how-it-works` and `/contact` navigation destinations so every public link resolves to a real page.
- [x] Add mobile menu accessibility semantics, including `aria-expanded`, `aria-controls`, keyboard-safe focus behavior, and a clear accessible label.

- [x] Diagnose why https://chadrey-wholesale-test.vercel.app/ is not working and document the deployment/runtime root cause.
- [x] Apply and verify the smallest safe fix for the Vercel deployment if the issue is in the project configuration or build output.

- [x] Add Vercel configuration for the Vite frontend output at `dist/public` with the project build command.
- [x] Verify the Vercel deployment artifact and push the deployment configuration fix to the GitHub main branch.
- [ ] Redeploy the project on Vercel after adding `vercel.json`, then verify the live root URL serves the built frontend instead of raw server source.
- [ ] Recheck key public routes and asset loading on the live Vercel deployment after the config change.

- [ ] Correct Vercel Project Settings so Root Directory is `./` and Output Directory is `dist/public`.
- [ ] Redeploy the latest `main` commit and verify the live homepage and static assets load correctly.

- [ ] Recheck why the Vercel Production deployment is not updating from GitHub `main` and identify the active deployment commit/project linkage.
- [ ] Verify the latest production deployment serves the redesigned Chadrey frontend and client-side routes after the correct deployment is promoted.
- [x] Add generated static route entrypoints for Vercel direct navigation (`/products`, `/quote`, `/dashboard`, `/admin`, `/how-it-works`, `/contact`, and `/product`) if the platform rewrite remains unavailable.
- [ ] Verify the live Vercel root and direct public routes after redeployment.

- [ ] Apply the supplied Vercel proxy-to-backend deployment changes without committing a placeholder backend hostname.
- [ ] Keep the frontend working with relative `/api` requests through the Vercel proxy and preserve same-origin OAuth cookies.
- [ ] Document that a real HTTPS backend host and server environment variables are required before the proxy can be live.

- [x] Define Firebase-centered architecture: Authentication, Firestore, Storage, Cloud Messaging, and Cloud Run backend.
- [ ] Replace Manus OAuth and MySQL/Drizzle assumptions with Firebase Auth and Firestore contracts after the user confirms the Firebase project.
- [x] Prepare a step-by-step Firebase and Cloud Run setup guide covering billing, services, security rules, secrets, and Flutterwave webhooks.

- [x] Register the supplied Firebase web configuration for project `chadrey-wholesale` through environment-backed client settings.
- [x] Add Firebase client SDK and Firebase Admin SDK dependencies without exposing server credentials to the browser.
- [ ] Replace Manus OAuth session assumptions with Firebase ID-token authentication after the Firebase project credentials are complete.
- [ ] Replace MySQL/Drizzle data access with Firestore repositories for products, quotes, quotations, invoices, payments, orders, messages, and notifications.
- [x] Add Firestore security rules and Cloud Run/Firebase Hosting deployment notes.
- [x] Add a Firebase email/password sign-in and account-creation screen, route existing sign-in buttons to it when Firebase is configured, and preserve a temporary legacy fallback during migration.
- [x] Fix Firestore read ownership checks, tighten quote/invoice Storage access to owner/admin scope, document `ownerUid` and admin-claim assumptions, and add regression tests for the rules.
- [x] Make Firebase Auth the primary frontend session source, send fresh Firebase ID tokens through tRPC, and preserve legacy OAuth only as a temporary fallback.
- [x] Add a feature-flagged Firestore product repository that maps active product documents into the existing catalogue contract and preserves MySQL during the staged migration.
