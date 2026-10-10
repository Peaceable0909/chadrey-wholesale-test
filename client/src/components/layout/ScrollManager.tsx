import { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";

const STORE_KEY = "chadrey-scroll-positions";

function readPositions(): Record<string, number> {
  try {
    return JSON.parse(window.sessionStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writePosition(key: string, y: number) {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ ...readPositions(), [key]: Math.round(y) }));
  } catch {
    /* storage can be unavailable */
  }
}

/** Scrolls to `y`, waiting briefly for the page to grow tall enough (cached lists render a frame later). */
function restoreScroll(y: number) {
  const started = performance.now();
  const tick = () => {
    window.scrollTo(0, y);
    if (Math.abs(window.scrollY - y) < 2 || performance.now() - started > 1500) return;
    requestAnimationFrame(tick);
  };
  tick();
}

/**
 * The client router swaps pages without a reload, so scroll position needs handling:
 * - opening a new page starts at the top;
 * - Back / Forward returns to where you were (so browsing a long catalogue is not lost);
 * - changing a filter on the same page (query string) keeps the current position.
 */
export function ScrollManager() {
  const [path] = useLocation();
  const search = useSearch();
  const key = search ? `${path}?${search}` : path;
  const keyRef = useRef(key);
  keyRef.current = key;
  const poppedRef = useRef(false);

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    const onPopState = () => {
      poppedRef.current = true;
    };
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => writePosition(keyRef.current, window.scrollY));
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (poppedRef.current) {
      poppedRef.current = false;
      restoreScroll(readPositions()[keyRef.current] ?? 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, [path]);

  return null;
}
