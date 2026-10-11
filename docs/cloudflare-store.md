# Where the shop's products and photos live (Cloudflare)

Products, prices and photos are kept in Cloudflare. Sign-in, customer accounts, quote requests, orders and messages
are still in Supabase for now (they move later, see `todo.md`).

## The short version

| What | Where it lives | Notes |
| --- | --- | --- |
| Products, prices, photo records | Cloudflare **D1** database `chadrey-store` | Created in the Asia-Pacific region, close to your dealers. |
| Photo files | Cloudflare **R2** storage `chadrey-store-photos` | No fees for people viewing photos. |
| Smaller copies of photos | Made on demand by Cloudflare **Images**, then remembered | The first visitor to need a size triggers it; everyone after gets the saved copy. |
| Sign-in, accounts, quotes, orders, messages | Supabase (unchanged) | Moves in a later stage. |
| Telegram bot | The same Cloudflare Worker | See [telegram-product-intake.md](telegram-product-intake.md). |

Your old Supabase products and photos are **not touched or deleted**. They simply stop being used.

## What happens when someone opens the shop

1. The website files (pages, scripts, styles) come straight from Cloudflare, as before.
2. The product list comes from `/api/catalogue/…` (the Worker, reading D1). Every visitor shares one answer for
   30 seconds, so a busy day does not use up the database's free daily allowance. The price of that: **a change you make
   in the admin reaches shoppers within 30 seconds**.
3. Each photo comes from `/photos/…`. Cards ask for a small copy, the main picture on a product page asks for a bigger
   one, and a phone gets a smaller one than a desktop. Browsers keep photos for a year, because a photo's address never
   changes (a new photo always gets a new address).

## Who may change the shop

