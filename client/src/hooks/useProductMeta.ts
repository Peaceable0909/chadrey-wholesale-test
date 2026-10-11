import { useEffect } from "react";
import type { Product } from "@/lib/catalogue";
import { photoSrc } from "@/lib/photos";
import { productHref } from "@/lib/productRoute";
import { siteConfig } from "@/lib/siteConfig";

function setMeta(name: string, content: string, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let node = document.head.querySelector<HTMLMetaElement>(selector);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(property ? "property" : "name", name);
    document.head.appendChild(node);
  }
  node.content = content;
}

/** Title, description, Open Graph / Twitter tags and canonical URL for a product page. */
export function useProductMeta(product: Product | null) {
  useEffect(() => {
    if (!product) return;
    const url = new URL(productHref(product.slug), window.location.origin).toString();
    const cover = product.images[0]?.url;
    const image = new URL(cover ? photoSrc(cover, 1280) : "/og-product.svg", window.location.origin).toString();
    const description = product.summary || `${product.name} from ${siteConfig.name}`;
    document.title = `${product.name} | ${siteConfig.name}`;
    setMeta("description", description);
    setMeta("og:type", "product", true);
    setMeta("og:title", product.name, true);
    setMeta("og:description", description, true);
    setMeta("og:url", url, true);
    setMeta("og:site_name", siteConfig.name, true);
    setMeta("og:image", image, true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", product.name);
    setMeta("twitter:description", description);
    setMeta("twitter:image", image);
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;
  }, [product]);
}
