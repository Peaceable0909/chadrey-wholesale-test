import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, Eye, Filter, Heart, Search, SlidersHorizontal, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import FormattedDescription from "@/components/FormattedDescription";
import { productHref } from "@/lib/productRoute";
import { useAuth } from "@/_core/hooks/useAuth";
import { initialsFrom } from "@/lib/utils";

type CatalogueProduct = { id: string; name: string; category: string; moq: number; desc: string; tag: string; tone: string; image?: string; images: string[] };

function CatalogueSkeletons() {
  return <div className="product-grid catalogue-loading-grid" role="status" aria-label="Loading catalogue products">{Array.from({ length: 6 }, (_, index) => <article className="skeleton-product-card" key={index}><div className="skeleton-product-image"><span className="skeleton-badge"/><span className="skeleton-orbit"/></div><div className="skeleton-product-body"><span className="skeleton-line skeleton-meta"/><span className="skeleton-line skeleton-title"/><span className="skeleton-line skeleton-description"/><span className="skeleton-line skeleton-description short"/><div className="skeleton-footer"><span className="skeleton-line skeleton-link"/><span className="skeleton-pill"/></div></div></article>)}</div>;
}

const fallbackProducts: CatalogueProduct[] = [
  { id: "oversized-tshirt", name: "100% Cotton Oversized T-Shirt", category: "Apparel", moq: 50, desc: "Heavyweight cotton, drop-shoulder fit, pre-shrunk for retail-ready quality.", tag: "Best seller", tone: "mint", images: [] },
  { id: "fleece-hoodie", name: "Premium Fleece Hoodie", category: "Apparel", moq: 30, desc: "Brushed-fleece interior, structured hood, and a clean private-label base.", tag: "Low MOQ", tone: "sand", images: [] },
  { id: "classic-polo", name: "Classic Pique Polo Shirt", category: "Apparel", moq: 50, desc: "Breathable pique knit with a reinforced collar and colorfast dye.", tag: "Popular", tone: "blue", images: [] },
  { id: "cotton-tank", name: "Cotton Tank Top", category: "Apparel", moq: 100, desc: "Lightweight ribbed cotton, suited for print-on-demand runs.", tag: "New", tone: "rose", images: [] },
  { id: "canvas-tote", name: "Recycled Canvas Tote", category: "Bags", moq: 100, desc: "Durable canvas base for retail, events, and branded merchandise.", tag: "Custom print", tone: "olive", images: [] },
  { id: "travel-pouch", name: "Travel Organizer Pouch", category: "Bags", moq: 50, desc: "Compact zip pouch with multiple compartments and private-label options.", tag: "Flexible", tone: "lavender", images: [] },
];

