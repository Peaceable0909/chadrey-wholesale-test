import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initialsFrom(value?: string | null, fallback?: string | null) {
  const source = value || fallback || "Chadrey Wholesale";
  const initials = source.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("");
  return initials || "CW";
}
