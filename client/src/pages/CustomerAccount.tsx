import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, MapPin, UserRound } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { supabase } from "@/lib/supabase";

type Address = { id: string; label: string; recipient_name: string; company_name: string | null; line1: string; line2: string | null; city: string; state: string | null; postal_code: string | null; country: string; is_default: boolean };

export default function CustomerAccount() {
  const { user, loading } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    setAddressLoading(true);
    supabase.from("customer_addresses").select("id,label,recipient_name,company_name,line1,line2,city,state,postal_code,country,is_default").order("is_default", { ascending: false }).order("created_at", { ascending: false }).then(({ data, error: queryError }) => {
      if (!active) return;
      if (queryError) setError("We could not load your saved addresses yet.");
      else setAddresses((data || []) as Address[]);
      setAddressLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  if (loading) return <div className="confirmation-page"><span className="eyebrow">ACCOUNT</span><h1>Loading your account…</h1></div>;
  if (!user) return <div className="confirmation-page"><span className="eyebrow">ACCOUNT</span><h1>Sign in to manage your account.</h1><p>Your profile and saved business addresses are only available to your signed-in account.</p><button className="button button-primary" onClick={() => startLogin()}>Sign in with Supabase <ArrowRight size={16}/></button></div>;

  return <div className="app-shell"><header className="site-header"><Link href="/" className="brand"><span className="brand-mark">C</span><span>CHADREY<small>WHOLESALE</small></span></Link><nav className="main-nav"><Link href="/products">Products</Link><Link href="/quote">Request a Quote</Link><Link href="/dashboard">My Workspace</Link></nav><span className="avatar">{user.name?.slice(0, 2).toUpperCase() || "CW"}</span></header><main className="page-container account-page"><Link href="/dashboard" className="back-link"><ArrowLeft size={15}/> Back to workspace</Link><div className="document-heading"><div><span className="eyebrow">ACCOUNT SETTINGS</span><h1>Your business profile.</h1><p className="page-lede">Review your account details and saved delivery addresses for future quote requests.</p></div><UserRound size={30} color="var(--green)"/></div><div className="account-grid"><section className="document-card"><span className="eyebrow">PROFILE</span><h2>{user.name || "Chadrey customer"}</h2><p>{user.email || "Signed-in Supabase account"}</p><div className="account-detail"><span>Access</span><strong>{user.role === "admin" ? "Administrator" : "Customer"}</strong></div></section><section className="document-card"><div className="panel-heading"><div><span className="eyebrow">DELIVERY ADDRESSES</span><h2>Saved locations</h2></div><MapPin size={22} color="var(--green)"/></div>{error && <p className="inline-error">{error}</p>}{addressLoading ? <p className="notification-menu-empty">Loading saved addresses…</p> : addresses.length ? <div className="address-list">{addresses.map(address => <article className="address-card" key={address.id}><div><strong>{address.label}{address.is_default ? " · Default" : ""}</strong><p>{address.recipient_name}{address.company_name ? ` · ${address.company_name}` : ""}<br/>{address.line1}{address.line2 ? `, ${address.line2}` : ""}<br/>{address.city}{address.state ? `, ${address.state}` : ""}{address.postal_code ? ` ${address.postal_code}` : ""}, {address.country}</p></div></article>)}</div> : <div className="empty-state"><MapPin size={22}/><p>No saved addresses yet. Add one during your next quote request.</p></div>}</section></div></main></div>;
}