export default function Catalogue() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [products, setProducts] = useState<CatalogueProduct[]>(fallbackProducts);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [usingSampleData, setUsingSampleData] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("featured");
  const [saved, setSaved] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(4);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [quickView, setQuickView] = useState<CatalogueProduct | null>(null);
  const [quickViewImageIndex, setQuickViewImageIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    void supabase.from("products").select("id,slug,name,description,short_description,category,moq,product_images(public_url,is_primary,sort_order)").eq("is_active", true).order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("Failed to load live catalogue:", error);
        setLoadError("We could not load the live catalogue, so sample products are shown below.");
        setUsingSampleData(true);
        setLoading(false);
        return;
      }
      if (!data?.length) { setUsingSampleData(true); setLoading(false); return; }
      const mapped = data.map((product: any): CatalogueProduct => {
        const images = Array.isArray(product.product_images) ? [...product.product_images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order) : [];
        return { id: product.slug, name: product.name, category: product.category, moq: product.moq, desc: product.short_description || product.description, tag: "Wholesale ready", tone: "mint", image: images[0]?.public_url, images: images.map(image => image.public_url).filter(Boolean) };
      });
      setProducts(mapped);
      setUsingSampleData(false);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => { setVisibleCount(4); }, [query, category, sort]);
  useEffect(() => {
    if (!quickView) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQuickView(null);
      if (event.key === "ArrowLeft") setQuickViewImageIndex(index => Math.max(0, index - 1));
      if (event.key === "ArrowRight") setQuickViewImageIndex(index => Math.min((quickView.images.length || 1) - 1, index + 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [quickView]);

  const filtered = useMemo(() => products.filter(p => (category === "All" || p.category === category) && `${p.name} ${p.desc}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "moq" ? a.moq - b.moq : sort === "az" ? a.name.localeCompare(b.name) : 0), [products, query, category, sort]);
  const visibleProducts = filtered.slice(0, visibleCount);
  const categories = ["All", ...Array.from(new Set(products.map(product => product.category)))];
  const openQuickView = (product: CatalogueProduct) => { setQuickView(product); setQuickViewImageIndex(0); };
  const moveQuickViewImage = (direction: number) => setQuickViewImageIndex(index => Math.min(Math.max(index + direction, 0), Math.max((quickView?.images.length || 1) - 1, 0)));
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return <div className="app-shell"><header className="site-header reference-header"><Link href="/" className="brand"><span className="brand-mark">C</span><span>CHADREY<small>WHOLESALE</small></span></Link><nav className="main-nav"><Link href="/">Home</Link><Link className="active" href="/products">Products</Link><Link href="/quote">Request a Quote</Link><Link href="/dashboard">My Workspace</Link></nav><Link href={user ? "/dashboard" : "/login"} className="avatar" title={user?.name}>{initialsFrom(user?.name, user?.email)}</Link></header><main className="page-container">{usingSampleData && <p className="form-error" role="alert">{loadError || "Showing sample products — connect the live catalogue to see real inventory."}</p>}<div className="page-kicker"><span className="eyebrow">CATALOGUE / {products.length.toString().padStart(2, "0")} PRODUCTS</span><span className="catalogue-note"><span className="status-dot"/> {usingSampleData ? "Sample catalogue" : "Live sourcing catalogue"}</span></div><div className="catalogue-title"><div><h1>Find your next best seller.</h1><p>Wholesale-ready products with transparent MOQs and flexible customization options.</p></div><Link className="button button-primary" href="/quote">Build a quote <ArrowRight size={16}/></Link></div><div className="catalogue-toolbar"><label className="search-field"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products" /></label><div className="filter-tabs">{categories.map(item => <button className={category === item ? "selected" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div><label className="sort-field"><SlidersHorizontal size={15}/><select value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Featured</option><option value="moq">MOQ: low to high</option><option value="az">Name: A–Z</option></select></label></div>{loading ? <CatalogueSkeletons/> : <div className="product-grid catalogue-results-grid">{visibleProducts.map(p => <article className="product-card product-card-clickable" key={p.id} role="link" tabIndex={0} onClick={() => navigate(productHref(p.id))} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(productHref(p.id)); } }}><div className={`product-image ${p.tone}`}>{p.image ? <img src={p.image} alt={p.name} /> : <div className="product-glyph">{p.category === "Bags" ? "▱" : "□"}</div>}<span className="product-tag">{p.tag}</span><button className={`save-button ${saved.includes(p.id) ? "saved" : ""}`} onClick={event => { event.stopPropagation(); setSaved(s => s.includes(p.id) ? s.filter(x => x !== p.id) : [...s, p.id]); }} aria-label={`Save ${p.name}`}><Heart size={17} fill={saved.includes(p.id) ? "currentColor" : "none"} /></button></div><div className="product-card-body"><div className="product-meta"><span>{p.category}</span><strong>MOQ {p.moq}</strong></div><h2>{p.name}</h2><FormattedDescription text={p.desc} className="catalogue-description"/><div className="product-card-footer"><Link href={productHref(p.id)} className="text-link" onClick={event => event.stopPropagation()}>View details <ArrowRight size={15}/></Link><button type="button" className="mini-cta quick-view-trigger" onClick={event => { event.stopPropagation(); openQuickView(p); }}><Eye size={13}/> Quick view</button></div></div></article>)}</div>}{!loading && filtered.length > visibleProducts.length && <><button type="button" className="button button-secondary load-more-button" onClick={() => { setVisibleCount(count => count + 4); setShowBackToTop(true); }}><span>Load more products</span><ArrowRight size={16}/></button>{showBackToTop && <button type="button" className="back-to-top-button" onClick={scrollToTop} aria-label="Back to top"><ArrowUp size={16}/><span>Back to top</span></button>}</>}{!loading && filtered.length === 0 && <div className="empty-state"><Filter size={24}/><h2>No products found</h2><p>Try another search or clear the category filter.</p></div>}</main><footer className="reference-footer"><div className="footer-brand"><span className="brand-mountain">⌃</span><div><strong>Chadrey Wholesale</strong><small>Your trusted partner for wholesale success.</small></div></div><div className="footer-socials"><Link href="/contact" aria-label="Contact Chadrey on LinkedIn">in</Link><Link href="/contact" aria-label="Contact Chadrey on Facebook">f</Link><Link href="/contact" aria-label="Contact Chadrey on Instagram">◎</Link><Link href="/contact" aria-label="Email Chadrey">✉</Link></div><div className="footer-bottom"><span>© 2026 Chadrey Wholesale. All rights reserved.</span></div></footer>{quickView && <div className="quick-view-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setQuickView(null); }}><section className="quick-view-modal" role="dialog" aria-modal="true" aria-labelledby="quick-view-title"><button type="button" className="quick-view-close" onClick={() => setQuickView(null)} aria-label="Close quick view"><X size={18}/></button><div className={`quick-view-image ${quickView.tone}`} onTouchStart={event => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => { const start = touchStartX.current; const end = event.changedTouches[0]?.clientX; touchStartX.current = null; if (start !== null && end !== undefined && Math.abs(end - start) > 32) moveQuickViewImage(end < start ? 1 : -1); }}><div className="quick-view-slide" aria-live="polite">{(quickView.images[quickViewImageIndex] || quickView.image) ? <img src={quickView.images[quickViewImageIndex] || quickView.image} alt={`${quickView.name} view ${quickViewImageIndex + 1}`}/> : <span className="product-glyph">{quickView.category === "Bags" ? "▱" : "□"}</span>}</div><span className="product-tag">{quickView.tag}</span>{quickView.images.length > 1 && <><button type="button" className="quick-view-arrow previous" onClick={() => moveQuickViewImage(-1)} disabled={quickViewImageIndex === 0} aria-label="Previous product image"><ArrowLeft size={16}/></button><button type="button" className="quick-view-arrow next" onClick={() => moveQuickViewImage(1)} disabled={quickViewImageIndex === quickView.images.length - 1} aria-label="Next product image"><ArrowRight size={16}/></button><div className="quick-view-dots" aria-label="Choose product image">{quickView.images.map((image, index) => <button type="button" className={index === quickViewImageIndex ? "selected" : ""} onClick={() => setQuickViewImageIndex(index)} key={image} aria-label={`Show product image ${index + 1}`}/>)}</div></>}</div><div className="quick-view-content"><span className="eyebrow">{quickView.category}</span><h2 id="quick-view-title">{quickView.name}</h2><p>{quickView.desc}</p><div className="quick-view-metrics"><span><strong>MOQ {quickView.moq}</strong><small>minimum order</small></span><span><strong>Wholesale</strong><small>quote pricing</small></span></div><div className="quick-view-actions"><Link className="button button-primary" href={productHref(quickView.id)} onClick={() => setQuickView(null)}>View full details <ArrowRight size={16}/></Link><Link className="button button-secondary" href={`/quote?product=${encodeURIComponent(quickView.id)}`} onClick={() => setQuickView(null)}>Request a quote</Link></div></div></section></div>}</div>;
}
