import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, MessageCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import FormattedDescription from "@/components/FormattedDescription";
import { supabase } from "@/lib/supabase";

type Product = { slug: string; name: string; category: string; moq: number; shortDescription: string; description: string; colors: string[]; sizes: string[]; packaging: string[]; customization: string[]; tone: string; image?: string };
const fallback: Record<string, Product> = {
  "oversized-tshirt": { slug: "oversized-tshirt", name: "100% Cotton Oversized T-Shirt", category: "Apparel / Essentials", moq: 50, shortDescription: "Heavyweight cotton oversized tee for reliable private-label production.", description: "**Heavyweight cotton** with a clean drop-shoulder silhouette, pre-shrunk for retail-ready quality.\n- Suitable for private-label production\n- Reinforced seams for repeat wholesale orders", colors: ["Black", "White", "Grey"], sizes: ["S", "M", "L", "XL", "XXL"], packaging: ["Individual poly bag", "Bulk carton"], customization: ["Plain", "Custom print / logo", "Embroidered logo"], tone: "mint" },
  "fleece-hoodie": { slug: "fleece-hoodie", name: "Premium Fleece Hoodie", category: "Apparel / Essentials", moq: 30, shortDescription: "A dependable brushed-fleece base for private-label collections.", description: "**Brushed-fleece interior** with a structured hood and ribbed cuffs.\n- Comfortable everyday weight\n- Ready for logo embroidery or print", colors: ["Black", "Navy", "Heather Grey"], sizes: ["S", "M", "L", "XL", "XXL"], packaging: ["Individual poly bag", "Bulk carton"], customization: ["Plain", "Custom print / logo", "Embroidered logo"], tone: "sand" },
  "classic-polo": { slug: "classic-polo", name: "Classic Pique Polo Shirt", category: "Apparel / Essentials", moq: 50, shortDescription: "Breathable pique polo with a dependable retail-ready finish.", description: "**Breathable pique knit** with a reinforced collar, three-button placket, and colorfast dye.\n- Consistent sizing across repeat orders\n- Suitable for embroidered branding", colors: ["White", "Navy", "Red"], sizes: ["S", "M", "L", "XL", "XXL"], packaging: ["Individual poly bag", "Bulk carton"], customization: ["Plain", "Embroidered logo"], tone: "blue" },
  "cotton-tank": { slug: "cotton-tank", name: "Cotton Tank Top", category: "Apparel / Essentials", moq: 100, shortDescription: "Lightweight ribbed cotton tank for flexible branded runs.", description: "**Lightweight ribbed cotton** with reinforced seams, suited for print-on-demand runs.\n- Easy to merchandise\n- Flexible custom print options", colors: ["Black", "White"], sizes: ["S", "M", "L", "XL"], packaging: ["Bulk carton"], customization: ["Plain", "Custom print / logo"], tone: "rose" },
};
const strings = (value: unknown, fallbackValue: string[]) => Array.isArray(value) ? value.map(String) : fallbackValue;

