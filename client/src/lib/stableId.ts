/*
 * An id made from what a photo contains, so sending the same photo to the same product twice is recognised as the
 * same photo (the shop's data service ignores a photo id it already holds). Without it, choosing the same files again
 * after a connection dropped half-way would add every photo that did arrive a second time.
 */

const toHex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

async function sha256(data: BufferSource): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

/** The same product and the same file always give the same id; another product or another file gives another. */
export async function photoIdFor(productId: string, file: Blob): Promise<string> {
  const fileHash = toHex(await sha256(await file.arrayBuffer()));
  const bytes = (await sha256(new TextEncoder().encode(`${productId.toLowerCase()}:${fileHash}`))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
