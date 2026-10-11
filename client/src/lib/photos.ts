/**
 * Product photos live at /photos/<key>. Adding ?w=<width> asks for a smaller copy, made on demand and then remembered,
 * so a small card never downloads a full-size photo. Photos from anywhere else (demo products) are used as they are.
 */

/** The widths the shop can make. The service rounds anything else up to the next one. */
export const PHOTO_WIDTHS = [160, 320, 640, 960, 1280] as const;

export const isShopPhoto = (url: string): boolean => url.startsWith("/photos/");

export function photoSrc(url: string, width: number): string {
  return isShopPhoto(url) ? `${url.split("?")[0]}?w=${width}` : url;
}

/** What a photo is shown as: a small thumbnail, a product card, or the big picture on a product page. */
export type PhotoVariant = "thumb" | "card" | "main";

const VARIANTS: Record<PhotoVariant, { widths: number[]; sizes: string; src: number }> = {
  thumb: { widths: [160, 320], sizes: "72px", src: 160 },
  card: { widths: [320, 640, 960], sizes: "(min-width: 1024px) 280px, 50vw", src: 640 },
  main: { widths: [640, 960, 1280], sizes: "(min-width: 1024px) 640px, 100vw", src: 960 },
};

/** The attributes for an <img>: a source, plus the choices the browser picks from for its screen. */
export function photoAttributes(url: string, variant: PhotoVariant): { src: string; srcSet?: string; sizes?: string } {
  if (!isShopPhoto(url)) return { src: url };
  const { widths, sizes, src } = VARIANTS[variant];
  return { src: photoSrc(url, src), srcSet: widths.map(width => `${photoSrc(url, width)} ${width}w`).join(", "), sizes };
}
