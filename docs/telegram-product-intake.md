# Add products from Telegram

Send a photo to your own Telegram bot with the details as its caption. A few seconds later the product is in
your shop as a **hidden draft**. Nothing goes live until you approve it.

```
100ml Original sugar marshmallow
48,000 wholesale
55,000-60,000 Resell
```

The bot answers with what it understood, for example:

```
✅ Saved as a hidden draft
100ml Original sugar marshmallow
₦48,000 per pc · minimum order 1
Suggested resale: ₦55,000 – ₦60,000
Category: Uncategorised (set it in admin)

Review it: https://…/admin/products?status=hidden
```

## One-time setup (about 15 minutes)

You need Telegram on your phone, and to be signed in to Cloudflare and Supabase.

### 1. Create the bot (2 minutes)

1. In Telegram, search for **@BotFather** and open the chat with the blue tick.
2. Send `/newbot`. Give it a name (for example "Chadrey Products") and a username that ends in `bot`.
3. BotFather replies with a long **token**. Keep it private. Anyone with the token controls your bot.

### 2. Add the secrets in Cloudflare (5 minutes)

Cloudflare dashboard → **Workers & Pages** → **chadrey-wholesale** → **Settings** → **Variables and Secrets** → **Add**.
Choose the type **Secret** (not "Text") for each of these, then press **Deploy**:

| Name | What to put in it |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | The token from BotFather. |
| `TELEGRAM_WEBHOOK_SECRET` | Any long password you make up: at least 30 letters and numbers. Use only letters, numbers, `-` and `_` (Telegram accepts nothing else). |
| `SUPABASE_SERVICE_KEY` | Supabase → **Project Settings** → **API Keys** → the **secret** key (older projects: the `service_role` key under "Legacy API Keys"). |
| `TELEGRAM_ALLOWED_USER_IDS` | Leave this for step 4. |

> **Be careful with the Supabase key.** It can read and change everything in your database. Paste it only into
> Cloudflare's secret box. Never put it in a chat, an email, GitHub or the website's code.

### 3. Connect Telegram to your site (2 minutes)

Open this address in your phone or computer browser. Replace `YOUR_BOT_TOKEN` and `YOUR_WEBHOOK_SECRET` with your
two values (without any spaces):

```
https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://chadrey-wholesale.femiolaniyi36.workers.dev/api/telegram&secret_token=YOUR_WEBHOOK_SECRET
```

It should answer `{"ok":true,"result":true,"description":"Webhook was set"}`.

To check the setup at any time, open `https://chadrey-wholesale.femiolaniyi36.workers.dev/api/telegram`.
It shows `"ready":true` when everything is in place, or the names of the settings that are still missing
(never their values).

### 4. Add yourself (2 minutes)

1. Send any message to your bot. It answers *"Your Telegram ID is 123456789…"* and saves nothing.
2. In Cloudflare, put that number into the secret `TELEGRAM_ALLOWED_USER_IDS`. For several people, separate the
   numbers with commas: `123456789, 987654321`. Press **Deploy**.
3. Open the check address again. It should now show `"ready":true`.

### 5. Try it

Send a photo with the caption from the top of this page. When the bot confirms, open **Admin → Products**. A banner
says how many products are waiting for your OK.

## Writing the caption

* The **first line** is the product name. A size in the name is fine (`100ml`, `5 kg`).
* Prices can be written in the ways people really write them:
  `48,000 wholesale`, `Wholesale: ₦48,000`, `48k wholesale`, `#48,000` or `N48,000` (naira), `฿450`, `$12.50`.
  Thai labels work too: `ราคาส่ง` (wholesale), `ราคาปลีก` (retail).
* **Wholesale** becomes the price on the site, at the minimum order.
  **Resell** is kept in the description as "Suggested resale price", so buyers see what they can sell it for.
* Optional extra lines: `MOQ 24`, `per carton` after a price, `#perfume` or `Category: Perfume`,
  and anything else (for example `Colors: pink, white`) goes into the description.
