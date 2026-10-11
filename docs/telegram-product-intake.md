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
only from what you type. The AI is not shown a line of yours that looks like a price, an order size, stock or delivery, and it is told
never to invent materials, sizes, brands or certificates. Every sentence of its text that talks about a price, a minimum order, stock,
delivery, a phone number or a website is removed (one bad sentence costs only that sentence, not the draft). The colours it adds are plain
colour names only, because they become options a shopper can pick, so **look at them in Admin before you show the product**. No filter
catches everything, which is why every draft stays hidden until you have read it.

It writes only on a draft nobody has touched since the bot saved it: still hidden, and nothing changed in Admin, not even the price. So
it can never overwrite something you changed in the meantime or touch a product that is already live. If it fails, you get the draft exactly as
you typed it, with a note saying why. Your own extra lines (colours, sizes, remarks) are kept under the AI's text exactly as typed.

If a draft keeps saying *"Writing the description…"*, or the AI had a problem, **reply to that message with the word `redo`** and the bot tries
again (only for a draft that is still hidden and untouched). Write the word, not `/redo`: a `/command` inside a message turns into a link that
cannot reply.

### Which AI

The bot can ask **Alibaba Cloud's Qwen** models directly (the recommended way, below) or **Puter** (the alternative, further down). If both are
set up, Qwen is used. Delete its key to go back to Puter.

### Switch it on with Alibaba Cloud's Qwen (about 10 minutes)

1. Open Alibaba Cloud's Model Studio API key page: <https://modelstudio.console.alibabacloud.com/ap-southeast-1/settings/api-key>. Sign in, or
   create an Alibaba Cloud account first (alibabacloud.com). Choose the **Singapore** region in the top right corner. If it asks you to
   activate Model Studio, agree to the terms.
2. Press **Create API Key**. Leave **Workspace** on its default and **Permissions** on **All**, then press **OK**. The key is shown **once**:
   copy it now (if you lose it, make a new one). Keys belong to one region, so make it in Singapore.
3. In Cloudflare, go to **Workers & Pages → chadrey-wholesale → Settings → Variables and Secrets → Add**. Choose the type **Secret**, name it
   `QWEN_API_KEY`, paste the key, and press **Deploy**. Never put the key in a chat, an email or GitHub.
4. In Telegram, send `/ai` to your bot. It shows the AI a small red picture and answers *"✅ AI drafting works"* with the service, the model
   and what the AI said about the picture, or it tells you what Alibaba said.
5. Send a photo with a few words.

The setup page (`…/api/telegram`) shows `"ai":true,"aiService":"qwen"` once the key is in place (never the key itself).

*If `/ai` says Alibaba did not accept the key although you copied it correctly:* the dialog in step 2 also shows an **API Host** address.
Add it in Cloudflare as a **Text** variable (not Secret) named `QWEN_API_BASE`. Only Alibaba's own addresses are accepted.

### Switch it on with Puter instead (about 5 minutes)

