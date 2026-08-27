export type ProductOptionGroup = {
  key: string;
  label: string;
  options: string[];
};

const asStrings = (value: unknown) => Array.isArray(value) ? value.map(String).map(value => value.trim()).filter(Boolean) : [];

export function normalizeOptionGroups(product: {
  option_groups?: unknown;
  colors?: unknown;
  sizes?: unknown;
  packaging_options?: unknown;
  customization_options?: unknown;
}): ProductOptionGroup[] {
  const configured = Array.isArray(product.option_groups)
    ? product.option_groups.flatMap((group: any) => {
        const label = String(group?.label || "").trim();
        const key = String(group?.key || label.toLowerCase().replace(/[^a-z0-9]+/g, "-")).trim();
        const options = asStrings(group?.options);
        return label && key && options.length ? [{ key, label, options }] : [];
      })
    : [];
  if (configured.length) return configured;
  return [
    { key: "color", label: "Color", options: asStrings(product.colors) },
    { key: "size", label: "Size", options: asStrings(product.sizes) },
    { key: "packaging", label: "Packaging", options: asStrings(product.packaging_options) },
    { key: "customization", label: "Customization", options: asStrings(product.customization_options) },
  ].filter(group => group.options.length);
}

export function optionGroupKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "option";
}
