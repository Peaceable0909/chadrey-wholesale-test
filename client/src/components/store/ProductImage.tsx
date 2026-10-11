import * as React from "react";
import { categoryMeta } from "@/lib/categories";
import type { Product } from "@/lib/catalogue";
import { imageFit } from "@/lib/catalogueView";
import { photoAttributes, type PhotoVariant } from "@/lib/photos";
import { cn } from "@/lib/utils";

/**
 * Photos are the heaviest thing on the site, so a photo is only requested when it is about to scroll into view.
 * The browser's own lazy loading starts far too early on slow connections (about 2,500px ahead), which put a dozen
 * full-size photos on the first screen. One shared observer per margin keeps this cheap for a grid of 24 cards.
 */
const watchers = new Map<string, { observer: IntersectionObserver; callbacks: Map<Element, () => void> }>();

function whenNear(element: Element, margin: string, callback: () => void): () => void {
  let watcher = watchers.get(margin);
  if (!watcher) {
    const callbacks = new Map<Element, () => void>();
    const observer = new IntersectionObserver(
      records => {
        for (const record of records) {
          if (!record.isIntersecting) continue;
          const run = callbacks.get(record.target);
          callbacks.delete(record.target);
          observer.unobserve(record.target);
          run?.();
        }
      },
      { rootMargin: margin },
    );
    watcher = { observer, callbacks };
    watchers.set(margin, watcher);
  }
  const { observer, callbacks } = watcher;
  callbacks.set(element, callback);
  observer.observe(element);
  return () => {
    callbacks.delete(element);
    observer.unobserve(element);
  };
}

type ProductImageProps = {
  product: Pick<Product, "name" | "category" | "images">;
  /** Index into the product's images. */
  index?: number;
  className?: string;
  /** "auto" fills the frame with a photo that is about square and shows any other shape whole (nothing is cut off or stretched). */
  fit?: "cover" | "contain" | "auto";
  /** Fade the photo in when it arrives. The container behind it supplies the soft background. */
  fade?: boolean;
  /** Say in words when there is no photo or it could not be loaded (for cards; thumbnails are too small for text). */
  caption?: boolean;
  /** Load straight away, for the one photo that is the main content of a page. */
  priority?: boolean;
  /** How far outside the screen the photo may be before it starts loading (CSS margin syntax). */
  margin?: string;
  /** Wait before loading, even when on screen, e.g. thumbnails that should follow the main photo. */
  hold?: boolean;
  /** How big the photo is shown, so the browser downloads a copy of about that size: a small thumbnail, a card in a grid, or the main picture of a page. */
  variant?: PhotoVariant;
  /** Called once the photo has loaded. */
  onLoaded?: () => void;
};

/** The product photo, or a quiet neutral tile when the product has none yet or the photo cannot be loaded. */
export function ProductImage({ product, index = 0, className, fit = "cover", fade = false, caption = false, priority = false, margin = "150px", hold = false, variant = "card", onLoaded }: ProductImageProps) {
  const image = product.images[index];
  const [brokenUrl, setBrokenUrl] = React.useState<string | null>(null);
  const [near, setNear] = React.useState(priority || typeof IntersectionObserver === "undefined");
  const [loadedUrl, setLoadedUrl] = React.useState<string | null>(null);
  const [autoFit, setAutoFit] = React.useState<"cover" | "contain">("contain");
  const holder = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (near || !image || !holder.current) return;
    return whenNear(holder.current, margin, () => setNear(true));
  }, [near, image, margin]);

  if (image && image.url !== brokenUrl) {
    if (!near || hold) return <div ref={holder} aria-hidden className={cn("size-full bg-fill-4", className)} />;
    const arrived = (element: HTMLImageElement) => {
      if (fit === "auto") setAutoFit(imageFit(element.naturalWidth, element.naturalHeight));
      setLoadedUrl(image.url);
      onLoaded?.();
    };
    const shown = fit === "auto" ? autoFit : fit;
    return (
      <img
        {...photoAttributes(image.url, variant)}
        // A photo that was already in the browser's memory is complete before React can listen for its load event.
        ref={element => {
          if (element?.complete && element.naturalWidth > 0 && loadedUrl !== image.url) arrived(element);
        }}
        alt={image.alt || (image.label ? `${product.name} – ${image.label}` : product.name)}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        draggable={false}
        onLoad={event => arrived(event.currentTarget)}
        onError={() => setBrokenUrl(image.url)}
        className={cn("size-full", shown === "cover" ? "object-cover" : "object-contain", fade && "transition-opacity duration-300", fade && loadedUrl !== image.url && "opacity-0", className)}
      />
    );
  }
  const { icon: Icon } = categoryMeta(product.category);
  return (
    <div role="img" aria-label={image ? `${product.name} (photo unavailable)` : product.name} className={cn("flex size-full flex-col items-center justify-center gap-1.5 bg-fill-4 text-label-3", className)}>
      <Icon className="size-[34%] max-h-16 max-w-16" strokeWidth={1.2} aria-hidden />
      {caption && <span className="text-caption font-medium text-label-2">{image ? "Photo unavailable" : "No photo yet"}</span>}
    </div>
  );
}
