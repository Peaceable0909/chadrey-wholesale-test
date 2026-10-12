export class TelegramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramError";
  }
}

export const TELEGRAM_API = "https://api.telegram.org";

/** The few Telegram calls the intake needs. The bot token is part of every address, so errors never repeat the address. */
export function createTelegram(token: string, base: string, doFetch: typeof fetch) {
  const scrub = (text: string) => text.split(token).join("***");

  async function call<T>(method: string, body: unknown): Promise<T> {
    let response: Response;
    try {
      response = await doFetch(`${base}/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    } catch (error) {
      throw new TelegramError(scrub(`Telegram ${method} could not be reached: ${error instanceof Error ? error.message : String(error)}`));
    }
    const data = (await response.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
    if (!response.ok || !data?.ok) throw new TelegramError(scrub(`Telegram ${method} failed: ${data?.description ?? response.status}`));
    return data.result as T;
  }

  return {
    /** Returns the id of the message that was sent, so the bot can change it later (see editMessage). */
    async sendMessage(chatId: number, text: string, replyTo?: number): Promise<number | null> {
      const sent = await call<{ message_id?: number } | null>("sendMessage", {
        chat_id: chatId,
        text,
        link_preview_options: { is_disabled: true },
        ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
      });
      return typeof sent?.message_id === "number" ? sent.message_id : null;
    },

    /** Replaces the text of a message the bot sent earlier. */
    async editMessage(chatId: number, messageId: number, text: string): Promise<void> {
      await call("editMessageText", { chat_id: chatId, message_id: messageId, text, link_preview_options: { is_disabled: true } });
    },

    /** Downloads a photo or file by its Telegram id. Refuses anything larger than maxBytes. */
    async downloadFile(fileId: string, maxBytes: number): Promise<{ bytes: ArrayBuffer; path: string }> {
      const info = await call<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
      if (!info.file_path) throw new TelegramError("Telegram did not give a download path for that file.");
      if (info.file_size && info.file_size > maxBytes) throw new TelegramError("That file is too large.");
      let response: Response;
      try {
        response = await doFetch(`${base}/file/bot${token}/${info.file_path}`);
      } catch (error) {
        throw new TelegramError(scrub(`The photo could not be downloaded: ${error instanceof Error ? error.message : String(error)}`));
      }
      if (!response.ok) throw new TelegramError(`The photo could not be downloaded (status ${response.status}).`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > maxBytes) throw new TelegramError("That file is too large.");
      if (bytes.byteLength === 0) throw new TelegramError("The photo came through empty.");
      return { bytes, path: info.file_path };
    },
  };
}
