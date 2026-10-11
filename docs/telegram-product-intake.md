# Add products from Telegram

Send a photo to your own Telegram bot with the details as its caption. A few seconds later the product is in
your shop as a **hidden draft**. Nothing goes live until you approve it. With [AI drafting](#let-ai-write-the-rest-optional)
switched on, a few words (or none) are enough: the bot writes the description, picks the category and notes the colours.

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
Resell range: ₦55,000 – ₦60,000 (not saved on the product)
Category: Uncategorised (set it in admin)

Review it: https://…/admin/products?status=hidden
```

## One-time setup (about 10 minutes)

You need Telegram on your phone and to be signed in to Cloudflare. The shop's products and photos already live in
Cloudflare (see [cloudflare-store.md](cloudflare-store.md)), so the bot needs no other service and no database key.

### 1. Create the bot (2 minutes)

1. In Telegram, search for **@BotFather** and open the chat with the blue tick.
2. Send `/newbot`. Give it a name (for example "Chadrey Products") and a username that ends in `bot`.
3. BotFather replies with a long **token**. Keep it private. Anyone with the token controls your bot.

### 2. Add the secrets in Cloudflare (4 minutes)

Cloudflare dashboard → **Workers & Pages** → **chadrey-wholesale** → **Settings** → **Variables and Secrets** → **Add**.
Choose the type **Secret** (not "Text") for each of these, then press **Deploy**:

| Name | What to put in it |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | The token from BotFather. |
| `TELEGRAM_WEBHOOK_SECRET` | Any long password you make up: at least 30 letters and numbers. Use only letters, numbers, `-` and `_` (Telegram accepts nothing else). |
| `TELEGRAM_ALLOWED_USER_IDS` | Leave this for step 4. |

> Paste the token only into Cloudflare's secret box. Never put it in a chat, an email, GitHub or the website's code.

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

## Let AI write the rest (optional)

With AI drafting on, you can send a photo with **just a name, or no words at all**. The bot saves the draft at once, then a few
seconds later changes its reply to show what the AI wrote:

```
✅ Saved as a hidden draft
Premium lunch box
No price yet · minimum order 1
Category: Bags (suggested by AI)
Colours: beige, black, pink, blue (seen in the photo)

✨ Written by AI from your photo. Please check it before you show it in the store:
A quilted two-layer lunch bag with a shoulder strap.

A quilted lunch bag with two zip compartments and a padded top handle. …
```

**What it writes:** a short summary and a description (from the photo and your words), a category (only one you already
use, or none), the colours it can clearly see, and a name when you sent none.

**What it never does:** it never sets the price, the currency, the minimum order, or anything about stock or delivery: those come
only from what you type. It is told never to invent materials, sizes, brands or certificates, and any line about a price, a minimum
order, stock or delivery that slips into its text is removed. It writes only on a draft that is still hidden and still exactly as the bot
saved it, so it can never overwrite something you changed in the meantime or touch a product that is already live. If it fails, you get the
draft exactly as you typed it, with a note saying why. Your own extra lines (colours, sizes, remarks) are kept under the AI's text exactly
as typed.

### Switch it on (about 5 minutes)

The AI comes from [Puter](https://puter.com), which needs no API key: the AI is paid from the free monthly allowance of the Puter account
whose token you use, and from credit you buy there after that. The shop pays nothing to anyone else.

1. Sign in at puter.com (a free account is enough). Tip: use an account made only for the shop, because the token can act as that account.
2. Open **puter.com/dashboard#account**, find **API token** and press **Create token**. The token is copied for you.
3. In Cloudflare, go to **Workers & Pages → chadrey-wholesale → Settings → Variables and Secrets → Add**. Choose the type **Secret**, name it
   `PUTER_AUTH_TOKEN`, paste the token, and press **Deploy**. Never put the token in a chat, an email or GitHub.
4. In Telegram, send `/ai` to your bot. It answers *"✅ AI drafting works"*, or tells you what Puter said.
5. Send a photo with a few words.

The setup page (`…/api/telegram`) shows `"ai":true` once the token is in place (never the token itself).

### Cost, privacy and limits

* **Cost:** the default model, `claude-haiku-5-5`, is the smallest Claude model. Puter passes its list price through, about
  **$0.10 per million tokens read and $0.50 per million written** (a token is about three quarters of a word, and a photo is
  roughly 1,000 tokens), which is a **fraction of a cent per product**. You can watch the usage at puter.com/dashboard#usage. When the
  monthly allowance is used up the bot says so and goes back to saving drafts as you type them.
* **Better wording:** add a variable (type **Text**, not Secret) named `AI_MODEL` with another model name from Puter's list, for example
  `claude-sonnet-5-5`. That costs about twenty times more per product. Remove the variable to go back to the default.
* **Privacy:** the photo (shrunk to 768 pixels wide) and the words you typed, without the prices, are sent to Puter and to the company that runs
  the model, only to write the draft. Nothing else from the shop is sent.
* **Limits:** a free Puter account allows 30 AI requests per 10 seconds and 3 at once, far more than a person sending photos needs.
* **Switch it off:** delete the secret `PUTER_AUTH_TOKEN`. Revoke the token itself at puter.com/dashboard#account if it ever leaks.

## Writing the caption

* The **first line** is the product name. A size in the name is fine (`100ml`, `5 kg`).
* Prices can be written in the ways people really write them:
  `48,000 wholesale`, `Wholesale: ₦48,000`, `48k wholesale`, `#48,000` or `N48,000` (naira), `฿450`, `$12.50`.
  Thai labels work too: `ราคาส่ง` (wholesale), `ราคาปลีก` (retail).
* **Wholesale** becomes the price on the site, at the minimum order.
  **Resell** is only echoed back in the bot's reply. It is not saved on the product, so buyers never see it.
* Optional extra lines: `MOQ 24`, `per carton` after a price, `#perfume` or `Category: Perfume`,
  and anything else (for example `Colors: pink, white`) goes into the description.
* A banner line such as `NEW ARRIVAL 🔥` is ignored.
* Without AI the first line must be the name. With AI on, a photo with no words, or with only a price, is named by the AI.
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
  A photo sent "as a file" keeps its full size and must be under 10 MB and a real picture (JPEG, PNG, WebP or GIF).
* If Telegram delivers the same message twice, only one product is made.
* Photos are shown at a size that fits the screen, made on demand by Cloudflare, so a full-size photo is never sent
  to a phone that shows it as a small card.

## If something does not work

| What you see | What to do |
| --- | --- |
| No answer from the bot at all | Open the check address. If it shows missing settings, add them. Then open `https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo`: `last_error_message` says what Telegram could not reach. |
| "Your Telegram ID is …" | You are not in `TELEGRAM_ALLOWED_USER_IDS` yet. Add the number and deploy. |
| The check address lists `DB` or `PHOTOS` as missing | The Worker is not connected to the shop's database or photo storage. This only happens on a branch preview. On the real address it means a deploy went wrong: see [cloudflare-store.md](cloudflare-store.md). |
| "used up today's free allowance" | The shop's free database allowance for the day is spent. It starts again at midnight UTC. The $5/month Workers plan removes the limit. |
| The draft is there but has no photo | Reply to the bot's confirmation with the photo. If it keeps failing, the file may not be a real picture. |
| "AI drafting is off" after `/ai` | The secret `PUTER_AUTH_TOKEN` is missing. Add it (see above) and press **Deploy**. |
| "Puter did not accept the token" | The token was copied wrongly or has been revoked. Create a new one at puter.com/dashboard#account and replace the secret. |
| "your Puter allowance for AI is used up" | The monthly allowance is spent. It renews every month, or add credit at puter.com. Drafts are still saved as you type them. |
| "that AI model needs a paid Puter plan" | The model named in `AI_MODEL` is for paying Puter users. Delete that variable (the default works on a free account) or choose another model. |
| "Puter is busy" / "took too long" | Try again in a minute. The draft is already saved. |
| "the AI's answer could not be used" | The model answered in a form the bot could not read. Send the photo again; if it keeps happening, tell the developer which photo. |
| Anything else | Cloudflare → Workers & Pages → chadrey-wholesale → **Logs** shows what happened. |

To stop the bot, open `https://api.telegram.org/botYOUR_BOT_TOKEN/deleteWebhook`, or empty `TELEGRAM_ALLOWED_USER_IDS`.
If the token leaks, send `/revoke` to BotFather, then update `TELEGRAM_BOT_TOKEN` and repeat step 3.

## For developers

* `worker/` is the Cloudflare Worker (`worker/index.ts`). `run_worker_first` in `wrangler.jsonc` wakes it only for the
  bot (`/api/telegram`), the shop's data (`/api/catalogue/*`, `/api/admin/*`) and photos (`/photos/*`); every other
  address (including `/api/trpc`, used by older pages) is served from the built site exactly as before.
* `shared/productMessage.ts` reads the caption (tests in `shared/productMessage.test.ts`). It is plain TypeScript, so an
  import tool or an admin paste box can reuse it.
* The bot saves through the same `worker/store.ts` and `worker/photos.ts` as the admin screens, using the Worker's own
  D1 and R2 bindings. No external service and no key are involved, so there is nothing for it to leak. It only ever
  inserts hidden products and photos, never reads customer data, checks the webhook secret and the allow-list first, and
  keeps the bot token out of every reply and log line.
* A message maps to a fixed product id (hash of chat and message id), and a Telegram photo to a fixed photo id, so
  redelivery and album photos find the right product without any extra table.
* AI drafting (`worker/draftAi.ts`, `worker/puter.ts`, the second step of `createDraft` in `worker/intake.ts`): the draft is saved first, exactly as
  without AI, and the Telegram webhook is answered at once. The AI then runs inside `ctx.waitUntil` (about 30 s of budget in total, so
  the AI call is cut off after 16 s) and fills the draft with `applyDraftText`, a single `UPDATE` that only matches a draft that is still
  hidden and unchanged. The first reply is changed with `editMessageText` (a new message when that fails). A photo with no usable name is
  the one exception: the AI is asked before saving, because the product needs a name for its web address; albums are never named that way
  because their other photos would arrive while the AI is still thinking. The AI sees the name and the owner's other lines, never the price
  or the minimum order, and its answer is read as strict JSON, trimmed, capped, stripped of links, HTML and markdown, and any line that states
  a price, a minimum order, stock or delivery is dropped (`parseAiAnswer`). It may only choose a category the shop already has.
* Puter has no SDK that runs in a Worker, so `puterChat` sends the request Puter.js 2.6.4 sends: `POST https://api.puter.com/drivers/call` with
  `{interface: "puter-chat-completion", driver: "ai-chat", method: "complete", args: {messages: [{content: [prompt, {image_url: {url}}]}], model,
  max_tokens, normalize: true, vision: true}, auth_token}` (content type `text/plain;actually=json`; the token is also sent as a Bearer header).
  Puter's OpenAI- and Anthropic-compatible endpoints need a paid Puter plan; `/drivers/call` works on a free account. No sampling options are
  sent, because current Claude models reject non-default values. The tests use a pretend Puter (`worker/testkit.ts`, and `PUTER_API_ORIGIN` in
  the browser tests); the live Puter has to be tried once with `/ai` after the token is added.
* `PUTER_AUTH_TOKEN` is a secret (never in `wrangler.jsonc`); `AI_MODEL` is an optional plain variable. Errors and logs never contain the token.
* Branch previews do not inherit production settings or secrets (Cloudflare's design). A preview has its own empty test
  database and photo storage, and `/api/telegram` reports "not set up" there, so a preview can never write to the real
  shop. The bot only works on the production address.
* Secrets are kept across deploys by Cloudflare. `keep_vars` stops a deploy from wiping variables added by hand.
  Do not add `secrets.required` to `wrangler.jsonc`: it would fail every deploy until the secrets exist.
* Local run: `pnpm build && pnpm exec wrangler dev` serves the site and the Worker on http://localhost:8787 with a
  local, empty copy of the database and photo storage. Put the bot secrets in `.dev.vars` (git-ignored) and point
  `TELEGRAM_API_BASE` at a pretend Telegram if you want to try it without the real one.
  `worker/testkit.ts` is the pretend Telegram used by the tests; the tests use a real local D1 and R2 (`worker/testEnv.ts`).
