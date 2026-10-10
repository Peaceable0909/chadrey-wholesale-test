import { useEffect } from "react";
import { siteConfig } from "@/lib/siteConfig";

/** Sets the browser tab / history title for the current page. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${siteConfig.name}` : siteConfig.name;
  }, [title]);
}