Every change in the admin (adding, editing, hiding, deleting, photos, the Telegram bot's drafts excepted) goes to
`/api/admin/…`. The website sends the signed-in person's Supabase session with it. The Worker asks Supabase one question
with that session: *"does this person's profile have the admin role?"* Supabase checks that the session is genuine before it
answers. The Worker holds **no secret key** for this: it only uses the public key that is already in the website.

If Supabase is paused (the free plan pauses a project after about a week with almost no activity) the admin screens say
so and tell you to press **Restore** in the Supabase dashboard. The shop itself keeps working, because shoppers never
need Supabase to see products.

Deleting a product asks Supabase (with your own session) whether it is part of a quote request. If it is, it is kept.
If Supabase cannot answer, **nothing is deleted**.

## Free-plan numbers (checked against Cloudflare's documentation in October 2026)

| | Free allowance | What happens at the limit |
| --- | --- | --- |
| Worker requests (shop data, photos, bot) | 100,000 a day | Cloudflare shows an error until midnight UTC. Website files do **not** count. |
| D1 database | 5 GB; 5 million rows read and 100,000 rows written a day | Database calls fail until midnight UTC. Nothing stored is lost. |
| R2 photo storage | 10 GB; 1 million writes and 10 million reads a month | Storage beyond 10 GB costs $0.015 per GB a month. Viewing photos is always free. |
| Resized photo copies | 5,000 different copies a month | Photos are shown at full size instead. Nothing breaks and nothing is charged. |

A rough guide, assuming about 100 products a week with 3 photos of about 300 KB each (your real photos may differ):
that is about 90 MB a week, so the free 10 GB lasts about two years.

The **$5/month Workers plan** removes the request and database limits. You will not need it for a long while, but if an
admin screen ever says the database "used up today's free allowance", that is the fix.

## Switching on for real (the first time)

1. **Merge the pull request** and wait for Cloudflare (and Vercel) to finish deploying.
2. **Supabase: let quote requests point at products that are not in Supabase.** Run this once in Supabase → SQL Editor
   (it only removes a link that would otherwise refuse new products):

   ```sql
   alter table public.quote_request_items drop constraint if exists quote_request_items_product_id_fkey;
   ```
3. **Admin → Products → "Copy now"** brings the products from the old store across, with their photos, ids, web
   addresses and dates. It is safe to press again: nothing is copied twice. If one product cannot be copied (a photo is
   missing in the old store, say) the others still are, the unfinished copy is removed again, and the message names the
   product and the reason. "Not now" hides the banner for this visit only.
4. Open the shop and check a product page.
5. **Telegram bot:** follow [telegram-product-intake.md](telegram-product-intake.md). If you already added
   `SUPABASE_SERVICE_KEY` to Cloudflare for the old bot, you can delete it: the bot no longer uses it.

`supabase_product_pricing.sql` is no longer needed. Prices are stored in the new database from the start.

## Backups

* Products and prices: `pnpm exec wrangler d1 export chadrey-store --remote --output=backup.sql` saves them to a file
  (sign in first with `pnpm exec wrangler login`).
* Photos live in R2. Your old photos also remain in Supabase until you remove that project.
* Do this before big changes. It takes seconds.

## If something does not work

| What you see | What it means / what to do |
| --- | --- |
| The shop shows sample products | The shop data service did not answer. Open `/api/catalogue/products` on your site: it should show `{"items":[…],"total":…}`. If it shows a web page, the Worker is not receiving that address: check `run_worker_first` in `wrangler.jsonc`, and on Vercel the rewrites in `vercel.json`. |
| An admin screen says "Please sign in again" | Your session ran out. Sign out and in. |
| "I couldn't reach the sign-in service" | Supabase is paused or down. Open the Supabase dashboard and press **Restore** if it is paused. |
| "used up today's free allowance" | See the table above. It resets at midnight UTC. |
| Photos are big/slow | The resizer may be over its monthly free allowance, or unavailable on a preview. Photos still show, at full size. |
| A product will not delete | It is part of a quote request. Hide it instead. |
| The "Copy now" banner never goes away | A product could not be copied (for example a photo could not be downloaded). The message names it and says why. Fix that (or delete the product in the old store) and press the button again. |

## Running it on your computer

```
pnpm install
pnpm build
pnpm exec wrangler dev        # http://localhost:8787, with an empty local database and photo storage
pnpm test                     # includes tests that run against a real local D1 and R2
```

The database tables are created by the Worker the first time it runs. The local copy lives in `.wrangler/` and is
safe to delete.

## Branch previews

Every branch gets its own preview address from Cloudflare. A preview uses its **own empty test database and photo
storage** (`chadrey-store-preview`, `chadrey-store-photos-preview`), so trying out a change can never touch the real
shop, and the Telegram bot has no keys there. The Vercel copy of a branch passes shop addresses to the real Worker,
so use the Cloudflare preview address when you want to test changes safely.

## For developers

| File | What it does |
| --- | --- |
| `worker/schema.ts` | Every database change, in order. The Worker applies what is missing on first use. **Add new changes to the end; never edit an old one.** |
| `worker/store.ts` | Products, photos, search, bulk changes. D1 allows 100 values per statement, so id lists are cut into groups of 80. |
| `worker/api.ts` | `/api/catalogue/*` (open) and `/api/admin/*` (administrators). Checks everything an administrator typed. |
| `worker/adminAuth.ts` | The "is this an administrator" check described above, and the "is this product in a quote request" check. |
| `worker/photos.ts` | Stores photos (checks they really are pictures) and serves `/photos/*` with smaller copies. |
| `worker/intake.ts` | The Telegram bot. |
| `client/src/lib/shopApi.ts` | How the website talks to the Worker (adds the signed-in session, retries once if it just ran out). |
| `client/src/lib/legacyCopy.ts` | The "Copy now" tool. Remove it, `LegacyCopyCard`, and the old Supabase product tables when Stage 3 switches Supabase off. |

* D1 refuses a `LIKE` or `GLOB` pattern longer than **50 bytes**, which a long product name or search easily exceeds.
  Search therefore uses `instr(lower(column), lower(?))` and the free-web-address lookup uses a range test; do not
  reintroduce `LIKE` with text a person typed. The local test database enforces the same limit
  (`strictLikeLimit` in `worker/testEnv.ts`), so a mistake fails the tests instead of the live shop.
* Shopper answers are remembered for 30 seconds in Cloudflare's per-data-centre memory (`caches.default`), under a
  cleaned-up address (only the parts that change the answer, in a fixed order, page number capped at 200) so that extra
  or reordered parts of an address cannot bypass it. The `x-shop-cache` header on `/api/catalogue/*` says `hit`, `miss`
  or `off`; request the same address twice to check. The optional setting `SHOP_CACHE_SECONDS` changes the 30 seconds (`0` turns sharing off). On the `workers.dev` address it works (checked on a real preview:
  `miss`, then `hit`).
* Rows keep the shape Supabase used (snake_case fields, a nested `product_images` list, `public_url`), so
  `mapProductRow` in `client/src/lib/catalogue.ts` did not change.
* Photos are named `products/<product id>/<photo id>.<kind>` and never overwritten, which is why they can be cached
  for a year.
* Tests: `worker/*.test.ts` run against a real local D1 and R2 (`worker/testEnv.ts`, using wrangler's local
  simulation); `worker/testAuth.ts` is the pretend Supabase.
* Two older tests (`server/supabase.config.test.ts`, `client/src/lib/apiEndpoint.test.ts`) call live services and fail
  unless `SUPABASE_URL`/`VITE_API_URL` are set. They do not depend on this change.