export default function ProductDetail() {
  const [location] = useLocation();
  const key = new URLSearchParams(location.split("?")[1] || "").get("id") || "oversized-tshirt";
  const [product, setProduct] = useState<Product | null>(fallback[key] || fallback["oversized-tshirt"]);
  const [loading, setLoading] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.from("products").select("slug,name,category,moq,short_description,description,colors,sizes,packaging_options,customization_options,product_images(public_url,is_primary,sort_order)").eq("slug", key).eq("is_active", true).maybeSingle().then(({ data }) => {
      if (active && data) {
        const images = Array.isArray(data.product_images) ? [...data.product_images].sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary) || Number(a.sort_order) - Number(b.sort_order)) : [];
        setProduct({ slug: data.slug, name: data.name, category: data.category, moq: data.moq, shortDescription: data.short_description || data.description, description: data.description, colors: strings(data.colors, ["Standard"]), sizes: strings(data.sizes, ["One size"]), packaging: strings(data.packaging_options, ["Bulk carton"]), customization: strings(data.customization_options, ["Plain"]), tone: "mint", image: images[0]?.public_url });
      }
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [key]);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [packaging, setPackaging] = useState("");
  const [customization, setCustomization] = useState("");
  useEffect(() => { if (product) { setColor(product.colors[0]); setSize(product.sizes[1] || product.sizes[0]); setQuantity(product.moq); setPackaging(product.packaging[0]); setCustomization(product.customization[0]); } }, [product]);
  const quoteHref = useMemo(() => `/quote?product=${encodeURIComponent(product?.slug || key)}&qty=${quantity}&color=${encodeURIComponent(color)}&size=${encodeURIComponent(size)}&packaging=${encodeURIComponent(packaging)}&customization=${encodeURIComponent(customization)}`, [product?.slug, key, quantity, color, size, packaging, customization]);
  if (loading) return <div className="confirmation-page"><Loader2 className="spin"/><h1>Loading product…</h1></div>;
  if (!product) return <div className="confirmation-page"><h1>Product not found.</h1><Link href="/products" className="button button-primary">Back to catalogue</Link></div>;
  return <div className="app-shell"><header className="site-header"><Link href="/" className="brand"><span className="brand-mark">C</span><span>CHADREY<small>WHOLESALE</small></span></Link><nav className="main-nav"><Link href="/">Home</Link><Link className="active" href="/products">Products</Link><Link href="/quote">Request a Quote</Link><Link href="/dashboard">My Workspace</Link></nav><Link href="/dashboard" className="avatar">AB</Link></header><main className="page-container detail-page"><Link href="/products" className="back-link"><ArrowLeft size={15}/> Back to catalogue</Link><div className="detail-grid"><div className={`detail-visual ${product.tone}`}>{product.image ? <img src={product.image} alt={product.name}/> : <div className="detail-glyph">□</div>}<span className="product-tag">MOQ {product.moq}</span><div className="detail-spec"><span>CHADREY / PRIVATE LABEL</span><strong>Wholesale-ready base</strong></div></div><div className="detail-copy"><span className="eyebrow">{product.category}</span><h1>{product.name}</h1><p className="detail-short-description">{product.shortDescription}</p><FormattedDescription text={product.description} className="detail-full-description"/><div className="detail-metrics"><span><strong>MOQ {product.moq}</strong> minimum order</span><span><strong>7–14 days</strong> indicative lead time</span></div><div className="variant-panel"><div className="variant-row"><label>Color <strong>{color}</strong></label><div className="choice-list">{product.colors.map(x => <button type="button" className={color === x ? "chosen" : ""} onClick={() => setColor(x)} key={x}>{x}</button>)}</div></div><div className="variant-row"><label>Size <strong>{size}</strong></label><div className="choice-list">{product.sizes.map(x => <button type="button" className={size === x ? "chosen" : ""} onClick={() => setSize(x)} key={x}>{x}</button>)}</div></div><div className="detail-form-grid"><label className="field">Quantity<input type="number" min={product.moq} value={quantity} onChange={e => setQuantity(Math.max(product.moq, Number(e.target.value)))}/></label><label className="field">Packaging<select value={packaging} onChange={e => setPackaging(e.target.value)}>{product.packaging.map(x => <option key={x}>{x}</option>)}</select></label><label className="field wide">Customization<select value={customization} onChange={e => setCustomization(e.target.value)}>{product.customization.map(x => <option key={x}>{x}</option>)}</select></label></div><div className="detail-actions"><Link className="button button-primary" href={quoteHref}>Add to quote <ArrowRight size={16}/></Link><Link className="button button-secondary" href="/contact"><MessageCircle size={16}/> Talk to our team</Link></div></div><div className="detail-benefits"><span><Check size={15}/> Variant preferences carried into your quote</span><span><Check size={15}/> Pricing prepared against your exact quantity</span></div></div></div></main></div>;
}
