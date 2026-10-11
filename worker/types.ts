/*
 * The few parts of Cloudflare's database (D1), file storage (R2) and image resizer that the shop uses.
 * They are written out here, instead of importing Cloudflare's type package, so the website build
 * does not need it and does not mix its types with the browser's.
 */
export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: { changes?: number; last_row_id?: number; rows_read?: number; rows_written?: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  /** Runs the statements in order as one all-or-nothing group. */
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface R2ObjectInfo {
  key: string;
  size: number;
  httpEtag: string;
  httpMetadata?: { contentType?: string; cacheControl?: string };
}

export interface R2ObjectBody extends R2ObjectInfo {
  body: ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2ObjectInfo | null>;
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array> | string, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<R2ObjectInfo>;
  delete(keys: string | string[]): Promise<void>;
}

export interface ImagesChain {
  transform(options: { width?: number; height?: number; fit?: "scale-down" | "contain" | "cover" | "crop" | "pad" }): ImagesChain;
  output(options: { format: string; quality?: number }): Promise<{ response(init?: { headers?: Record<string, string> }): Response }>;
}

export interface ImagesBinding {
  input(source: ReadableStream<Uint8Array> | ArrayBuffer): ImagesChain;
}

/** Settings the Worker reads. Secrets are set in the Cloudflare dashboard as "Secret", never in this repository. */
export type Env = {
  /** Serves the website files. Only used if a request that is not for /api/* ever reaches the Worker. */
  ASSETS: { fetch(request: Request): Promise<Response> };

  /** The shop's database: products and their photo records. Declared in wrangler.jsonc. */
  DB: D1Database;
  /** The shop's photo files. Declared in wrangler.jsonc. */
  PHOTOS: R2Bucket;
  /** Makes smaller copies of photos on demand. Optional: without it the full-size photo is sent. */
  IMAGES?: ImagesBinding;

  /** From @BotFather when the bot is created. */
  TELEGRAM_BOT_TOKEN?: string;
  /** Any long random text. Telegram sends it back with every message, which proves the message came from Telegram. */
  TELEGRAM_WEBHOOK_SECRET?: string;
  /** Telegram user ids allowed to add products, separated by commas. */
  TELEGRAM_ALLOWED_USER_IDS?: string;
  /** Public project address. Set in wrangler.jsonc. Used only to check who is signed in on the admin screens. */
  SUPABASE_URL?: string;
  /** The public "publishable" key (safe to publish, it is already in the website). Set in wrangler.jsonc. */
  SUPABASE_PUBLISHABLE_KEY?: string;
  /** Used when a message does not name a currency, unit or minimum order. Set in wrangler.jsonc. */
  DEFAULT_CURRENCY?: string;
  DEFAULT_UNIT?: string;
  DEFAULT_MOQ?: string;
  /** Optional. How many seconds shoppers share one answer (default 30). "0" turns sharing off, which tests use. */
  SHOP_CACHE_SECONDS?: string;
  /** Optional. The website address used in the bot's "Review it" link. Defaults to the address Telegram called. */
  SITE_URL?: string;
  /** Only the tests change this, to point at a pretend Telegram. */
  TELEGRAM_API_BASE?: string;
  /** Optional. An Alibaba Cloud Model Studio "API key" (a secret). With it the bot writes the missing parts of a draft with Alibaba's Qwen AI; Alibaba charges the AI to that account. It wins over the Puter token below. */
  QWEN_API_KEY?: string;
  /** Optional. The "API Host" Alibaba shows when the key is made, if the built-in international address does not suit the key. Only Alibaba's own https addresses are used. */
  QWEN_API_BASE?: string;
  /** Optional. A Puter "API token" (puter.com/dashboard#account), the other way to get AI drafting; Puter charges the AI to that account's own allowance. */
  PUTER_AUTH_TOKEN?: string;
  /** Optional. Which AI model writes the drafts. Defaults to a small, fast model for the service in use (see config.ts). */
  AI_MODEL?: string;
  /** Only the tests change this, to point at a pretend Qwen. */
  QWEN_API_ORIGIN?: string;
  /** Only the tests change this, to point at a pretend Puter. */
  PUTER_API_ORIGIN?: string;
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
