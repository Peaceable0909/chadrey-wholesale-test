/**
 * Phone photos are 3–5 MB at 12+ megapixels, far more than a product tile needs. Shrinking them
 * before upload makes adding goods from a phone several times faster and keeps storage small.
 * Falls back to the original file whenever anything about the conversion is unsupported or fails.
 */
export async function prepareImage(file: File, maxEdge = 1600, quality = 0.86): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
    const bitmap = await decode(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 600_000) {
      bitmap.close();
      return file;
    }
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    // JPEG has no transparency: paint white first so transparent PNGs do not turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file; // never make a photo bigger
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Decodes with the camera's rotation applied; older browsers do not accept the option, so retry without it. */
async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    return createImageBitmap(file);
  }
}
