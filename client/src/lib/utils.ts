import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge needs to know the design system's custom scales. Without this it reads
 * `text-headline` (a font size) as a text colour and drops the real colour class next to it.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["largetitle", "title1", "title2", "title3", "headline", "body", "callout", "subhead", "footnote", "caption", "caption2"],
      radius: ["control", "group", "card", "sheet"],
      shadow: ["card", "float", "sheet"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Derives up-to-two-letter initials for an avatar badge from a display name
 * (falls back to an email address, then a neutral placeholder).
 */
export function initialsFrom(name?: string | null, email?: string | null): string {
  const source = (name || "").trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  }
  const mail = (email || "").trim();
  if (mail) return mail.slice(0, 2).toUpperCase();
  return "?";
}
