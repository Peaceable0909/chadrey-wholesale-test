# Cloud Run Authentication and Backend Options

## Recommendation

Use the existing Express/tRPC backend on Google Cloud Run, replace Manus OAuth with Firebase Authentication, and keep a managed SQL database such as Supabase Postgres or another MySQL-compatible provider only if the existing Drizzle schema is migrated accordingly.

## Cost boundaries

Google Cloud Run has a monthly free tier based on region and billing account. The official pricing page lists, for request-based billing, 180,000 vCPU-seconds, 360,000 GiB-seconds of memory, and 2 million requests per month at no charge in the stated free-tier regions. A Google Cloud billing account is still required, and usage beyond the free tier can be billed.

The Google Cloud Free Trial provides $300 in credit for 90 days to eligible new customers, but requires a valid payment method for verification. The trial is not the same as a permanently costless production guarantee.

## Authentication options

Firebase Authentication is the strongest Google-native replacement for Manus OAuth. It supports email/password and social providers, and the backend can verify Firebase ID tokens using the Firebase Admin SDK. Admin/customer roles can be represented using custom claims or a server-side user profile table. Phone/SMS authentication should be avoided for a zero-cost design because SMS usage has separate limits and costs.

Supabase Auth is another viable option and offers a free plan, but it introduces a separate managed platform alongside Cloud Run. Its JWTs can be verified by the backend, and roles can be stored in Postgres. It is attractive if the project also migrates its database to Supabase Postgres.

A custom email/password system is possible but not recommended. It would require secure password hashing, email verification, password reset, rate limiting, session rotation, and abuse protection.

## Migration impact

Removing Manus OAuth is a material architecture change. The client authentication hook, OAuth redirect helpers, server context, user upsert flow, protected procedures, admin role checks, and authentication tests must be replaced. The backend deployment also needs Firebase or Supabase credentials and a database connection string.

## Sources

1. https://cloud.google.com/run/pricing
2. https://cloud.google.com/free/docs/free-cloud-features
3. https://firebase.google.com/docs/auth
4. https://firebase.google.com/docs/auth/limits
5. https://supabase.com/pricing
6. https://supabase.com/docs/guides/platform/billing-on-supabase
