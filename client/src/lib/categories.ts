import {
  Cookie,
  Footprints,
  Gem,
  Gift,
  Home,
  Package,
  Palette,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tag,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export type Tone = "blue" | "green" | "orange" | "red" | "indigo" | "teal" | "pink" | "purple" | "yellow" | "gray";

/** Offered as suggestions when adding a product. Any other category the admin types also works. */
export const STARTER_CATEGORIES = [
  "Apparel",
  "Bags",
  "Shoes",
  "Accessories",
  "Beauty & skincare",
  "Home & lifestyle",
  "Kitchenware",
  "Electronics",
  "Food & snacks",
  "Packaging",
  "Gifts & crafts",
  "Custom",
];

const RULES: Array<{ test: RegExp; icon: LucideIcon; tone: Tone }> = [
  { test: /apparel|cloth|garment|textile|fashion|wear|shirt|dress|fabric/i, icon: Shirt, tone: "blue" },
  { test: /bag|luggage|backpack|tote|pouch|wallet/i, icon: ShoppingBag, tone: "orange" },
  { test: /shoe|footwear|sandal|sneaker|slipper|boot/i, icon: Footprints, tone: "red" },
  { test: /jewel|accessor|watch|glasses|scarf|belt|hat|cap/i, icon: Gem, tone: "purple" },
  { test: /beauty|skin|cosmetic|care|perfume|soap|makeup|hair/i, icon: Sparkles, tone: "pink" },
  { test: /kitchen|dining|cook|tableware|ceramic|cup|mug/i, icon: UtensilsCrossed, tone: "yellow" },
  { test: /home|living|lifestyle|decor|furnit|bedding|candle/i, icon: Home, tone: "teal" },
  { test: /electr|gadget|phone|device|audio|tech|charger|battery/i, icon: Smartphone, tone: "indigo" },
  { test: /food|snack|beverage|drink|tea|coffee|spice|sauce|fruit/i, icon: Cookie, tone: "green" },
  { test: /pack|supply|supplies|carton|box|wrap/i, icon: Package, tone: "gray" },
  { test: /gift|craft|souvenir|toy|handmade/i, icon: Gift, tone: "pink" },
  { test: /custom|bespoke|other/i, icon: Palette, tone: "purple" },
];

const FALLBACK_TONES: Tone[] = ["blue", "teal", "indigo", "orange", "green", "purple"];

/** Icon and colour for a category name. Unknown names get a stable colour so they never flicker. */
export function categoryMeta(name: string): { icon: LucideIcon; tone: Tone } {
  const rule = RULES.find(item => item.test.test(name));
  if (rule) return { icon: rule.icon, tone: rule.tone };
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return { icon: Tag, tone: FALLBACK_TONES[hash % FALLBACK_TONES.length] };
}
