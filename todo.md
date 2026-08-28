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

- [x] Add protected admin product creation form with required catalogue fields and dark-green design consistency.
- [x] Add multi-image product selection/upload workflow with primary-image selection and validation.
- [x] Persist new products to Firebase/Firestore through an admin-only server mutation and cover it with tests.

- [x] Remove visible Manus sign-in wording from customer, admin, payment, and shared authentication entry points.
- [x] Ensure configured Firebase environments never redirect users to the Manus OAuth portal.

- [x] Redeploy the current Firebase-only authentication changes to the connected Vercel production project and verify `/dashboard` no longer displays the stale Manus sign-in screen.

- [x] Add Google sign-in as a second Firebase Authentication option alongside email/password login.
- [x] Add authentication tests or pure helper coverage for Google provider availability and error handling.
- [x] Verify the live Vercel login page serves the Firebase email/password form and `Continue with Google` button after redeployment.

- [ ] Make the home page admin access link/button prominent and directly reachable.
- [ ] Fix Firebase admin sign-in flow and distinguish admin authentication failures from customer access failures.
- [ ] Enforce separate admin/customer dashboard routing and role-based views after Firebase sign-in.
- [ ] Re-verify the admin product image workflow supports 10+ images and explicit main-image selection.

- [ ] Keep the admin login entry hidden from the home page and accessible only through a separate admin URL.
- [ ] Fix Firebase admin sign-in flow and error handling without reintroducing the legacy local-password or Manus login system.
- [ ] Enforce distinct admin and customer dashboard views after Firebase sign-in.
- [ ] Re-verify the optional 10-plus-image product workflow and explicit main-image selection.

- [x] Verify `/admin/login` is reachable as a separate hidden route and does not appear in the public home navigation.
- [ ] Verify successful Firebase administrator authentication routes to the operations dashboard.
- [ ] Verify regular customer accounts cannot access the admin dashboard and retain the customer workspace.
- [x] Add the dedicated `/admin/login` route, route unauthenticated admin pages to it, prevent public home exposure, and generate direct Vercel entrypoints for `/admin/login` and `/admin/products/new`.
- [x] Fix admin login role verification to use the freshly fetched Firebase user profile and show a safe configuration message instead of crashing when Firebase variables are absent.

- [ ] Diagnose why the live Firebase admin login cannot authenticate and reach the role-protected operations dashboard.
- [ ] Verify the deployed Firebase configuration, enabled providers, backend token verification, and administrator role mapping.
- [ ] Add a clear user-facing error state for configuration, provider, credential, and role failures.

- [ ] Verify Google provider is enabled and the Vercel domain is authorized in Firebase Authentication.
- [ ] Verify the signed-in Google account’s Firebase UID is mapped to the project’s admin role.
- [ ] Confirm Google admin sign-in reaches `/admin` without exposing customer access or private credentials.

- [x] Add a root `Dockerfile` compatible with the existing Express/Cloud Run production build and runtime.
- [ ] Validate Cloud Run container start behavior with the platform-provided `PORT` and push the Dockerfile to GitHub main.
- [ ] Redeploy Cloud Run and connect its public URL to the Vercel frontend API target.

- [ ] Correct the Cloud Build trigger so it fetches GitHub commit `f455c35d` or the current `main` branch containing the root Dockerfile.
- [ ] Rerun the build and confirm `/workspace/Dockerfile` is discovered before configuring Cloud Run and Vercel API routing.

- [ ] Promote Firebase UID `hmCLDJP0Png1x1IOGtNZxJdXjcH3` to administrator in the active backend role store, after confirming the account exists there.
- [ ] Retest the Google admin login after role promotion and verify redirection to `/admin`.

- [ ] Trace why Cloud Run returns a non-admin profile for the Google UID already promoted to `admin`.
- [ ] Verify the deployed Cloud Run revision uses the same Firebase project and database as the Vercel frontend and local role update.
- [x] Configure the project API target for the live Cloud Run URL and verify the public tRPC auth endpoint responds successfully.

- [ ] Add a server-only administrator UID allowlist configuration for the supplied Firebase account, without exposing the allowlist to the browser.
- [ ] Cover the UID allowlist role decision with unit tests and document the required Cloud Run environment variable.

- [ ] Verify Vercel Production has `VITE_API_URL` set to the live Cloud Run URL and that the latest deployment includes it.
- [ ] Verify Cloud Run has `FIREBASE_ADMIN_UIDS=hmCLDJP0Png1x1IOGtNZxJdXjcH3` on the active revision and redeploy if missing.
- [ ] Retest Google admin login after both deployed environment settings are confirmed.

- [ ] Diagnose why regular Firebase users cannot complete sign-in, independent of admin-role authorization.
- [ ] Verify the deployed Vercel Firebase configuration and Cloud Run API target used by the login build.
- [ ] Verify Firebase Admin token verification and user-profile upsert for a normal customer account.
- [ ] Add clear login error messaging that identifies provider, configuration, network, and profile failures.

- [ ] Reset the immediate delivery scope to one Firebase login, one hosting target, and one explicit admin access rule; defer payment, messaging, and complex migration work until the baseline is stable.
- [ ] Confirm whether the simple target should be Firebase Hosting only or Vercel plus Cloud Run before changing deployment configuration.

- [ ] Use Vercel as the sole immediate hosting target for the Firebase login baseline.
- [ ] Defer Cloud Run API integration and complex backend migration until Vercel Firebase login is stable.

- [ ] Push the latest Firebase/Firestore login and role-resolution changes to GitHub `main` and verify the remote commit.

