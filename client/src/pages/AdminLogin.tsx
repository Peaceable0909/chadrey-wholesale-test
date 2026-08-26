import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { getSupabaseClient, isGoogleSignInAvailable, isSupabaseConfigured } from "@/lib/supabase";
import { formatAuthError } from "@/lib/authErrors";
import { getOrCreateSupabaseProfile, type SupabaseProfile } from "@/lib/userProfile";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const client = getSupabaseClient();
    void client.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) return;
      const profile = await getOrCreateSupabaseProfile(data.session.user);
      if (profile.role === "admin") navigate("/admin");
    }).catch(() => undefined);
  }, [navigate]);

  async function confirmAdmin(profilePromise: Promise<SupabaseProfile>) {
    const profile = await profilePromise;
    if (profile.role !== "admin") {
      await getSupabaseClient().auth.signOut();
      throw new Error("This account does not have administrator access.");
    }
    navigate("/admin");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!isSupabaseConfigured()) throw new Error("Supabase is not configured for this environment.");
      const { data, error: signInError } = await getSupabaseClient().auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      if (!data.user) throw new Error("No signed-in account was returned.");
      await confirmAdmin(getOrCreateSupabaseProfile(data.user));
    } catch (caught) {
      setError(formatAuthError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setGoogleBusy(true);
    setError("");
    try {
      if (!isGoogleSignInAvailable()) throw new Error("Supabase is not configured for this environment.");
      const { error: signInError } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/admin/login` },
      });
      if (signInError) throw signInError;
    } catch (caught) {
      setError(formatAuthError(caught));
      setGoogleBusy(false);
    }
  }

  if (!isSupabaseConfigured()) {
    return <main className="confirmation-page">
      <Link href="/" className="back-link">← Back to Chadrey Wholesale</Link>
      <div className="document-card" style={{ maxWidth: 480, width: "100%" }}>
        <span className="eyebrow">ADMIN OPERATIONS</span>
        <h1>Admin sign-in is not configured.</h1>
        <p>Add the Supabase browser variables to this deployment, then reload the page.</p>
      </div>
    </main>;
  }

  return (
    <main className="confirmation-page">
      <Link href="/" className="back-link">← Back to Chadrey Wholesale</Link>
      <div className="document-card" style={{ maxWidth: 480, width: "100%" }}>
        <span className="eyebrow">ADMIN OPERATIONS</span>
        <h1>Operations sign in.</h1>
        <p>Use the Supabase account that has been granted Chadrey Wholesale administrator access.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 24 }}>
          <input className="form-input" type="email" placeholder="Administrator email" value={email} onChange={event => setEmail(event.target.value)} required />
          <input className="form-input" type="password" placeholder="Password" value={password} onChange={event => setPassword(event.target.value)} required />
          {error && <p role="alert" style={{ color: "#a53b2a", margin: 0 }}>{error}</p>}
          <button className="button button-primary" type="submit" disabled={busy || googleBusy}>{busy ? "Checking access…" : "Sign in to operations"}</button>
        </form>
        <div className="login-divider"><span>or</span></div>
        <button className="google-login-button" type="button" onClick={continueWithGoogle} disabled={busy || googleBusy}>
          <span className="google-mark">G</span>
          {googleBusy ? "Checking access…" : "Continue with Google"}
        </button>
        <p style={{ color: "#7b8982", fontSize: 12, margin: "18px 0 0" }}>Admin access is restricted. Customer accounts remain in the customer workspace.</p>
      </div>
    </main>
  );
}
