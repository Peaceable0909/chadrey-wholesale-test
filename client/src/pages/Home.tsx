import { Link } from "wouter";
import { ArrowRight, Bell, Check, ChevronDown, PackageCheck, ShieldCheck, Sparkles, Truck } from "lucide-react";

const categories = [
  { name: "Apparel & Clothing", count: "120+ products", mark: "01" },
  { name: "Bags & Accessories", count: "80+ products", mark: "02" },
  { name: "Footwear", count: "60+ products", mark: "03" },
  { name: "Home & Lifestyle", count: "70+ products", mark: "04" },
];

function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="brand"><span className="brand-mark">C</span><span>CHADREY<small>WHOLESALE</small></span></Link>
      <nav className="main-nav"><Link href="/">Home</Link><Link href="/products">Products</Link><Link href="/quote">Request a Quote</Link><Link href="/dashboard">My Workspace</Link><Link href="/admin">Admin</Link></nav>
      <div className="header-actions"><button className="icon-button" aria-label="Notifications"><Bell size={17}/><i /></button><Link href="/dashboard" className="avatar">AB</Link></div>
    </header>
  );
}

export default function Home() {
  return <div className="app-shell">
    <Header />
    <main>
      <section className="hero-section"><div className="hero-copy"><span className="eyebrow">B2B WHOLESALE MARKETPLACE</span><h1>Source quality products.<br/><em>Get the best prices.</em></h1><p>From product discovery to delivery, manage your wholesale orders in one calm, connected workspace.</p><div className="hero-actions"><Link className="button button-primary" href="/quote">Request a quote <ArrowRight size={16}/></Link><Link className="button button-secondary" href="/products">Browse products</Link></div><div className="trust-list"><span><ShieldCheck size={16}/> Verified suppliers</span><span><Sparkles size={16}/> Custom solutions</span><span><Truck size={16}/> Reliable delivery</span></div></div><div className="hero-art"><div className="art-grid"/><div className="crate crate-one">APPAREL<span>500 units</span></div><div className="crate crate-two">PRIVATE LABEL<span>MOQ 50</span></div><div className="hero-badge"><strong>150+</strong><span>businesses sourcing smarter</span></div></div></section>
      <section className="section-block"><div className="section-heading"><div><span className="eyebrow">EXPLORE THE CATALOGUE</span><h2>Built for the way you buy wholesale.</h2></div><Link href="/products" className="text-link">View all products <ArrowRight size={15}/></Link></div><div className="category-grid">{categories.map((category) => <Link href="/products" className="category-card" key={category.name}><span className="category-mark">{category.mark}</span><div><h3>{category.name}</h3><p>{category.count}</p></div><ArrowRight size={17}/></Link>)}</div></section>
      <section className="process-section"><div className="process-intro"><span className="eyebrow eyebrow-light">A CLEARER PROCESS</span><h2>From request<br/>to delivery.</h2><p>Every step, one place. Track conversations, documents, payments, and fulfilment without losing the thread.</p><Link href="/quote" className="button button-light">Start a request <ArrowRight size={16}/></Link></div><div className="process-steps">{[{n:"01", t:"Browse products", d:"Choose from our curated catalogue and product variants."},{n:"02", t:"Request a quote", d:"Bundle multiple items and share your exact requirements."},{n:"03", t:"Review & accept", d:"Receive transparent line-item pricing from our team."},{n:"04", t:"Track delivery", d:"Follow payment, production, shipping, and delivery."}].map((step) => <div className="process-step" key={step.n}><span>{step.n}</span><h3>{step.t}</h3><p>{step.d}</p></div>)}</div></section>
      <section className="section-block feature-strip"><div><span className="eyebrow">ONE WORKSPACE</span><h2>Your quote is more than a price.</h2><p>Keep every request, quotation, invoice, message, and shipment status connected to the same order record.</p></div><div className="feature-points"><p><Check size={17}/> Live status timeline from pending to delivered</p><p><Check size={17}/> Multi-item requests with per-product requirements</p><p><Check size={17}/> Clear documents for your team and your customers</p></div></section>
    </main>
    <footer className="site-footer"><span>© 2026 Chadrey Wholesale</span><span>Quality sourcing, made clearer.</span><div><Link href="/products">Products</Link><Link href="/quote">Request a quote</Link><Link href="/dashboard">Workspace</Link></div></footer>
  </div>;
}