* A banner line such as `NEW ARRIVAL 🔥` is ignored.
* When the caption does not say, the draft gets naira (₦), "per piece" and a minimum order of 1. These defaults live
  in `wrangler.jsonc` (`DEFAULT_CURRENCY`, `DEFAULT_UNIT`, `DEFAULT_MOQ`).
* The "Review it" link in the bot's reply uses the address the message came through. To point it at your main
  domain instead, add `SITE_URL` to `vars` in `wrangler.jsonc`.

The bot guesses the category from products you already have (it says which one it copied from). When it cannot
guess, the product stays **Uncategorised** and you choose a category when you approve it.

## More photos for one product

* Send the photos together as an **album**, with the caption on the first photo.
* Or **reply** to the bot's confirmation message with another photo. Photos can only be added to hidden drafts.

## Approving fast

**Admin → Products.** The orange banner says how many are waiting. Press **Review** (or open the link in the bot's
reply), then:

* tap products to tick them, or **Select all**,
* **Show N in store** makes them live. If some have no category you choose one first, and it is applied only to those,
* **Category** gives all ticked products one category, **Hide** takes live products off the site,
  **Delete** removes them with their photos (a product that is part of a quote request is kept),
* the small pencil opens a product to fix its name, price or photos.

Each row shows warnings: *No category*, *No price*, *No photo*.

## Good to know

* Only the people in `TELEGRAM_ALLOWED_USER_IDS` can add products. Anyone else only learns their own Telegram ID.
* Drafts are always hidden. Prices on the site stay indicative, as before.
* Telegram shrinks photos sent as normal photos (usually to a few hundred KB), which keeps the shop fast.
  A photo sent "as a file" keeps its full size and must be under 10 MB.
* If Telegram delivers the same message twice, only one product is made.
* If `supabase_product_pricing.sql` has not been run yet, the bot still saves the draft, puts the price in the
  description and tells you.

## If something does not work

| What you see | What to do |
| --- | --- |
| No answer from the bot at all | Open the check address. If it shows missing settings, add them. Then open `https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo`: `last_error_message` says what Telegram could not reach. |
| "Your Telegram ID is …" | You are not in `TELEGRAM_ALLOWED_USER_IDS` yet. Add the number and deploy. |
| "Supabase refused the key" | `SUPABASE_SERVICE_KEY` is wrong or from another project. Paste the secret key again. |
| "storage bucket was not found" | The `product-images` bucket is missing in Supabase. |
| The draft is there but has no photo | Reply to the bot's confirmation with the photo. |
| Anything else | Cloudflare → Workers & Pages → chadrey-wholesale → **Logs** shows what happened. |

To stop the bot, open `https://api.telegram.org/botYOUR_BOT_TOKEN/deleteWebhook`, or empty `TELEGRAM_ALLOWED_USER_IDS`.
If the token leaks, send `/revoke` to BotFather, then update `TELEGRAM_BOT_TOKEN` and repeat step 3.

## For developers

* `worker/` is the Cloudflare Worker (`worker/index.ts`). `run_worker_first: ["/api/telegram"]` in `wrangler.jsonc` wakes
  it only for that one address; every other address (including `/api/trpc`, used by older pages) is served from the
  built site exactly as before.
* `shared/productMessage.ts` reads the caption (tests in `shared/productMessage.test.ts`). It is plain TypeScript, so an
  import tool or an admin paste box can reuse it.
* The Worker writes with the Supabase **secret key**, which bypasses row-level security. That is why it only ever
  inserts hidden products and photos, never reads customer data, checks the webhook secret and the allow-list first, and
  keeps the key out of every reply and log line.
* A message maps to a fixed product id (hash of chat and message id), so redelivery and album photos find the right
  product without any extra table.
* Secrets are kept across deploys by Cloudflare. `keep_vars` stops a deploy from wiping variables added by hand.
  Do not add `secrets.required` to `wrangler.jsonc`: it would fail every deploy until the secrets exist.
* Local run: create `.dev.vars` (git-ignored) with the secrets and run `pnpm exec wrangler dev`.
  `TELEGRAM_API_BASE` and `SUPABASE_URL` can point at pretend servers; `worker/testkit.ts` is the pretend Telegram and
  Supabase used by the tests.
