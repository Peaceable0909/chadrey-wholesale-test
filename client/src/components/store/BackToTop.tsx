import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/** Floating "back to top" control that appears after a long scroll through the catalogue. */
export function BackToTop({ threshold = 1100 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!visible) return null;
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="material press fixed right-4 z-30 grid size-11 place-items-center rounded-full shadow-float bottom-[calc(var(--tab-h)+env(safe-area-inset-bottom)+14px)] md:bottom-8 md:right-8">
      <ArrowUp className="size-5" strokeWidth={2.2} />
    </button>
  );
}
