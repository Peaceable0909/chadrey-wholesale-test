import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, Check, Menu, PackageCheck, ShieldCheck, Sparkles, Truck, X } from "lucide-react";
import { Link } from "wouter";

const heroImage = "/manus-storage/chadrey-logistics-hero_a77922bf.jpg";
const categories = [
  { name: "Apparel & Textiles", count: "120+ products", mark: "01", tone: "sage" },
  { name: "Home & Living", count: "90+ products", mark: "02", tone: "gold" },
  { name: "Packaging & Supplies", count: "150+ products", mark: "03", tone: "green" },
  { name: "Electronics & Accessories", count: "80+ products", mark: "04", tone: "slate" },
];
const processSteps = [
  { n: "1", icon: "⌕", t: "Browse Products", d: "Explore our wide range of products and categories.", href: "/products" },
  { n: "2", icon: "▤", t: "Request a Quote", d: "Submit your requirements and quantity details easily.", href: "/quote" },
  { n: "3", icon: "✉", t: "Receive Quotation", d: "Get competitive quotes from our trusted suppliers.", href: "/dashboard" },
  { n: "4", icon: "▣", t: "Confirm & Order", d: "Review your quotation and track fulfilment in one workspace.", href: "/dashboard" },
];

function Header() {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && open) { setOpen(false); menuButtonRef.current?.focus(); } }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [open]);
  const closeMenu = () => { setOpen(false); menuButtonRef.current?.focus(); };
  return <header className="site-header reference-header">
    <Link href="/" className="brand"><span className="brand-mountain">⌃</span><span>Chadrey<strong>Wholesale</strong></span></Link>
    <nav id="primary-navigation" aria-label="Primary navigation" className={`main-nav ${open ? "is-open" : ""}`}>
      <Link href="/" onClick={closeMenu}>Home</Link><Link href="/products" onClick={closeMenu}>Products</Link><Link href="/quote" onClick={closeMenu}>Request a Quote</Link><Link href="/how-it-works" onClick={closeMenu}>How It Works</Link><Link href="/dashboard" onClick={closeMenu}>My Quotes</Link><Link href="/contact" onClick={closeMenu}>Contact</Link>
    </nav>
    <div className="header-actions"><Link href="/dashboard" className="icon-button header-bell" aria-label="Open workspace notifications"><Bell size={18}/></Link><Link href="/dashboard" className="avatar" aria-label="Open customer workspace">CW</Link><button ref={menuButtonRef} className="mobile-menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="primary-navigation" aria-label={open ? "Close primary navigation" : "Open primary navigation"}>{open ? <X size={22}/> : <Menu size={22}/>}</button></div>
  </header>;
}

export default function Home() {
  return <div className="app-shell reference-home"><Header /><main>
    <section className="reference-hero">
      <div className="reference-hero-copy"><span className="reference-pill"><span/> B2B WHOLESALE MARKETPLACE</span><h1>Power your business<br/>with <span>quality products</span><br/>at wholesale prices.</h1><p>Source premium products, request custom quotes, and build lasting partnerships that grow your business.</p><div className="hero-actions"><Link className="button button-primary" href="/quote"><PackageCheck size={17}/> Request a Quote</Link><Link className="button button-secondary" href="/products"><span className="button-grid-icon">⊞</span> Browse Products</Link></div><div className="trust-list reference-trust"><span><ShieldCheck size={21}/><b>Trusted Suppliers</b><small>Verified & reliable partners</small></span><span><Sparkles size={21}/><b>Competitive Pricing</b><small>Best value for your business</small></span><span><Check size={21}/><b>Custom Solutions</b><small>Tailored to your needs</small></span><span><Truck size={21}/><b>Reliable Delivery</b><small>On-time, every time</small></span></div></div>
      <div className="reference-hero-image" style={{backgroundImage:`url(${heroImage})`}}><div className="hero-image-overlay"/><div className="hero-business-badge"><strong>150+</strong><span>Growing businesses<br/>with Chadrey Wholesale</span></div></div>
    </section>
    <section className="reference-section categories-section"><div className="section-heading"><div><span className="eyebrow">EXPLORE OUR RANGE</span><h2>Popular Categories</h2></div><Link href="/products" className="text-link">View All Products <ArrowRight size={16}/></Link></div><div className="reference-category-grid">{categories.map((category) => <Link href={`/products?category=${encodeURIComponent(category.name)}`} className={`reference-category-card ${category.tone}`} key={category.name}><div className="category-visual"><span>{category.mark}</span><div className="category-visual-lines"/></div><div className="category-card-copy"><h3>{category.name}</h3><p>{category.count}</p><span className="category-arrow"><ArrowRight size={17}/></span></div></Link>)}</div><div className="category-dots"><i className="active"/><i/><i/><i/></div></section>
    <section className="reference-process"><div className="reference-process-title"><span className="eyebrow eyebrow-light">SIMPLE FROM START TO FINISH</span><h2>How It Works</h2><p>A clear wholesale journey with one connected workspace for every request, quote, and delivery.</p></div><div className="reference-process-grid">{processSteps.map((step) => <Link href={step.href} className="reference-process-step" key={step.n}><span className="process-number">{step.n}</span><span className="process-icon">{step.icon}</span><h3>{step.t}</h3><p>{step.d}</p><span className="process-link">Open step <ArrowRight size={14}/></span></Link>)}</div></section>
    <section className="reference-cta"><div className="cta-box-illustration"><span>◒</span><span>▰</span><span>▰</span></div><div><span className="eyebrow">READY WHEN YOU ARE</span><h2>Ready to grow your business?</h2><p>Get started today and unlock wholesale sourcing tailored to your needs.</p></div><Link href="/quote" className="button button-primary">Request a Quote Now <ArrowRight size={16}/></Link></section>
  </main><footer className="reference-footer"><div className="footer-brand"><span className="brand-mountain">⌃</span><div><strong>Chadrey Wholesale</strong><small>Your trusted partner for wholesale success.</small></div></div><div className="footer-socials"><Link href="/contact" aria-label="Contact Chadrey on LinkedIn">in</Link><Link href="/contact" aria-label="Contact Chadrey on Facebook">f</Link><Link href="/contact" aria-label="Contact Chadrey on Instagram">◎</Link><Link href="/contact" aria-label="Email Chadrey">✉</Link></div><div className="footer-bottom"><span>© 2026 Chadrey Wholesale. All rights reserved.</span></div></footer></div>;
}
