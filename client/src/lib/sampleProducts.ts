import { normalizeOptionGroups } from "@/lib/productOptions";
import type { CatalogueQuery, Product } from "@/lib/catalogue";
import type { PriceTier } from "@/lib/pricing";

/**
 * Demo products shown only when the live catalogue cannot be reached or is still empty.
 * They are flagged `isSample` so the UI labels them clearly, and they cannot be quoted.
 */

type SampleInput = {
  slug: string;
  name: string;
  category: string;
  moq: number;
  summary: string;
  description: string;
  colors: string[];
  sizes: string[];
  packaging: string[];
  customization: string[];
  tiers: PriceTier[];
};

const sample = (input: SampleInput, index: number): Product => ({
  id: input.slug,
  slug: input.slug,
  name: input.name,
  category: input.category,
  moq: input.moq,
  summary: input.summary,
  shortDescription: input.summary,
  description: input.description,
  images: [],
  optionGroups: normalizeOptionGroups({
    colors: input.colors,
    sizes: input.sizes,
    packaging_options: input.packaging,
    customization_options: input.customization,
  }),
  legacyOptions: { colors: input.colors, sizes: input.sizes, packaging: input.packaging, customization: input.customization },
  pricing: { currency: "NGN", unit: "pc", tiers: input.tiers },
  isActive: true,
  createdAt: new Date(Date.UTC(2026, 0, 30 - index)).toISOString(),
  isSample: true,
});

export const sampleProducts: Product[] = [
  {
    slug: "oversized-tshirt",
    name: "100% Cotton Oversized T-Shirt",
    category: "Apparel",
    moq: 50,
    summary: "Heavyweight cotton, drop-shoulder fit, pre-shrunk for retail-ready quality.",
    description: "**Heavyweight cotton** with a clean drop-shoulder silhouette, pre-shrunk for retail-ready quality.\n- Suitable for private-label production\n- Reinforced seams for repeat wholesale orders",
    colors: ["Black", "White", "Grey"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    packaging: ["Individual poly bag", "Bulk carton"],
    customization: ["Plain", "Custom print / logo", "Embroidered logo"],
    tiers: [{ minQty: 50, price: 4500 }, { minQty: 200, price: 4100 }, { minQty: 500, price: 3800 }],
  },
  {
    slug: "fleece-hoodie",
    name: "Premium Fleece Hoodie",
    category: "Apparel",
    moq: 30,
    summary: "Brushed-fleece interior, structured hood, and a clean private-label base.",
    description: "**Brushed-fleece interior** with a structured hood and ribbed cuffs.\n- Comfortable everyday weight\n- Ready for logo embroidery or print",
    colors: ["Black", "Navy", "Heather Grey"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    packaging: ["Individual poly bag", "Bulk carton"],
    customization: ["Plain", "Custom print / logo", "Embroidered logo"],
    tiers: [{ minQty: 30, price: 11500 }, { minQty: 100, price: 10800 }],
  },
  {
    slug: "classic-polo",
    name: "Classic Pique Polo Shirt",
    category: "Apparel",
    moq: 50,
    summary: "Breathable pique knit with a reinforced collar and colorfast dye.",
    description: "**Breathable pique knit** with a reinforced collar, three-button placket, and colorfast dye.\n- Consistent sizing across repeat orders\n- Suitable for embroidered branding",
    colors: ["White", "Navy", "Red"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    packaging: ["Individual poly bag", "Bulk carton"],
    customization: ["Plain", "Embroidered logo"],
    tiers: [{ minQty: 50, price: 5200 }, { minQty: 200, price: 4800 }],
  },
  {
    slug: "cotton-tank",
    name: "Cotton Tank Top",
    category: "Apparel",
    moq: 100,
    summary: "Lightweight ribbed cotton, suited for print-on-demand runs.",
    description: "**Lightweight ribbed cotton** with reinforced seams, suited for print-on-demand runs.\n- Easy to merchandise\n- Flexible custom print options",
    colors: ["Black", "White"],
    sizes: ["S", "M", "L", "XL"],
    packaging: ["Bulk carton"],
    customization: ["Plain", "Custom print / logo"],
    tiers: [{ minQty: 100, price: 2600 }, { minQty: 500, price: 2300 }],
  },
  {
    slug: "canvas-tote",
    name: "Recycled Canvas Tote",
    category: "Bags",
    moq: 100,
    summary: "Durable canvas base for retail, events, and branded merchandise.",
    description: "**Durable recycled canvas** base built for repeat retail and event use.\n- Reinforced stitched handles\n- Ready for screen print or embroidery branding",
    colors: ["Natural", "Black"],
    sizes: ["Standard"],
    packaging: ["Bulk carton"],
    customization: ["Plain", "Custom print / logo"],
    tiers: [{ minQty: 100, price: 1800 }, { minQty: 500, price: 1500 }],
  },
  {
    slug: "travel-pouch",
    name: "Travel Organizer Pouch",
    category: "Bags",
    moq: 50,
    summary: "Compact zip pouch with multiple compartments and private-label options.",
    description: "**Compact zip pouch** with multiple internal compartments.\n- Suits amenity kits and retail add-ons\n- Private-label ready",
    colors: ["Black", "Grey", "Navy"],
    sizes: ["Standard"],
    packaging: ["Individual poly bag", "Bulk carton"],
    customization: ["Plain", "Custom print / logo"],
    tiers: [{ minQty: 50, price: 2400 }, { minQty: 200, price: 2100 }],
  },
].map(sample);

export const findSample = (slug: string): Product | undefined => sampleProducts.find(product => product.slug === slug);

/** Applies the catalogue filters to the demo products so search and chips still work offline. */
export function querySamples(query: CatalogueQuery): Product[] {
  const term = query.q.trim().toLowerCase();
  const matches = sampleProducts.filter(product => {
    if (query.category && query.category !== "All" && product.category !== query.category) return false;
    if (query.slugs && !query.slugs.includes(product.slug)) return false;
    return !term || `${product.name} ${product.summary} ${product.category}`.toLowerCase().includes(term);
  });
  if (query.sort === "moq") return [...matches].sort((a, b) => a.moq - b.moq);
  if (query.sort === "name") return [...matches].sort((a, b) => a.name.localeCompare(b.name));
  return matches;
}
