import { useSyncExternalStore } from "react";

const KEY = "chadrey-saved-products";
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

let snapshot: string[] = typeof window === "undefined" ? [] : read();

function write(next: string[]) {
  snapshot = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage can be unavailable (private mode); the in-memory list still works for this visit */
  }
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      snapshot = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Products the visitor has hearted. Kept in this browser and shared live across the page. */
export function useSavedProducts() {
  const slugs = useSyncExternalStore(subscribe, () => snapshot, () => []);
  return {
    slugs,
    isSaved: (slug: string) => slugs.includes(slug),
    toggle: (slug: string) => write(slugs.includes(slug) ? slugs.filter(item => item !== slug) : [slug, ...slugs]),
  };
}