[Puter](https://puter.com) needs no API key: the AI is paid from the free monthly allowance of the Puter account whose token you use, and
from credit you buy there after that.

1. Sign in at puter.com (a free account is enough). Tip: use an account made only for the shop, because the token can act as that account.
2. Open **puter.com/dashboard#account**, find **API token** and press **Create token**. The token is copied for you.
3. In Cloudflare, go to **Workers & Pages → chadrey-wholesale → Settings → Variables and Secrets → Add**. Choose the type **Secret**, name it
   `PUTER_AUTH_TOKEN`, paste the token, and press **Deploy**.
4. Send `/ai` to your bot, then a photo with a few words. The setup page shows `"aiService":"puter"`.

### Cost, privacy and limits

* **Cost with Qwen:** the standard model is `qwen3-vl-plus`. Alibaba's international list price is about **$0.20 per million tokens read and
  $1.60 per million written** (a token is about three quarters of a word, and a photo is roughly 1,000 tokens), which is **about a tenth of a
  cent per product**. Alibaba advertises a free allowance for new accounts (typically 1 million tokens per model for 90 days): the **Free
  Quota** page in the console shows what your account has. When it is used up the bot says so and goes back to saving drafts as you type
  them; a new account must then verify its identity and add money in the Alibaba Cloud console before the AI works again.
  Prices can change: check them in the console.
* **Cost with Puter:** the standard model, `claude-haiku-5-5`, is about $0.10 per million tokens read and $0.50 per million written, paid
  from the Puter account's allowance (puter.com/dashboard#usage).
* **Another model:** add a variable (type **Text**, not Secret) named `AI_MODEL`, for example `qwen3.8-flash` for Qwen or `claude-sonnet-5-5` for
  Puter. It must be a model that can read pictures: Qwen's older `qwen-flash`, `qwen-plus` and `qwen-max` cannot (`/ai` says so). The bot switches
  off the "thinking" mode of Qwen3 models, which would only make answers slower and dearer. Remove the variable to go back to the standard model.
* **Privacy:** the photo (shrunk to 768 pixels wide when Cloudflare's resizer is available, otherwise only if it is small) and the words you
  typed, without lines that look like prices, are sent to Alibaba Cloud (Singapore) or to Puter and the company that runs the model, only to
  write the draft. Nothing else from the shop is sent.
* **Limits:** both services limit how many requests a new account may make at once. Photos sent in a rush that hit the limit are retried
  automatically, and `redo` covers the rest.
* **Switch it off:** delete the secret `QWEN_API_KEY` (and `PUTER_AUTH_TOKEN`). If a key leaks, delete it in Model Studio (or revoke the Puter
  token at puter.com/dashboard#account) and make a new one.

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
| "AI drafting is off" after `/ai` | The secret `QWEN_API_KEY` (or `PUTER_AUTH_TOKEN`) is missing. Add it (see above) and press **Deploy**. |
| "Alibaba Cloud did not accept the API key" | The key was copied wrongly, deleted, or made in a different region. Make a new key in the **Singapore** region and replace the secret. If it still fails, add the **API Host** from the key dialog as the text variable `QWEN_API_BASE`. |
| "Alibaba Cloud says there is no free allowance or money left" | In the Alibaba Cloud console open **Model Studio → Free Quota** (and **Billing**). A new account must verify its identity before it can add money or turn off *Free Quota Only*. Drafts are still saved as you type them. |
| "that AI model cannot be used with this account" | The model named in `AI_MODEL` does not exist for your account or region. Delete that variable (the standard model works) or choose another. |
| "…safety check refused this photo or text" | Alibaba's own content check said no. Try a different photo of the product. |
| "answered, but not as if it could see the test picture" | The model in `AI_MODEL` cannot read pictures. Delete that variable or pick a model that can. |
| "Puter did not accept the token" | The token was copied wrongly or has been revoked. Create a new one at puter.com/dashboard#account and replace the secret. |
| "your Puter allowance for AI is used up" | The monthly allowance is spent. It renews every month, or add credit at puter.com. Drafts are still saved as you type them. |
| "Puter says this needs a paid Puter plan" | The model named in `AI_MODEL` is for paying Puter users. Delete that variable (the standard one works on a free account) or choose another. |
| "…wants the email address of that account confirmed" | Sign in at puter.com with the account that made the token, confirm its email address, and try again. |
| "is busy" / "took too long" | Try again in a minute, or reply `redo` to the message. The draft is already saved. |
| "the AI's answer could not be used" | The model answered in a form the bot could not read. Reply `redo`; if it keeps happening, tell the developer which photo. |
| A draft stays on "Writing the description…" | Reply to it with the word `redo`. If it keeps happening, Cloudflare's free plan may be stopping the bot's work part-way (the Logs show "exceeded CPU"): the $5/month Workers plan removes that limit. |
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
* AI drafting: `worker/draftAi.ts` (the question, reading the answer, photos), `worker/draftFilter.ts` (what the AI may not say),
  `worker/qwen.ts` and `worker/puter.ts` (one call each), `worker/aiError.ts` (the failure kinds and the plain-language sentence for each),
  and the second step of `createDraft` in `worker/intake.ts`. The draft is saved first, exactly as without AI, and the Telegram webhook is
  answered at once. The AI then runs inside `ctx.waitUntil` (about 30 s of budget in total: the AI gets at most 16 s and must finish 26 s after the
  bot started on the message) and fills the draft with `applyDraftText`, a single `UPDATE` that only matches a draft that is still hidden,
  has the text the bot saved and whose `updated_at` still equals its `created_at` (every change made in Admin sets `updated_at`, so one check
  covers the price, colours and sizes too; SQLite gives `'now'` the same value everywhere in one statement). Only the delivery that really created
  the draft asks the AI, so two copies of one Telegram message cost one question. The first reply is changed with `editMessageText` (a new
  message when that fails). A photo with no usable name is the one exception: the AI is asked before saving, because the product needs a name for
  its web address; albums are never named that way because their other photos would arrive while the AI is still thinking. The AI sees the name
  and the owner's other lines, minus lines that look like a price, an order size, stock or delivery. Its answer is read as strict JSON from the first
  complete `{…}` (at most 16,000 characters), every part is cut to a safe length, stripped of invisible characters, HTML and markdown, and checked
  sentence by sentence (`mayNotSay`) BEFORE formatting is removed, so `#48,000` is still seen as a price. Names, short descriptions and colours are
  checked too; colours must be everyday colour names, with an optional shade, or ones the owner typed on a `Colors:` line. It may only choose a
  category the shop already has. The checks are written so a very long answer stays quick (numbers are matched from their start only), which
  matters on Cloudflare's free plan.
* Which service: `aiSettings` in `worker/config.ts` picks Qwen when `QWEN_API_KEY` is set, otherwise Puter when `PUTER_AUTH_TOKEN` is set;
  `AI_MODEL` applies to whichever answers.
* Qwen (`qwenChat`): Alibaba Cloud Model Studio speaks the OpenAI chat format, so it is a plain `fetch`:
  `POST {base}/chat/completions` with `Authorization: Bearer <key>` and
  `{model, messages: [{role: "user", content: [{type: "text", text}, {type: "image_url", image_url: {url: "data:image/jpeg;base64,…"}}]}], max_tokens, enable_thinking: false}`.
  The base is `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (Singapore; Alibaba keeps this older address working) unless
  `QWEN_API_BASE` holds another Alibaba address (https and `aliyuncs.com` or `alibabacloud.com` only, so a typo cannot send the key elsewhere).
  Keys are region-bound. `enable_thinking: false` is sent for `qwen3*` models, which think by default from Qwen3.5 on (not for models whose name
  says "thinking", and not for older models). JPEG, PNG and WebP are accepted; a GIF is refused before anything is sent. Alibaba's error codes
  (`invalid_api_key`, `Arrearage`, `AllocationQuota.FreeTierOnly`, `data_inspection_failed`, `model_not_found`, `Throttling.*`, `limit_requests`)
  are mapped in `qwen.ts`; both the nested `{"error": {…}}` and the flat `{"code", "message"}` shapes are read. The tests use a pretend Alibaba
  (`worker/testkit.ts`, and `QWEN_API_ORIGIN` in the browser tests). The live service has to be tried once with `/ai` after the key is added.
* Puter has no SDK that runs in a Worker, so `puterChat` sends the request Puter.js 2.6.4 sends: `POST https://api.puter.com/drivers/call` with
  `{interface: "puter-chat-completion", driver: "ai-chat", method: "complete", args: {messages: [{content: [prompt, {image_url: {url}}]}], model,
  max_tokens, normalize: true, vision: true}, auth_token}` (content type `text/plain;actually=json`; the token is also sent as a Bearer header).
  Puter's OpenAI- and Anthropic-compatible endpoints need a paid Puter plan; `/drivers/call` works on a free account. No sampling options are
  sent, because current Claude models reject non-default values.
* After the key is added, look at one real message in Cloudflare's Workers Logs and check its CPU time (the free plan allows 10 ms; waiting for the
  AI does not count). The checks above were measured at well under 5 ms even for hostile input, but the live total has not been measured.
