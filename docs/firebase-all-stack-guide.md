# Chadrey Firebase-Centered Architecture

## Recommended topology

Use Firebase Hosting for the React frontend, Firebase Authentication for customer/admin sign-in, Cloud Firestore for products, quotes, quotations, invoices, payments, orders, messages, and notifications, Firebase Storage for product and document files, Firebase Cloud Messaging for owner/customer push notifications, and Google Cloud Run for the existing Express/tRPC backend and Flutterwave webhook handler.

Firebase Hosting can proxy `/api/**` to the Cloud Run service so the browser keeps one origin. This avoids the cross-domain cookie problem that occurs when Vercel and a separate backend are used directly.

## Authentication

Replace Manus OAuth with Firebase Authentication using email/password first. Add Google sign-in later if desired. The browser signs in with the Firebase client SDK, receives an ID token, and sends it to the Express backend in an Authorization header. Cloud Run verifies the token with the Firebase Admin SDK. Customer/admin roles should be stored in a Firestore user profile and optionally mirrored in Firebase custom claims for fast authorization.

## Data model

Recommended top-level Firestore collections are `users`, `products`, `quoteRequests`, `quotations`, `invoices`, `payments`, `orders`, `messages`, `notifications`, and `deviceTokens`. Each customer-owned document must include a `customerId` or `ownerUid`. Admin-only writes should be performed by the Cloud Run backend after verifying an admin claim; the browser should not be trusted for role decisions.

## Payments and webhooks

Flutterwave secrets must remain in Cloud Run environment variables or Secret Manager. The Flutterwave webhook should point to the Cloud Run public HTTPS endpoint or a Firebase Hosting rewrite to that endpoint. The backend must verify the webhook signature, verify the transaction with Flutterwave, match invoice amount/currency/reference, reject duplicate delivery, write the payment and order update atomically where possible, and then create notifications.

## Cost notes

Cloud Run has a monthly free allowance but requires a Google Cloud billing account, and usage above the free tier can be billed. Firebase services have product-specific quotas and plans. Avoid Firebase phone/SMS authentication for the zero-cost path. Start with email/password authentication, Firestore, Storage, and Hosting, then monitor usage and set budget alerts.

## Sources

1. https://firebase.google.com/docs/auth
2. https://firebase.google.com/docs/firestore/data-model
3. https://firebase.google.com/docs/firestore/security/get-started
4. https://firebase.google.com/docs/storage
5. https://firebase.google.com/docs/admin/setup
6. https://firebase.google.com/docs/cloud-messaging
7. https://cloud.google.com/run/pricing