- [ ] Fix the customer login path so a successfully authenticated regular user is not sent back to the generic sign-in gate.
- [ ] Fix the administrator Firestore profile read path so the approved admin document can be read safely.
- [ ] Add regression coverage for customer profile creation and admin profile resolution without weakening role security.

- [x] Evaluate whether the available Supabase connection can replace Firestore and Cloud Run for user roles and business data.
- [x] Confirm the Supabase project ID and available tables before changing the data access layer.

- [x] Use Supabase project `pysfxmosoijbghfzfhge` as the new Chadrey backend target.
- [x] Confirm Supabase project connectivity and inspect existing tables before applying schema changes.
- [x] Replace Firebase/Firestore login and role resolution with Supabase Auth and a protected profiles/roles table.
- [x] Migrate product image metadata to Supabase Storage and keep the 10-plus-image/main-image workflow.
- [ ] Keep Vercel as the frontend hosting target and remove the immediate Cloud Run dependency.

- [x] Fix deployed Vercel error: `Supabase is not configured for this environment` on the sign-in screen.
- [x] Verify the built frontend exposes the required Supabase URL and public key variables without exposing service-role credentials.
- [x] Validate `/login` and `/admin/login` after the configuration fix and document the required Vercel environment-variable scope.

- [x] Fix authenticated Supabase administrator accounts landing in the customer dashboard instead of the operations portal.
- [x] Verify `profiles.role` resolution and keep regular customer accounts blocked from `/admin`.
- [x] Add regression coverage for admin redirect and customer/admin dashboard separation.

- [x] Add an admin user-management section listing registered profiles and allowing secure role changes.
- [x] Fix admin portal controls and navigation so buttons and links are interactive rather than placeholders.
- [x] Make the admin portal responsive on desktop, tablet, and mobile layouts.
- [x] Add tests for admin-only user listing, protected role changes, and preventing unsafe self-demotion.

- [x] Remove hardcoded seed quote, order, notification, and KPI content from customer/admin screens without deleting real database records.
- [x] Replace non-live admin navigation and sections with working live routes or explicit unavailable states.
- [x] Audit and replace the homepage hero image with a verified available asset.
- [x] Validate the cleaned UI at public and admin routes on desktop and mobile.

- [ ] Audit every visible button, link, card, icon action, and admin/analytics navigation item for dead ends.
- [x] Connect each public and customer card/button to a real route or working action.
- [x] Connect each admin and analytics card/button to live data or a useful detail view.
- [ ] Add interaction regression coverage and verify all audited surfaces on desktop and mobile.

- [x] Apply the agreed customer and admin flow architecture to the active application routes and workflows.
- [x] Expand the Supabase schema for profiles, catalogue, quote lifecycle, quotations, invoices, payments, orders, messaging, notifications, and auditability.
- [x] Add and verify RLS policies for customer ownership, administrator access, role changes, and storage uploads.
- [x] Create an admin dashboard wireframe/component breakdown tied to real routes and actions.
- [x] Add tests and save a checkpoint after validating the architecture implementation.

- [x] Fix admin product creation so product and image uploads complete reliably instead of appearing unresponsive.
- [x] Add animated loading/progress feedback during image uploads and final product submission.
- [x] Add actionable upload error and retry states, then validate the complete upload flow.

- [x] Change the product image minimum from 10 to 2 across validation, copy, and upload UI.
- [x] Add secure admin product listing, edit, and delete actions for Supabase products and image metadata.
- [x] Add product-description formatting controls for bold text and bullet points with safe rendered output.
- [x] Validate product management, formatted descriptions, image cleanup, and role boundaries.

- [x] Make the entire product card on `/products` open the matching product detail page.
- [x] Add separate short catalogue description and full product-page description fields for products.
- [x] Render the short description in catalogue cards and the full description on product detail pages.
- [x] Ensure detail-page quote/cart actions carry the selected product and options into the request flow.
- [x] Validate all product IDs, Supabase products, fallback products, and direct detail routes.

- [x] Make the full catalogue product card open the exact selected product slug, including keyboard activation.
- [x] Stop unknown product slugs from silently rendering the unrelated default product.
- [x] Load and display all Supabase product images on the matching detail page with selectable thumbnails.
- [x] Preserve the selected product’s short/full descriptions and quote options on the detail route.
- [x] Validate product-specific navigation, image galleries, and not-found states on desktop and mobile.

- [x] Make every catalogue card navigate to its exact product slug, including keyboard activation
- [x] Load all product-specific Supabase images on the detail page with selectable thumbnails
- [x] Prevent unknown product slugs from rendering an unrelated fallback product
- [x] Verify product discovery and detail gallery behavior on desktop and mobile

- [x] Reorganize the admin products page into a compact, scannable catalogue with bounded image previews and concise product summaries
- [x] Add a clear admin product edit panel with grouped fields, compact spacing, and mobile-safe controls
- [x] Design the quote request flow around a prominent free-form requirements field, optional product attributes, and preferred product-image selection
- [x] Add admin visibility for submitted quote requirements, selected images, and optional attribute choices
- [x] Validate the revised customer quote and admin products layouts on desktop and mobile

- [x] Add customer upload for an additional reference image or file with secure storage metadata
- [x] Add editable labels for product images so customers can identify designs or variations
- [x] Add explicit per-product option toggles for sizes, colours, variants/forms, packaging, and customization
- [x] Add a clear pre-submit quote summary covering product, image/design, quantity, options, and requirements
- [x] Show reference files, image labels, and complete quote summaries in My Quotes and admin quote management
- [x] Revalidate the clarified quote workflow on desktop and mobile, then push the final changes to GitHub main

- [x] Add an animated quote-submission success confirmation with clear next-step messaging and reduced-motion support
