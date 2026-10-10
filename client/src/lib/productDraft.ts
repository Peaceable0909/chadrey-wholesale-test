import type { Product } from "@/lib/catalogue";
import { draftFromPricing, emptyPriceDraft, pricingFromDraft, type PriceDraft, type Pricing } from "@/lib/pricing";
import { optionGroupKey, type ProductOptionGroup } from "@/lib/productOptions";

/** Minimum photos for a new product. Change here to allow single-photo listings. */
export const MIN_PRODUCT_IMAGES = 2;
export const MAX_PRODUCT_IMAGES = 30;

/** Everything the admin can type for a product, as raw form strings. */
export type ProductDraft = {
  name: string;
  category: string;
  moq: string;
  shortDescription: string;
  description: string;
  colors: string;
  sizes: string;
  packaging: string;
  customization: string;
  customLabel: string;
  customValues: string;
  price: PriceDraft;
  isActive: boolean;
};

/** A validated product, ready to be written to Supabase. */
export type ProductFields = {
  name: string;
  category: string;
  moq: number;
  shortDescription: string;
  description: string;
  colors: string[];
  sizes: string[];
  packaging: string[];
  customization: string[];
  optionGroups: ProductOptionGroup[];
  pricing: Pricing;
  isActive: boolean;
};

export const emptyDraft = (): ProductDraft => ({
  name: "",
  category: "",
  moq: "24",
  shortDescription: "",
  description: "",
  colors: "",
  sizes: "",
  packaging: "",
  customization: "",
  customLabel: "",
  customValues: "",
  price: emptyPriceDraft(),
  isActive: true,
});

/** "Black, Navy ,, Stone" → ["Black", "Navy", "Stone"] */
export const csv = (value: string): string[] =>
  value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

const STANDARD_KEYS = ["color", "size", "packaging", "customization"];

export function buildOptionGroups(draft: Pick<ProductDraft, "colors" | "sizes" | "packaging" | "customization" | "customLabel" | "customValues">): ProductOptionGroup[] {
  const customLabel = draft.customLabel.trim();
  let customKey = optionGroupKey(customLabel);
  if (STANDARD_KEYS.includes(customKey)) customKey = `${customKey}-custom`;
  return [
    { key: "color", label: "Color", options: csv(draft.colors) },
    { key: "size", label: "Size", options: csv(draft.sizes) },
    { key: "packaging", label: "Packaging", options: csv(draft.packaging) },
    { key: "customization", label: "Customization", options: csv(draft.customization) },
    { key: customKey, label: customLabel, options: csv(draft.customValues) },
  ].filter(group => group.label && group.options.length);
}

/** Turns a saved product back into editable form values. */
export function draftFromProduct(product: Product): ProductDraft {
  const custom = product.optionGroups.find(group => !STANDARD_KEYS.includes(group.key));
  const listFor = (key: string, legacy: string[]) => (product.optionGroups.find(group => group.key === key)?.options ?? legacy).join(", ");
  return {
    name: product.name,
    category: product.category,
    moq: String(product.moq),
    shortDescription: product.shortDescription,
    description: product.description,
    colors: listFor("color", product.legacyOptions.colors),
    sizes: listFor("size", product.legacyOptions.sizes),
    packaging: listFor("packaging", product.legacyOptions.packaging),
    customization: listFor("customization", product.legacyOptions.customization),
    customLabel: custom?.label ?? "",
    customValues: custom?.options.join(", ") ?? "",
    price: draftFromPricing(product.pricing),
    isActive: product.isActive,
  };
}

/** Validates the draft the way a buyer would experience the product page. */
export function fieldsFromDraft(draft: ProductDraft): { fields: ProductFields | null; error: string | null } {
  const name = draft.name.trim();
  const category = draft.category.trim();
  const moq = Number(draft.moq);
  if (!name) return { fields: null, error: "Give the product a name." };
  if (!category) return { fields: null, error: "Choose or type a category." };
  if (!Number.isInteger(moq) || moq < 1) return { fields: null, error: "The minimum order must be a whole number of 1 or more." };

  const { pricing, error } = pricingFromDraft(draft.price, moq);
  if (error) return { fields: null, error };

  return {
    error: null,
    fields: {
      name,
      category,
      moq,
      shortDescription: draft.shortDescription.trim(),
      description: draft.description.trim(),
      colors: csv(draft.colors),
      sizes: csv(draft.sizes),
      packaging: csv(draft.packaging),
      customization: csv(draft.customization),
      optionGroups: buildOptionGroups(draft),
      pricing,
      isActive: draft.isActive,
    },
  };
}
