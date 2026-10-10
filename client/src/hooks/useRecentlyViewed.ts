import { useCallback, useEffect, useState } from "react";
import type { Product } from "@/lib/catalogue";

// v2: stores a compact card snapshot (the older key held a different shape).
const KEY = "chadrey-recent-v2";
const LIMIT = 8;

/** Only what a product card needs, so the stored list stays small. */
function snapshot(product: Product): Product {
  return { ...product, description: "", images: product.images.slice(0, 1), optionGroups: [], legacyOptions: { colors: [], sizes: [], packaging: [], customization: [] } };
}

function read(): Product[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.slug === "string" && item.pricing) : [];
  } catch {
    return [];
  }
}

/** Remembers the products a visitor opened, most recent first. */
export function useRecentlyViewed(current?: Product | null) {
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    const stored = read();
    if (!current) {
      setItems(stored);
      return;
    }
    const next = [snapshot(current), ...stored.filter(item => item.slug !== current.slug)].slice(0, LIMIT);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage can be unavailable */
    }
    // Show the history as it was before this visit, without the page itself.
    setItems(stored.filter(item => item.slug !== current.slug));
  }, [current?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setItems([]);
  }, []);

  return { items, clear };
}
