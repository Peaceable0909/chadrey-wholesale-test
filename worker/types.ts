/** Settings the Worker reads. Secrets are set in the Cloudflare dashboard as "Secret", never in this repository. */
export type Env = {
  /** Serves the website files. Only used if a request that is not for /api/* ever reaches the Worker. */
  ASSETS: { fetch(request: Request): Promise<Response> };

  /** From @BotFather when the bot is created. */
  TELEGRAM_BOT_TOKEN?: string;
  /** Any long random text. Telegram sends it back with every message, which proves the message came from Telegram. */
  TELEGRAM_WEBHOOK_SECRET?: string;
  /** Telegram user ids allowed to add products, separated by commas. */
  TELEGRAM_ALLOWED_USER_IDS?: string;
  /** The Supabase "secret" or "service_role" key. It can change everything, so it only lives here as a Secret. */
  SUPABASE_SERVICE_KEY?: string;

  /** Public project address. Set in wrangler.jsonc. */
  SUPABASE_URL?: string;
  /** Used when a message does not name a currency, unit or minimum order. Set in wrangler.jsonc. */
  DEFAULT_CURRENCY?: string;
  DEFAULT_UNIT?: string;
  DEFAULT_MOQ?: string;
  /** Optional. The website address used in the bot's "Review it" link. Defaults to the address Telegram called. */
  SITE_URL?: string;
  /** Only the tests change this, to point at a pretend Telegram. */
  TELEGRAM_API_BASE?: string;
};

export type WorkerContext = { waitUntil(promise: Promise<unknown>): void };

export type TelegramPhotoSize = { file_id: string; file_unique_id: string; width?: number; height?: number; file_size?: number };
export type TelegramDocument = { file_id: string; file_unique_id: string; mime_type?: string; file_name?: string; file_size?: number };

export type TelegramMessage = {
  message_id: number;
  from?: { id: number; is_bot?: boolean; first_name?: string };
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  media_group_id?: string;
  reply_to_message?: { message_id: number; from?: { is_bot?: boolean }; text?: string; caption?: string };
};

export type TelegramUpdate = { update_id: number; message?: TelegramMessage };
