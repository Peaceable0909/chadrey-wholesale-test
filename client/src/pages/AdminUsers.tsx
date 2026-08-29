import { useEffect, useState } from "react";
import {ArrowLeft, Check, ShieldCheck, Users, X, ArrowRight, ArrowLeftToLine} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";

type UserRole = "admin" | "user";
type ManagedUser = { id: string; email: string | null; name: string | null; role: UserRole; created_at: string; last_signed_in: string | null };

function displayName(user: ManagedUser) { return user.name?.trim() || user.email || "Unnamed account"; }
function initials(user: ManagedUser) { return displayName(user).split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase(); }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Never"; }

export default function AdminUsers() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || user?.role !== "admin") return;
    let active = true;
    setLoading(true);
    void supabase.from("profiles").select("id,email,name,role,created_at,last_signed_in").order("created_at", { ascending: false }).then(({ data, error: queryError }) => {
      if (!active) return;
      if (queryError) setError(queryError.message);
      else setUsers((data ?? []) as ManagedUser[]);
      setLoading(false);
    });
    return () => { active = false; };
  }, [authLoading, user?.role]);

  async function changeRole(target: ManagedUser, role: UserRole) {
    setError("");
    setSavedId(null);
    if (target.id === user?.uid && role !== "admin") {
      setError("You cannot remove your own administrator access from this screen.");
      return;
    }
    setSavingId(target.id);
    const { data, error: updateError } = await supabase.from("profiles").update({ role }).eq("id", target.id).select("id,email,name,role,created_at,last_signed_in").single();
    setSavingId(null);
    if (updateError) { setError(updateError.message); return; }
    setUsers(current => current.map(item => item.id === target.id ? data as ManagedUser : item));
    setSavedId(target.id);
  }

  if (authLoading || loading && user?.role === "admin") return <div className="confirmation-page"><span className="eyebrow">DIRECTORY / USERS</span><h1>Loading users…</h1></div>;
  if (!user) return <div className="confirmation-page admin-gate"><Link href="/" className="back-link"><ArrowLeftToLine size={14}/> Back to Chadrey Wholesale</Link><span className="success-mark neutral"><ShieldCheck size={26}/></span><span className="eyebrow">DIRECTORY / USERS</span><h1>Admin sign-in required.</h1><p>Use your Supabase administrator account to access the operations workspace. If you don't have access yet, ask a Chadrey Wholesale administrator to add you.</p><Link href="/admin/login" className="button button-primary">Sign in to operations <ArrowRight size={16}/></Link></div>;
  if (user.role !== "admin") return <div className="confirmation-page admin-gate"><Link href="/" className="back-link"><ArrowLeftToLine size={14}/> Back to Chadrey Wholesale</Link><span className="success-mark neutral"><ShieldCheck size={26}/></span><span className="eyebrow">DIRECTORY / USERS</span><h1>Access restricted.</h1><p>Only Chadrey Wholesale administrators can manage user roles.</p><Link href="/dashboard" className="button button-secondary">Back to workspace</Link></div>;

  return <div className="workspace"><aside className="workspace-sidebar admin-sidebar"><Link href="/" className="workspace-logo"><span className="brand-mark">C</span><span>CHADREY<small>OPERATIONS</small></span></Link><span className="sidebar-label">OPERATIONS</span><Link className="sidebar-link" href="/admin"><ArrowLeft size={16}/> Overview</Link><Link className="sidebar-link active" href="/admin/users"><Users size={16}/> Users</Link><div className="sidebar-bottom"><Link className="sidebar-link" href="/">← Back to store</Link></div></aside><main className="workspace-main"><Link href="/admin" className="back-link"><ArrowLeft size={15}/> Back to operations</Link><header className="workspace-header"><div><span className="eyebrow">DIRECTORY / USERS</span><h1>Manage user access.</h1><p>Review registered accounts and control who can access operations.</p></div><div className="workspace-header-actions"><span className="summary-icon"><Users size={17}/></span></div></header><section className="workspace-panel user-management-panel"><div className="panel-heading"><div><span className="eyebrow">{users.length} REGISTERED ACCOUNT{users.length === 1 ? "" : "S"}</span><h2>Team and customer accounts</h2></div><span className="status-pill green"><ShieldCheck size={13}/> Protected</span></div>{error && <div className="user-management-alert error"><X size={15}/>{error}</div>}{savedId && <div className="user-management-alert success"><Check size={15}/> Role updated successfully.</div>}<div className="user-table" role="table" aria-label="Registered users"><div className="user-table-head" role="row"><span>Account</span><span>Joined</span><span>Last active</span><span>Access level</span></div>{users.map(item => <div className="user-table-row" role="row" key={item.id}><div className="user-identity"><span className="user-avatar">{initials(item)}</span><span><strong>{displayName(item)}</strong><small>{item.email || "No email provided"}</small></span></div><span data-label="Joined">{formatDate(item.created_at)}</span><span data-label="Last active">{formatDate(item.last_signed_in)}</span><label className="role-control" data-label="Access level"><select value={item.role} disabled={savingId === item.id || item.id === user.uid} onChange={event => void changeRole(item, event.target.value as UserRole)} aria-label={`Change role for ${displayName(item)}`}><option value="user">Customer</option><option value="admin">Administrator</option></select>{item.id === user.uid && <small>Your account</small>}{savingId === item.id && <small>Saving…</small>}</label></div>)}</div>{!users.length && !error && <div className="empty-state"><Users size={24}/><h2>No registered users yet</h2><p>New Supabase accounts will appear here automatically.</p></div>}</section></main></div>;
}
