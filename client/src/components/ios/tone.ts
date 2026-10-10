import type { Tone } from "@/lib/categories";

/** Tinted chip: soft background with text that stays readable (WCAG AA). */
export const toneSoft: Record<Tone, string> = {
  blue: "bg-ios-blue/12 text-ios-blue-text",
  green: "bg-ios-green/14 text-ios-green-text",
  orange: "bg-ios-orange/14 text-ios-orange-text",
  red: "bg-ios-red/12 text-ios-red-text",
  indigo: "bg-ios-indigo/12 text-ios-indigo-text",
  teal: "bg-ios-teal/14 text-ios-teal-text",
  pink: "bg-ios-pink/12 text-ios-pink-text",
  purple: "bg-ios-purple/12 text-ios-purple-text",
  yellow: "bg-ios-yellow/20 text-ios-yellow-text",
  gray: "bg-ios-gray/14 text-ios-gray-text",
};

/** Settings-style icon tile: solid colour with a white glyph. */
export const toneSolid: Record<Tone, string> = {
  blue: "bg-ios-blue text-white",
  green: "bg-ios-green text-white",
  orange: "bg-ios-orange text-white",
  red: "bg-ios-red text-white",
  indigo: "bg-ios-indigo text-white",
  teal: "bg-ios-teal text-white",
  pink: "bg-ios-pink text-white",
  purple: "bg-ios-purple text-white",
  yellow: "bg-ios-yellow text-white",
  gray: "bg-ios-gray text-white",
};

/** Soft gradient used behind product placeholders and category tiles. */
export const toneWash: Record<Tone, string> = {
  blue: "from-ios-blue/20 to-ios-blue/5",
  green: "from-ios-green/22 to-ios-green/5",
  orange: "from-ios-orange/22 to-ios-orange/5",
  red: "from-ios-red/18 to-ios-red/5",
  indigo: "from-ios-indigo/20 to-ios-indigo/5",
  teal: "from-ios-teal/22 to-ios-teal/5",
  pink: "from-ios-pink/18 to-ios-pink/5",
  purple: "from-ios-purple/20 to-ios-purple/5",
  yellow: "from-ios-yellow/30 to-ios-yellow/8",
  gray: "from-ios-gray/22 to-ios-gray/6",
};

export const toneText: Record<Tone, string> = {
  blue: "text-ios-blue-text",
  green: "text-ios-green-text",
  orange: "text-ios-orange-text",
  red: "text-ios-red-text",
  indigo: "text-ios-indigo-text",
  teal: "text-ios-teal-text",
  pink: "text-ios-pink-text",
  purple: "text-ios-purple-text",
  yellow: "text-ios-yellow-text",
  gray: "text-ios-gray-text",
};
