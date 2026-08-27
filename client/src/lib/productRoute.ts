export function productHref(slug: string) {
  return `/product?id=${encodeURIComponent(slug)}`;
}

export function productSlugFromLocation(location: string) {
  return new URLSearchParams(location.split("?")[1] || "").get("id") || "";
}
