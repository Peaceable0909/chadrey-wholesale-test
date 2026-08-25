# Chadrey Wholesale Firebase + Cloud Run Setup Guide

## 1. Firebase project configuration

Use the Firebase project **`chadrey-wholesale`**. In Firebase Console, set the public-facing project name to **Chadrey Wholesale** and configure the support email that customers should use. Under **Authentication → Sign-in method**, enable **Email/Password**. Google sign-in is optional and is not required for the web application’s first release.

Under **Project settings → General → Your apps**, register a Web app and keep the following browser configuration in the hosting provider’s environment variables:

| Environment variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` | Browser SDK API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Optional Analytics measurement ID |

These `VITE_` values are browser configuration, not service-account credentials. Never place a Firebase service-account private key in the client bundle.

## 2. Local development and Vercel

For local development, place the same `VITE_FIREBASE_*` names in an uncommitted `.env.local` file at the repository root. For Vercel, add them under **Project → Settings → Environment Variables** for Production, Preview, and Development, then redeploy. The current application uses the Firebase SDK when these variables are present and retains a temporary legacy fallback until the Firestore migration is complete.

## 3. Cloud Run backend credentials

Deploy the Express/tRPC server as a Cloud Run service named **`chadrey-wholesale-api`** in **`us-central1`**, or update `firebase.json` if a different service name or region is selected. Prefer Cloud Run’s Application Default Credentials for Firebase Admin SDK access. Grant the service account the minimum required Firebase and Firestore permissions.

Configure server-only variables through Cloud Run environment variables or Google Secret Manager:

| Secret or variable | Required use |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase Admin project selection; use `chadrey-wholesale` |
| `FLUTTERWAVE_SECRET_KEY` | Server-side Flutterwave API verification and checkout |
| `FLUTTERWAVE_WEBHOOK_HASH` | Webhook signature validation |
| `VITE_API_URL` | Leave empty for Firebase Hosting same-origin `/api` routing, or set to a verified HTTPS backend origin |
| `FIRESTORE_PRODUCTS_ENABLED` | Set to `true` only after active product documents have been imported into Firestore; defaults to MySQL during the staged migration |

Do not commit `.env` files, service-account JSON, private keys, Flutterwave secrets, or webhook hashes.

## 4. Firebase Hosting

Build the frontend with `pnpm build`. The generated static directory is `dist/public`. The checked-in `firebase.json` routes `/api/**` to the Cloud Run service and sends all other paths to `index.html` for the React application. Deploy Hosting only after the Cloud Run service exists and the service permits requests from Firebase Hosting’s proxy path.

The intended production topology is:

```text
Browser → Firebase Hosting → /api/** → Cloud Run Express/tRPC → Firebase Admin SDK → Firestore
                                      └→ Flutterwave verification API
```

## 5. Firestore collections and security

The migration uses these top-level collections: `users`, `products`, `quoteRequests`, `quotations`, `invoices`, `payments`, `orders`, `messages`, `notifications`, and `deviceTokens`. The first staged application switch is `FIRESTORE_PRODUCTS_ENABLED=true`, which routes catalogue reads through Firestore while the remaining transactional collections continue using the existing repository until their contracts are migrated. Customer-owned documents must include `ownerUid` with the Firebase Authentication UID. Admin authorization must be based on a verified Firebase Admin custom claim or server-side profile; the browser must not be trusted for role decisions.

The repository includes `firestore.rules` and `storage.rules`. Review the rules against the final document shapes before deploying them. Product reads are public, customer documents are owner-scoped, and administrative writes require the verified `admin` claim.

## 6. Firebase Authentication request flow

The browser signs in with Firebase email/password authentication. The Firebase client obtains an ID token, and the tRPC client sends it as `Authorization: Bearer <ID_TOKEN>`. Cloud Run verifies the token with Firebase Admin SDK before resolving the application user and role. Logout must sign out the Firebase client session; legacy cookie cleanup remains only for the transition period.

## 7. Flutterwave webhook configuration

After the Cloud Run service is deployed, configure Flutterwave’s webhook URL as:

```text
https://<cloud-run-service-url>/api/webhooks/flutterwave
```

If Firebase Hosting is the public origin, use:

```text
https://<your-hosting-domain>/api/webhooks/flutterwave
```

The server must validate the configured webhook hash, verify the transaction directly with Flutterwave, match invoice amount and currency, reject duplicate transaction delivery, persist the payment before marking the invoice paid, and create or update the order only after successful verification. Never mark an invoice paid from an unverified browser redirect.

## 8. Recommended deployment order

First enable Firebase Authentication and create the Web app. Next create Firestore and Storage, review and deploy the security rules, and create the Cloud Run service account. Then configure Cloud Run server secrets, deploy the backend, and test `/api/trpc` with a Firebase ID token. Deploy Firebase Hosting after the Cloud Run service is reachable. Finally set the Flutterwave webhook URL, send a controlled test transaction, and verify the signature, transaction lookup, idempotency, payment record, invoice state, order state, and notification path.

## 9. Cost controls

Cloud Run requires a Google Cloud billing account even when usage may remain within free allowances. Configure a budget alert, avoid phone/SMS authentication during the initial launch, keep product assets optimized, and monitor Firestore reads and Storage usage. Payment provider charges remain separate from Firebase and Cloud Run costs.
