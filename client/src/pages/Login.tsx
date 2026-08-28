import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { dashboardPathForRole, getOrCreateSupabaseProfile } from "@/lib/userProfile";
import { getSupabaseClient, isGoogleSignInAvailable, isSupabaseConfigured } from "@/lib/supabase";
import { formatAuthError } from "@/lib/authErrors";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void getSupabaseClient().auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) return;
      const profile = await getOrCreateSupabaseProfile(data.session.user);
      navigate(dashboardPathForRole(profile.role));
    }).catch(() => undefined);
  }, [navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!isSupabaseConfigured()) throw new Error("Supabase is not configured for this environment.");
      const client = getSupabaseClient();
      if (mode === "reset") {
        const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/login`,
        });
        if (resetError) throw resetError;
        setError("If an account exists for that email, a reset link is on its way.");
        return;
      }
      if (mode === "signup") {
        const { error: signUpError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (signUpError) throw signUpError;
        setError("Account created. Check your email if confirmation is required, then sign in.");
      } else {
        const { error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        const { data: sessionData } = await client.auth.getSession();
        const profile = sessionData.session?.user ? await getOrCreateSupabaseProfile(sessionData.session.user) : null;
        navigate(dashboardPathForRole(profile?.role ?? "user"));
      }
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
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (signInError) throw signInError;
    } catch (caught) {
      setError(formatAuthError(caught));
      setGoogleBusy(false);
    }
  }

  return (
    <main className="confirmation-page">
      <Link href="/" className="back-link">← Back to Chadrey Wholesale</Link>
      <div className="document-card" style={{ maxWidth: 480, width: "100%" }}>
        <span className="eyebrow">CUSTOMER ACCESS</span>
        <h1>{mode === "signin" ? "Welcome back." : mode === "signup" ? "Create your workspace." : "Reset your password."}</h1>
        <p>{mode === "reset" ? "Enter your account email and we will send you a link to set a new password." : "Use your secure Supabase account to manage quotes, invoices, payments, and deliveries."}</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 24 }}>
          {mode === "signup" && <input className="form-input" placeholder="Full name" value={name} onChange={event => setName(event.target.value)} required />}
          <input className="form-input" type="email" placeholder="Business email" value={email} onChange={event => setEmail(event.target.value)} required />
          {mode !== "reset" && <input className="form-input" type="password" placeholder="Password (at least 6 characters)" value={password} onChange={event => setPassword(event.target.value)} minLength={6} required />}
          {mode === "signin" && <button className="text-link" type="button" onClick={() => { setMode("reset"); setError(""); }} style={{ justifySelf: "start" }}>Forgot password?</button>}
          {error && <p role="alert" style={{ color: error.startsWith("Account created") || error.startsWith("If an account") ? "#315d43" : "#a53b2a", margin: 0 }}>{error}</p>}
          <button className="button button-primary" type="submit" disabled={busy || googleBusy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}</button>
        </form>
        {mode !== "reset" && <><div className="login-divider"><span>or</span></div>
        <button className="google-login-button" type="button" onClick={continueWithGoogle} disabled={busy || googleBusy}>
          <span className="google-mark">G</span>
          {googleBusy ? "Connecting…" : "Continue with Google"}
        </button></>}
        <button className="text-link" type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }} style={{ marginTop: 18 }}>
          {mode === "reset" ? "Back to sign in" : mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
